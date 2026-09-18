#!/usr/bin/env tsx
/**
 * sync-typesense.ts — Sync Socrata data to Typesense (rolling window)
 *
 * Indexes SECOP II contracts into Typesense for instant full-text search.
 * Instead of the full ~5M-row dataset, it keeps a ROLLING WINDOW of
 * recent contracts (what users actually search) and purges the rest.
 *
 * Modes (env):
 *   TYPESENSE_WINDOW_YEARS  — Index window in years, counting the current
 *                             calendar year. Default 2 → 2025+2026 in 2026.
 *                             Cutoff = Jan 1 of (currentYear - YEARS + 1).
 *   TYPESENSE_SYNC_DAYS     — >0: incremental sync of records updated in
 *                             the last N days (ultima_actualizacion).
 *                             0 (default): full window resync.
 *   TYPESENSE_SYNC_BATCH    — Rows per Socrata page (default 5000; Socrata
 *                             accepts up to ~50K, far above the 200 used
 *                             on the request path).
 *   TYPESENSE_PURGE         — "0" disables the auto-purge.
 *
 * Auto-purge: after every run, documents with fecha_de_firma older than
 * the window start are deleted via filter_by — the index self-maintains
 * as the year rolls over.
 *
 * Environment:
 *   SOCRATA_APP_TOKEN         — Socrata API token (recommended)
 *   TYPESENSE_HOST            — Typesense host
 *   TYPESENSE_ADMIN_API_KEY   — Typesense admin API key (write access)
 *
 * Designed to run as a recurring job (the sync service loops it daily,
 * full resync on Sundays) or manually:
 *   pnpm tsx scripts/sync-typesense.ts
 */

import { DATASETS, SocrataClient } from "@secopia/socrata-client";
import type { ContratoSECOP2 } from "@secopia/types";
import Typesense from "typesense";

// ─── Configuration ──────────────────────────────────────────────

const COLLECTION_NAME = "contratos";
const WINDOW_YEARS = Math.max(1, Number(process.env.TYPESENSE_WINDOW_YEARS ?? 2));
const SYNC_DAYS = Math.max(0, Number(process.env.TYPESENSE_SYNC_DAYS ?? 0));
const SYNC_BATCH = Math.min(50_000, Math.max(200, Number(process.env.TYPESENSE_SYNC_BATCH ?? 5000)));
const PURGE = process.env.TYPESENSE_PURGE !== "0";
const PAGE_DELAY_MS = 200;

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
    // facet:true is required for the purge's filter_by delete
    { name: "fecha_de_firma", type: "int64" as const, facet: true, sort: true },
    { name: "urlproceso", type: "string" as const, facet: false, optional: true },
  ],
  default_sorting_field: "fecha_de_firma",
};

/** Jan 1 UTC of the first year inside the window (YEARS=2, 2026 → 2025-01-01). */
function windowStartDate(): Date {
  const year = new Date().getUTCFullYear() - (WINDOW_YEARS - 1);
  return new Date(Date.UTC(year, 0, 1));
}

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
    // Window scans fetch large date-filtered pages; these stay fast because
    // the date column is indexed, but give Socrata headroom under load.
    timeoutMs: 120_000,
    cache: { ttlMs: 0 },
  });

  const windowStart = windowStartDate();
  const windowStartISO = windowStart.toISOString().slice(0, 10);
  const windowStartTs = Math.floor(windowStart.getTime() / 1000);
  const incremental = SYNC_DAYS > 0;
  const recentCutoffISO = new Date(Date.now() - SYNC_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // ── 1. Ensure collection exists with the right schema ─────

  let collectionExists = true;
  try {
    const existing = await ts.collections(COLLECTION_NAME).retrieve();
    const fechaField = existing.fields?.find((f) => f.name === "fecha_de_firma");
    if (fechaField && fechaField.facet !== true) {
      // facet:true is required for the purge filter; schema can't be
      // altered in place on this version — recreate and force a full sync.
      console.log("🔁 Recreating collection: fecha_de_firma needs facet:true for purge");
      await ts.collections(COLLECTION_NAME).delete();
      collectionExists = false;
    }
  } catch {
    collectionExists = false;
  }
  if (!collectionExists) {
    console.log(`📦 Creating collection "${COLLECTION_NAME}"...`);
    await ts.collections().create(SCHEMA);
  } else {
    console.log(`✅ Collection "${COLLECTION_NAME}" exists`);
  }

  // A missing/recreated collection must backfill the whole window even in
  // incremental mode — otherwise only the last SYNC_DAYS would be indexed.
  const fullWindow = !incremental || !collectionExists;

  // ── 2. Fetch and upsert in batches ──────────────────────

  const ds = DATASETS.contratos;
  const whereFecha = `${ds.campos.fecha_firma} >= '${windowStartISO}'`;
  const whereClause = fullWindow
    ? whereFecha
    : `ultima_actualizacion >= '${recentCutoffISO}' AND ${whereFecha}`;

  // Field names are internal constants — where() is safe here (no user input).
  // Ordered DESC so the newest records land first; a short page ends the loop.
  const orderField = fullWindow ? ds.campos.fecha_firma : "ultima_actualizacion";

  console.log(
    `\n🔄 Sync ${fullWindow ? `full window (>= ${windowStartISO})` : `last ${SYNC_DAYS}d updates`}...`,
  );

  let offset = 0;
  let totalUpserted = 0;
  let hasMore = true;

  while (hasMore) {
    const q =
      `SELECT * WHERE ${whereClause} ORDER BY ${orderField} DESC ` +
      `LIMIT ${SYNC_BATCH} OFFSET ${offset}`;

    const batch = await socrata.query<ContratoSECOP2>(ds.id, q);

    if (batch.length === 0) break;

    const documents = batch.map(transformContract).filter((d) => d.id);

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

    hasMore = batch.length === SYNC_BATCH;
    if (hasMore) await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
  }

  console.log(`\n  ✅ Upserted ${totalUpserted} documents`);

  // ── 3. Auto-purge records outside the window ────────────

  if (PURGE) {
    console.log(`🧹 Purging documents with fecha_de_firma < ${windowStartISO}...`);
    const res = await ts
      .collections(COLLECTION_NAME)
      .documents()
      .delete({ filter_by: `fecha_de_firma:<${windowStartTs}` });
    console.log(`  🗑️  Purged ${res.num_deleted ?? "?"} documents`);
  }

  const stats = await ts.collections(COLLECTION_NAME).retrieve();
  console.log(`\n✅ Sync complete: ${stats.num_documents ?? "?"} documents in index`);
}

main().catch((err) => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
