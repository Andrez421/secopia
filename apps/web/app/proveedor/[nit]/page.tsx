/**
 * /proveedor/[nit] — Supplier / Contractor profile page
 *
 * ISR page with 1 hour revalidation.
 *
 * Sections:
 *  1. Header         — name, NIT, location, status, company type
 *  2. Contact info   — location, legal rep data extracted from contracts
 *  3. Legal rep      — nombre, identificación, cargo del representante
 *  4. Financial      — total pagado + pendiente por pagar with CSS bar charts
 *  5. Contract list  — chronological history with ContractCard
 */

import { ContractCard } from "@/components/contract/contract-card";
import { deriveCompanyType, isActive } from "@/lib/provider-utils";
import { getSocrataClient } from "@/lib/socrata";
import { formatCOP, formatDate } from "@/lib/utils";
import { DATASETS, SoQLBuilder } from "@secopia/socrata-client";
import type { ContratoSECOP2 } from "@secopia/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

// ISR: revalidate every hour
export const revalidate = 3600;

interface PageProps {
  params: Promise<{ nit: string }>;
}

// ─── Data fetching ────────────────────────────────────────────────

async function getContracts(nit: string): Promise<ContratoSECOP2[]> {
  const ds = DATASETS.contratos;
  const q = new SoQLBuilder()
    .equals(ds.campos.documento_proveedor, nit)
    .orderBy(ds.campos.fecha_firma, "DESC")
    .limit(200)
    .build();

  const client = getSocrataClient();
  return await client.query<ContratoSECOP2>(ds.id, q);
}

// ─── Stats computation ────────────────────────────────────────────

interface ProviderStats {
  totalValor: number;
  totalPagado: number;
  totalPendiente: number;
  entidades: string[];
  departamentos: string[];
  modalidades: Record<string, number>;
  estados: Record<string, number>;
  contractsWithValue: {
    id: string;
    valor: number;
    pagado: number;
    pendiente: number;
    entidad: string;
    fecha: string;
  }[];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: statistical aggregation
function computeStats(contracts: ContratoSECOP2[]): ProviderStats {
  let totalValor = 0;
  let totalPagado = 0;
  let totalPendiente = 0;
  const entidadesSet = new Set<string>();
  const departamentosSet = new Set<string>();
  const modalidades: Record<string, number> = {};
  const estados: Record<string, number> = {};
  const contractsWithValue: ProviderStats["contractsWithValue"] = [];

  for (const c of contracts) {
    const valor = Number.parseFloat(c.valor_del_contrato ?? "0");
    const pagado = Number.parseFloat(c.valor_pagado ?? "0");
    const pendiente = Number.parseFloat(c.valor_pendiente_de_pago ?? "0");

    if (!Number.isNaN(valor)) totalValor += valor;
    if (!Number.isNaN(pagado)) totalPagado += pagado;
    if (!Number.isNaN(pendiente)) totalPendiente += pendiente;

    if (c.nombre_entidad) entidadesSet.add(c.nombre_entidad);
    if (c.departamento) departamentosSet.add(c.departamento);
    if (c.modalidad_de_contratacion) {
      modalidades[c.modalidad_de_contratacion] =
        (modalidades[c.modalidad_de_contratacion] ?? 0) + 1;
    }
    if (c.estado_contrato) {
      estados[c.estado_contrato] = (estados[c.estado_contrato] ?? 0) + 1;
    }

    if (!Number.isNaN(valor) && valor > 0) {
      contractsWithValue.push({
        id: c.id_contrato ?? "",
        valor,
        pagado: Number.isNaN(pagado) ? 0 : pagado,
        pendiente: Number.isNaN(pendiente) ? 0 : pendiente,
        entidad: c.nombre_entidad ?? "",
        fecha: c.fecha_de_firma ?? "",
      });
    }
  }

  return {
    totalValor,
    totalPagado,
    totalPendiente,
    entidades: [...entidadesSet],
    departamentos: [...departamentosSet],
    modalidades,
    estados,
    contractsWithValue,
  };
}

// ─── Metadata ─────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // params are already URL-decoded by Next.js — decoding again
  // throws URIError on values containing a literal '%'
  const { nit } = await params;
  const contracts = await getContracts(nit);
  if (contracts.length === 0) return { title: "Proveedor no encontrado" };
  const nombre = contracts[0]?.proveedor_adjudicado ?? `NIT ${nit}`;
  return {
    title: `${nombre} — Perfil Proveedor SECOP`,
    description: `${contracts.length} contratos en SECOP II · Total: ${formatCOP(contracts.reduce((s, c) => s + (Number.parseFloat(c.valor_del_contrato ?? "0") || 0), 0))}`,
  };
}

