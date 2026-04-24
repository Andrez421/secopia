/**
 * /api/health — Health check endpoint
 *
 * Returns a simple OK response for monitoring and load balancers.
 */

export const runtime = "edge";

export async function GET() {
  return Response.json({ status: "ok" });
}
