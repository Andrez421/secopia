/**
 * /api/chat — AI Chat API Route
 *
 * Streaming chat with Google Gemini via Vercel AI SDK v6.
 * Tools execute Socrata queries DIRECTLY (no MCP HTTP hop).
 *
 * SECURITY:
 * - Rate limited: 10 req/60s per IP (LLM calls are expensive)
 * - All tool queries go through SoQLBuilder (sanitized)
 * - Streaming response via Server-Sent Events
 *
 * ENV: GOOGLE_GENERATIVE_AI_API_KEY
 */

import { getChatRateLimiter, getClientIp } from "@/lib/rate-limit";
import { getSocrataClient } from "@/lib/socrata";
import { google } from "@ai-sdk/google";
import { DATASETS, SoQLBuilder } from "@secopia/socrata-client";
import { type UIMessage, convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";

export const runtime = "edge";
export const maxDuration = 60;

const SYSTEM_PROMPT = `Eres Secopia, un asistente experto en contratación pública de Colombia.
Consultas datos reales de SECOP I y II (Sistema Electrónico de Contratación Pública).

Reglas:
- Responde siempre en español.
- Cuando el usuario pregunte sobre contratos, entidades o proveedores, usa las herramientas disponibles.
- Cita datos exactos: valores en pesos colombianos, fechas, nombres de entidades y proveedores.
- Menciona que los datos provienen de SECOP/datos.gov.co.
- Si no encuentras resultados, sugiere reformular la búsqueda con términos más amplios.
- Sé conciso pero informativo. Presenta los datos de forma clara y organizada.
- Si el usuario pide análisis, calcula totales, promedios o distribuciones con los datos obtenidos.`;

export async function POST(req: Request) {
  try {
    // ── 1. Rate Limiting ────────────────────────────────────

    const ip = getClientIp(req);
    const { success } = await getChatRateLimiter().limit(ip);

    if (!success) {
      return Response.json(
        { error: "Has alcanzado el límite de mensajes. Espera un momento." },
        { status: 429 },
      );
    }

    // ── 2. Validate Body ──────────────────────────────────

    const rawBody = await req.text();
    if (rawBody.length > 4000) {
      return Response.json(
        { error: "Payload demasiado grande. Máximo 4000 caracteres." },
        { status: 400 },
      );
    }

    const messageSchema = z.object({
      role: z.string(),
      content: z.string(),
    });

    const bodySchema = z.object({
      messages: z.array(messageSchema).min(1, "Se requiere al menos un mensaje"),
    });

    let parsed: z.infer<typeof bodySchema>;
    try {
      parsed = bodySchema.parse(JSON.parse(rawBody));
    } catch {
      return Response.json({ error: "Formato de mensajes inválido." }, { status: 400 });
    }

    const messages = parsed.messages as unknown as UIMessage[];
    const client = getSocrataClient();

    // ── 3. Stream with Tools ──────────────────────────────

    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      tools: {
        buscar_contratos: tool({
          description:
            "Busca contratos en SECOP II por entidad, proveedor, departamento, valor o fecha. Devuelve los contratos más recientes.",
          inputSchema: z.object({
            entidad: z.string().optional().describe("Nombre de la entidad contratante"),
            proveedor: z.string().optional().describe("Nombre del proveedor/contratista"),
            departamento: z.string().optional().describe("Departamento (ej: BOGOTA)"),
            valor_min: z.number().optional().describe("Valor mínimo en COP"),
            valor_max: z.number().optional().describe("Valor máximo en COP"),
            fecha_inicio: z.string().optional().describe("Fecha desde (YYYY-MM-DD)"),
            fecha_fin: z.string().optional().describe("Fecha hasta (YYYY-MM-DD)"),
            limite: z.number().min(1).max(50).default(10).describe("Máximo resultados"),
          }),
          execute: async (args) => {
            const ds = DATASETS.contratos;
            const q = new SoQLBuilder();
            if (args.entidad) q.like(ds.campos.entidad, args.entidad);
            if (args.proveedor) q.like(ds.campos.proveedor, args.proveedor);
            if (args.departamento) q.equals(ds.campos.departamento, args.departamento);
            if (args.valor_min) q.gte(ds.campos.valor, args.valor_min);
            if (args.valor_max) q.lte(ds.campos.valor, args.valor_max);
            if (args.fecha_inicio) q.gte(ds.campos.fecha_firma, args.fecha_inicio);
            if (args.fecha_fin) q.lte(ds.campos.fecha_firma, args.fecha_fin);
            q.orderBy(ds.campos.fecha_firma).limit(args.limite);
            return await client.query(ds.id, q.build());
          },
        }),

        buscar_procesos: tool({
          description:
            "Busca procesos de contratación en SECOP II por entidad, descripción o departamento.",
          inputSchema: z.object({
            entidad: z.string().optional().describe("Nombre de la entidad"),
            descripcion: z.string().optional().describe("Texto en la descripción"),
            departamento: z.string().optional().describe("Departamento"),
            limite: z.number().min(1).max(50).default(10),
          }),
          execute: async (args) => {
            const ds = DATASETS.procesos;
            const q = new SoQLBuilder();
            if (args.entidad) q.like(ds.campos.entidad, args.entidad);
            if (args.descripcion) q.like(ds.campos.descripcion, args.descripcion);
            if (args.departamento) q.equals(ds.campos.departamento, args.departamento);
            q.orderBy(ds.campos.fecha_firma).limit(args.limite);
            return await client.query(ds.id, q.build());
          },
        }),

        buscar_secop1: tool({
          description:
            "Busca procesos históricos en SECOP I (datos desde 2011). Útil cuando no hay resultados en SECOP II.",
          inputSchema: z.object({
            entidad: z.string().optional().describe("Nombre de la entidad"),
            objeto: z.string().optional().describe("Objeto a contratar"),
            departamento: z.string().optional().describe("Departamento"),
            limite: z.number().min(1).max(50).default(10),
          }),
          execute: async (args) => {
            const ds = DATASETS.secop1;
            const q = new SoQLBuilder();
            if (args.entidad) q.like(ds.campos.entidad, args.entidad);
            if (args.objeto) q.like(ds.campos.descripcion, args.objeto);
            if (args.departamento) q.equals(ds.campos.departamento, args.departamento);
            q.orderBy(ds.campos.fecha_firma).limit(args.limite);
            return await client.query(ds.id, q.build());
          },
        }),

        buscar_por_documento: tool({
          description:
            "Busca contratos de un proveedor por su número de documento/NIT en SECOP II.",
          inputSchema: z.object({
            documento: z.string().describe("Número de documento o NIT del proveedor"),
            anio: z.number().optional().describe("Año de los contratos (ej: 2024)"),
            limite: z.number().min(1).max(50).default(10),
          }),
          execute: async (args) => {
            const ds = DATASETS.contratos;
            const q = new SoQLBuilder();
            q.equals(ds.campos.documento_proveedor, args.documento);
            if (args.anio) {
              q.gte(ds.campos.fecha_firma, `${args.anio}-01-01T00:00:00.000`);
              q.lte(ds.campos.fecha_firma, `${args.anio}-12-31T23:59:59.000`);
            }
            q.orderBy(ds.campos.fecha_firma).limit(args.limite);
            return await client.query(ds.id, q.build());
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse();
  } catch {
    return Response.json(
      { error: "Error procesando el mensaje. Intenta de nuevo." },
      { status: 500 },
    );
  }
}