// ─── Page ─────────────────────────────────────────────────────────

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: page component with data fetching and sections
export default async function ProveedorPage({ params }: PageProps) {
  const { nit } = await params;
  const contracts = await getContracts(nit);

  if (contracts.length === 0) notFound();

  const first = contracts[0] as ContratoSECOP2;
  const nombre = first.proveedor_adjudicado ?? `NIT ${nit}`;
  const stats = computeStats(contracts);
  const companyType = deriveCompanyType(contracts[0]?.tipodocproveedor);
  const active = isActive(contracts);
  const location = [first.ciudad, first.departamento].filter(Boolean).join(", ");
  const codigoProveedor = first.codigo_proveedor;

  // Legal rep data (from most recent contract with this info)
  const repContract = contracts.find((c) => c.nombre_representante_legal);
  const repNombre = repContract?.nombre_representante_legal;
  const repTipoDoc = repContract?.tipo_de_identificaci_n_representante_legal;
  const repDoc = repContract?.identificaci_n_representante_legal;
  const repGenero = repContract?.g_nero_representante_legal;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link href="/buscar" className="text-sm text-[var(--color-primary)] hover:underline">
          ← Volver a búsqueda
        </Link>
      </div>

      {/* ── 1. HEADER ─────────────────────────────────────── */}
      <div className="mb-8 rounded-xl border border-[var(--color-border)] p-6">
        {/* Top row */}
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            <svg
              role="img"
              aria-label="Proveedor"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            Proveedor / Contratista
          </span>

          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
              active
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-[var(--color-accent)] text-[var(--color-muted)]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-[var(--color-muted)]"}`}
            />
            {active ? "Proveedor Activo" : "Sin contratos activos"}
          </span>

          {codigoProveedor && <span className="ml-auto font-mono">{codigoProveedor}</span>}
        </div>

        {/* Name */}
        <h1 className="mb-3 text-3xl font-bold uppercase tracking-wide">{nombre}</h1>

        {/* NIT + Location + Version */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            <svg
              role="img"
              aria-label="Identificación"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0"
              />
            </svg>
            NIT: <strong className="text-[var(--color-foreground)]">{nit}</strong>
          </span>

          {location && (
            <span className="flex items-center gap-1">
              <svg
                role="img"
                aria-label="Ubicación"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {location.toUpperCase()}
            </span>
          )}

          <span className="flex items-center gap-1">
            <svg
              role="img"
              aria-label="Calendario"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Versión:{" "}
            <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs">
              Estás viendo lo último
            </span>
          </span>
        </div>

        {/* Company type + status */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
          <span className="flex items-center gap-1">
            <svg
              role="img"
              aria-label="Tipo de empresa"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Tipo de empresa:
            <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs">
              {companyType}
            </span>
          </span>

          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <svg
              role="img"
              aria-label="Estado"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Registro Activo
          </span>

          {repNombre && <span className="text-[var(--color-muted)]">· Contacto disponible</span>}
        </div>
      </div>

      {/* ── GRID: Left column (main) + Right column (sidebar) ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* ── 2. CONTACT INFO ────────────────────────────── */}
          {(location || repNombre) && (
            <Section title="Información de Contacto" icon="contact">
              <div className="grid gap-4 sm:grid-cols-2">
                {location && (
                  <InfoField label="Ubicación" icon="pin">
                    <span className="font-medium">{location.toUpperCase()}</span>
                    {first.domicilio_representante_legal &&
                      first.domicilio_representante_legal !== "No Definido" && (
                        <span className="block text-xs text-[var(--color-muted)]">
                          {first.domicilio_representante_legal}
                        </span>
                      )}
                  </InfoField>
                )}

                {repDoc && repDoc !== "Sin Descripcion" && (
                  <InfoField label="Identificación" icon="id">
                    <span className="font-medium">
                      {repTipoDoc !== "Sin Descripcion" ? repTipoDoc : "Documento"}: {repDoc}
                    </span>
                  </InfoField>
                )}

                {repGenero && repGenero !== "Sin Descripcion" && (
                  <InfoField label="Género" icon="person">
                    <span className="font-medium">{repGenero}</span>
                  </InfoField>
                )}
              </div>
            </Section>
          )}

          {/* ── 3. LEGAL REPRESENTATION ────────────────────── */}
          {repNombre && (
            <Section title="Representación Legal" icon="person">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoField label="Nombre">
                  <span className="font-semibold">{repNombre}</span>
                </InfoField>

                {repDoc && repDoc !== "Sin Descripcion" && (
                  <InfoField label="Identificación">
                    <span className="font-medium">
                      {repTipoDoc && repTipoDoc !== "Sin Descripcion" ? repTipoDoc : "Documento"}:{" "}
                      {repDoc}
                    </span>
                  </InfoField>
                )}
              </div>
            </Section>
          )}

          {/* ── 4. TOTAL PAGADO ────────────────────────────── */}
          <Section
            title="Total pagado"
            subtitle={`Acumulado de los últimos ${contracts.length} contratos: ${formatCOP(stats.totalPagado)}`}
          >
            <BarChart
              items={stats.contractsWithValue}
              valueKey="pagado"
              maxValue={Math.max(...stats.contractsWithValue.map((c) => c.valor))}
              barClass="from-emerald-600 to-emerald-400"
              legendSwatchClass="bg-emerald-500"
            />
          </Section>

          {/* ── 5. PENDIENTE POR PAGAR ─────────────────────── */}
          <Section
            title="Pendiente por pagar"
            subtitle={`Acumulado de los últimos ${contracts.length} contratos: ${formatCOP(stats.totalPendiente)}`}
          >
            <BarChart
              items={stats.contractsWithValue}
              valueKey="pendiente"
              maxValue={Math.max(...stats.contractsWithValue.map((c) => c.valor))}
              barClass="from-amber-600 to-amber-400"
              legendSwatchClass="bg-amber-500"
              secondaryLabel="Histórico adjudicado"
            />
          </Section>
        </div>

        {/* ── RIGHT SIDEBAR ───────────────────────────────── */}
        <div className="space-y-6">
          {/* Summary stats */}
          <Section title="Resumen">
            <dl className="space-y-3 text-sm">
              <StatRow label="Contratos totales" value={String(contracts.length)} />
              <StatRow label="Valor total adjudicado" value={formatCOP(stats.totalValor)} />
              <StatRow
                label="Total pagado"
                value={formatCOP(stats.totalPagado)}
                highlight="green"
              />
              <StatRow
                label="Pendiente por pagar"
                value={formatCOP(stats.totalPendiente)}
                highlight="amber"
              />
              <StatRow label="Entidades contratantes" value={String(stats.entidades.length)} />
              <StatRow label="Departamentos" value={String(stats.departamentos.length)} />
            </dl>
          </Section>

          {/* Registro */}
          <Section title="Registro" icon="calendar">
            <p className="text-xs text-[var(--color-muted)]">Primer contrato registrado en SECOP</p>
            {contracts.at(-1)?.fecha_de_firma && (
              <p className="mt-1 font-semibold">{formatDate(contracts.at(-1)?.fecha_de_firma)}</p>
            )}
          </Section>

          {/* Perfil de contratista */}
          <Section title="Perfil de Contratista" icon="briefcase">
            <p className="text-xs text-[var(--color-muted)]">
              Este proveedor está registrado para participar en procesos de contratación estatal
              bajo la modalidad de <strong>{companyType}</strong>.
            </p>
          </Section>

          {/* Estado de contratos */}
          {Object.keys(stats.estados).length > 0 && (
            <Section title="Estado de contratos">
              <dl className="space-y-2 text-sm">
                {Object.entries(stats.estados)
                  .sort((a, b) => b[1] - a[1])
                  .map(([estado, count]) => (
                    <div key={estado} className="flex items-center justify-between gap-2">
                      <dt className="text-[var(--color-muted)]">{estado}</dt>
                      <dd className="font-semibold tabular-nums">{count}</dd>
                    </div>
                  ))}
              </dl>
            </Section>
          )}

          {/* Top entidades */}
          {stats.entidades.length > 0 && (
            <Section title="Entidades contratantes">
              <ul className="space-y-1.5 text-xs text-[var(--color-muted)]">
                {stats.entidades.slice(0, 5).map((e) => (
                  <li key={e}>
                    <Link
                      href={`/entidad/${encodeURIComponent(e)}`}
                      className="hover:text-[var(--color-primary)] hover:underline"
                    >
                      {e}
                    </Link>
                  </li>
                ))}
                {stats.entidades.length > 5 && (
                  <li className="text-[var(--color-muted)]">+{stats.entidades.length - 5} más</li>
                )}
              </ul>
            </Section>
          )}
        </div>
      </div>

      {/* ── 6. CONTRACT HISTORY ──────────────────────────────── */}
      <div className="mt-8">
        <h2 className="mb-4 rounded-md bg-[var(--color-primary)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--color-primary)] inline-block">
          Histórico de contratos
        </h2>
        <div className="space-y-3">
          {contracts.map((contract, i) => (
            <ContractCard key={contract.id_contrato ?? i} contract={contract} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] p-5">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 font-semibold">
          {icon === "contact" && (
            <svg
              role="img"
              aria-label="Contacto"
              className="h-4 w-4 text-[var(--color-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          )}
          {icon === "person" && (
            <svg
              role="img"
              aria-label="Persona"
              className="h-4 w-4 text-[var(--color-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          )}
          {icon === "calendar" && (
            <svg
              role="img"
              aria-label="Calendario"
              className="h-4 w-4 text-[var(--color-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          )}
          {icon === "briefcase" && (
            <svg
              role="img"
              aria-label="Perfil"
              className="h-4 w-4 text-[var(--color-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          )}
          {title}
        </h3>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function InfoField({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="mb-0.5 flex items-center gap-1 text-xs uppercase tracking-wide text-[var(--color-muted)]">
        {icon === "pin" && (
          <svg
            role="img"
            aria-label="Ubicación"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
        )}
        {icon === "id" && (
          <svg
            role="img"
            aria-label="Identificación"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1"
            />
          </svg>
        )}
        {icon === "person" && (
          <svg
            role="img"
            aria-label="Persona"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )}
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "green" | "amber";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd
        className={`font-semibold tabular-nums ${
          highlight === "green"
            ? "text-emerald-600 dark:text-emerald-400"
            : highlight === "amber"
              ? "text-amber-600 dark:text-amber-400"
              : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * CSS bar chart — no external dependencies.
 * Each bar represents one contract, sized proportionally to its value.
 * Hovering a bar reveals a styled tooltip with the contract details.
 */
function BarChart({
  items,
  valueKey,
  maxValue,
  barClass,
  legendSwatchClass,
  secondaryLabel,
}: {
  items: ProviderStats["contractsWithValue"];
  valueKey: "pagado" | "pendiente";
  maxValue: number;
  /** Gradient classes for the value bar (e.g. "from-emerald-600 to-emerald-400"). */
  barClass: string;
  /** Flat class for the legend swatch (e.g. "bg-emerald-500"). */
  legendSwatchClass: string;
  secondaryLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">Sin datos disponibles.</p>;
  }

  const safeMax = maxValue > 0 ? maxValue : 1;
  const valueLabel = valueKey === "pagado" ? "Pagado" : "Pendiente";

  return (
    <div>
      <div className="flex h-32 items-stretch gap-[3px]">
        {items.map((item, index) => {
          const val = item[valueKey];
          const valPct = Math.max((val / safeMax) * 100, val > 0 ? 4 : 0);
          const totalPct = Math.max((item.valor / safeMax) * 100, item.valor > 0 ? 2 : 0);

          return (
            <div key={item.id || `bar-${index}`} className="group relative min-w-0 flex-1">
              {/* Total value bar (background) — anchored to bottom */}
              <div
                className="absolute bottom-0 w-full rounded-t-[3px] bg-[var(--color-border)]/70 transition-opacity group-hover:opacity-40"
                style={{ height: `${totalPct}%` }}
              />
              {/* Value bar (foreground) — gradient, grows on hover */}
              <div
                className={`absolute bottom-0 w-full origin-bottom rounded-t-[3px] bg-gradient-to-t ${barClass} transition-transform duration-150 group-hover:scale-y-[1.04] group-hover:brightness-110`}
                style={{ height: `${valPct}%` }}
              />

              {/* Tooltip — CSS-only, appears above the bar */}
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-52 -translate-x-1/2 group-hover:block">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-left shadow-lg shadow-black/10">
                  <p className="mb-1 line-clamp-2 text-xs font-semibold leading-snug">
                    {item.entidad || "Entidad no especificada"}
                  </p>
                  {item.fecha && (
                    <p className="mb-2 text-[11px] text-[var(--color-muted)]">
                      {formatDate(item.fecha)}
                    </p>
                  )}
                  <dl className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--color-muted)]">Adjudicado</dt>
                      <dd className="font-semibold tabular-nums">{formatCOP(item.valor)}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--color-muted)]">Pagado</dt>
                      <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCOP(item.pagado)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[var(--color-muted)]">Pendiente</dt>
                      <dd className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                        {formatCOP(item.pendiente)}
                      </dd>
                    </div>
                  </dl>
                </div>
                {/* Arrow */}
                <div className="mx-auto h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-[var(--color-border)] bg-[var(--color-background)]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Baseline */}
      <div className="mt-px h-px w-full bg-[var(--color-border)]" />

      {secondaryLabel && (
        <p className="mt-1 text-center text-xs text-[var(--color-muted)]">{secondaryLabel}</p>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-4 rounded-sm ${legendSwatchClass}`} />
          {valueLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm bg-[var(--color-border)]/70" />
          Adjudicado
        </span>
      </div>
    </div>
  );
}
