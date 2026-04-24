#!/usr/bin/env tsx
/**
 * sync-typesense.ts — Sync Socrata data to Typesense
 *
 * Fetches contracts from SECOP II via Socrata API and upserts
 * them into a Typesense collection for instant full-text search.
 *
 * Usage:
 *   pnpm tsx scripts/sync-typesense.ts
 *
 * Environment:
 *   SOCRATA_APP_TOKEN         — Socrata API token (recommended)
 *   TYPESENSE_HOST            — Typesense host
 *   TYPESENSE_ADMIN_API_KEY   — Typesense admin API key (write access)
 *
 * Designed to run as a cron job (every 30 minutes) or GitHub Action.
 */

import { DATASETS, SoQLBuilder, SocrataClient } from "@secopia/socrata-client";
import type { ContratoSECOP2 } from "@secopia/types";
import Typesense from "typesense";

// ─── Configuration ──────────────────────────────────────────────

const BATCH_SIZE = 250;
const MAX_RECORDS = 50_000; // Safety limit per sync run
const COLLECTION_NAME = "contratos";

const SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: "id", type: "string" as const },
    { name: "id_contrato", type: "string" as const, facet: false },
    { name: "nombre_entidad", type: "string" as const, facet: true },
    { name: "nit_entidad", type: "string" as const, facet: false, optional: true },
    { name: "proveedor_adjudicado", type: "string" as const, facet: true, optional: true },
    { name: "documento_proveedor", type: "string" as const, facet: false, optional: true },
    { name: "objeto_del_contrato", type: "string" as const, facet: false, optional: true },
    { name: "tipo_de_contrato", type: "string" as const, facet: true, optional: true },
    { name: "modalidad_de_contratacion", type: "string" as const, facet: true, optional: true },
    { name: "departamento", type: "string" as const, facet: true, optional: true },
    { name: "ciudad", type: "string" as const, facet: true, optional: true },
    { name: "estado_contrato", type: "string" as const, facet: true, optional: true },
    { name: "valor_del_contrato", type: "float" as const, facet: false, optional: true },
    { name: "fecha_de_firma", type: "int64" as const, facet: false, sort: true },
    { name: "urlproceso", type: "string" as const, facet: false, optional: true },
  ],
  default_sorting_field: "fecha_de_firma",
};

// ─── Helpers ─────────────────────────────────────────────────────

function toTimestamp(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
}

function toFloat(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  return Number.isNaN(n) ? undefined : n;
}

function transformContract(c: ContratoSECOP2) {
  const url = typeof c.urlproceso === "object" ? c.urlproceso?.url : c.urlproceso;
  const fallbackId =
    c.id_contrato ||
    (c.nit_entidad && c.fecha_de_firma
      ? `${c.nit_entidad}-${c.fecha_de_firma}-${c.documento_proveedor ?? "no-doc"}`
      : crypto.randomUUID());
  return {
    id: fallbackId,
    id_contrato: c.id_contrato ?? "",
    nombre_entidad: c.nombre_entidad ?? "",
    nit_entidad: c.nit_entidad,
    proveedor_adjudicado: c.proveedor_adjudicado,
    documento_proveedor: c.documento_proveedor,
    objeto_del_contrato: c.objeto_del_contrato,
    tipo_de_contrato: c.tipo_de_contrato,
    modalidad_de_contratacion: c.modalidad_de_contratacion,
    departamento: c.departamento,
    ciudad: c.ciudad,
    estado_contrato: c.estado_contrato,
    valor_del_contrato: toFloat(c.valor_del_contrato),
    fecha_de_firma: toTimestamp(c.fecha_de_firma),
    urlproceso: url ?? "",
  };
}

async function importWithRetry(
  ts: Typesense.Client,
  documents: ReturnType<typeof transformContract>[],
): Promise<{ successes: number; failures: number }> {
  const delays = [1000, 2000, 4000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const result = await ts
        .collections(COLLECTION_NAME)
        .documents()
        .import(documents, { action: "upsert" });

      const successes = result.filter((r) => r.success).length;
      const failures = result.filter((r) => !r.success).length;
      return { successes, failures };
    } catch (error) {
      if (attempt === delays.length) throw error;
      console.warn(
        `  ⚠️  Import attempt ${attempt + 1} failed, retrying in ${delays[attempt]}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("Import failed after all retries");
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_ADMIN_API_KEY;

  if (!host || !apiKey) {
    console.error("❌ Missing TYPESENSE_HOST or TYPESENSE_ADMIN_API_KEY");
    process.exit(1);
  }

  const port = Number(process.env.TYPESENSE_PORT ?? 443);
  const protocol = process.env.TYPESENSE_PROTOCOL ?? "https";

  const ts = new Typesense.Client({
    nodes: [{ host, port, protocol }],
    apiKey,
    connectionTimeoutSeconds: 10,
  });

  const socrata = new SocrataClient({
    appToken: process.env.SOCRATA_APP_TOKEN,
  });

  // ── 1. Ensure collection exists ──────────────────────────

  try {
    await ts.collections(COLLECTION_NAME).retrieve();
    console.log(`✅ Collection "${COLLECTION_NAME}" exists`);
  } catch {
    console.log(`📦 Creating collection "${COLLECTION_NAME}"...`);
    await ts.collections().create(SCHEMA);
    console.log("✅ Collection created");
  }

  // ── 2. Fetch and upsert in batches ──────────────────────

  const ds = DATASETS.contratos;
  let offset = 0;
  let totalUpserted = 0;
  let hasMore = true;

  console.log("\n🔄 Starting sync from Socrata → Typesense...");

  while (hasMore && offset < MAX_RECORDS) {
    const q = new SoQLBuilder()
      .orderBy(ds.campos.fecha_firma)
      .limit(BATCH_SIZE)
      .offset(offset)
      .build();

    const batch = await socrata.query<ContratoSECOP2>(ds.id, q);

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    const documents = batch.map(transformContract).filter((d) => d.id); // Skip documents without an ID

    try {
      const { successes, failures } = await importWithRetry(ts, documents);

      totalUpserted += successes;

      if (failures > 0) {
        console.warn(`  ⚠️  Batch at offset ${offset}: ${successes} ok, ${failures} failed`);
      }
    } catch (error) {
      console.error(`  ❌ Batch import failed at offset ${offset} after retries:`, error);
    }

    offset += batch.length;
    process.stdout.write(`\r  📥 Processed: ${offset} records (${totalUpserted} upserted)`);

    // Respect Socrata rate limits
    if (batch.length === BATCH_SIZE) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  console.log(`\n\n✅ Sync complete: ${totalUpserted} documents upserted`);
}

main().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
