/**
 * /contrato/[id] — Contract detail page
 *
 * ISR page with 1 hour revalidation + Redis cache.
 * Fetches contract data server-side for SEO.
 */

import { ContractDetail } from "@/components/contract/contract-detail";
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
  params: Promise<{ id: string }>;
}

async function getContract(id: string): Promise<ContratoSECOP2 | null> {
  const ds = DATASETS.contratos;
  const q = new SoQLBuilder().equals(ds.campos.id_contrato, id).limit(1).build();

  const client = getSocrataClient();
  const results = await client.query<ContratoSECOP2>(ds.id, q);
  return results[0] ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const contract = await getContract(id);

  if (!contract) {
    return { title: "Contrato no encontrado" };
  }

  return {
    title: `${contract.nombre_entidad} — ${formatCOP(contract.valor_del_contrato)}`,
    description: contract.objeto_del_contrato ?? "Detalle de contrato SECOP II",
  };
}

export default async function ContratoPage({ params }: PageProps) {
  const { id } = await params;
  const contract = await getContract(id);

  if (!contract) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link href="/buscar" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Volver a resultados
        </Link>
      </div>

      <h1 className="text-2xl font-bold">{contract.nombre_entidad}</h1>
      <p className="mt-1 text-[var(--color-muted)]">Contrato {contract.id_contrato}</p>

      <div className="mt-6">
        <ContractDetail contract={contract} />
      </div>
    </div>
  );
}
