/**
 * /entidad/[nombre] — Entity profile page
 *
 * ISR page with 1 hour revalidation.
 * Shows all contracts associated with a government entity.
 */

import { ContractCard } from "@/components/contract/contract-card";
import { getSocrataClient } from "@/lib/socrata";
import { formatCOP } from "@/lib/utils";
import { DATASETS, SoQLBuilder } from "@secopia/socrata-client";
import type { ContratoSECOP2 } from "@secopia/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// ISR: revalidate every hour
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ nombre: string }>;
}

async function getContracts(nombre: string): Promise<ContratoSECOP2[]> {
  const ds = DATASETS.contratos;
  const q = new SoQLBuilder()
    .like(ds.campos.entidad, nombre)
    .orderBy(ds.campos.fecha_firma)
    .limit(200)
    .build();

  const client = getSocrataClient();
  return await client.query<ContratoSECOP2>(ds.id, q);
}

function computeStats(contracts: ContratoSECOP2[]) {
  let total = 0;
  const proveedores = new Set<string>();
  const modalidades = new Set<string>();

  for (const c of contracts) {
    const val = Number.parseFloat(c.valor_del_contrato);
    if (!Number.isNaN(val)) {
      total += val;
    }
    if (c.proveedor_adjudicado) proveedores.add(c.proveedor_adjudicado);
    if (c.modalidad_de_contratacion) modalidades.add(c.modalidad_de_contratacion);
  }

  return { total, proveedores: proveedores.size, modalidades: modalidades.size };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { nombre } = await params;
  const decoded = decodeURIComponent(nombre);
  const contracts = await getContracts(decoded);

  if (contracts.length === 0) {
    return { title: "Entidad no encontrada" };
  }

  const entidad = contracts[0]?.nombre_entidad ?? decoded;
  return {
    title: `${entidad} — Entidad SECOP`,
    description: `${contracts.length} contratos registrados en SECOP II para ${entidad}`,
  };
}

export default async function EntidadPage({ params }: PageProps) {
  const { nombre } = await params;
  const decoded = decodeURIComponent(nombre);
  const contracts = await getContracts(decoded);

  if (contracts.length === 0) {
    notFound();
  }

  const entidad = contracts[0]?.nombre_entidad ?? decoded;
  const nit = contracts[0]?.nit_entidad;
  const depto = contracts[0]?.departamento;
  const stats = computeStats(contracts);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <Link href="/buscar" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Volver a búsqueda
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{entidad}</h1>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--color-muted)]">
          {nit && <span>NIT: {nit}</span>}
          {depto && <span>· {depto}</span>}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Contratos" value={String(contracts.length)} />
        <StatCard label="Valor Total" value={formatCOP(stats.total)} />
        <StatCard label="Proveedores" value={String(stats.proveedores)} />
        <StatCard label="Modalidades" value={String(stats.modalidades)} />
      </div>

      {/* Contract List */}
      <h2 className="mb-4 text-lg font-semibold">Contratos ({contracts.length})</h2>
      <div className="space-y-3">
        {contracts.map((contract, i) => (
          <ContractCard key={contract.id_contrato ?? i} contract={contract} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      <dt className="text-sm text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-1 text-lg font-semibold">{value}</dd>
    </div>
  );
}
