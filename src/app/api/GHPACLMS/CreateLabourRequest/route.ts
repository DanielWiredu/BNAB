import { handleCreateLabourRequest } from "@/server/integrations/clms/handlers";

// Legacy-compatible alias: keeps the exact path GPHA already posts to, so the
// external feed needs no change at cutover. Same handler as /api/clms/labour-request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request): Promise<Response> {
  return handleCreateLabourRequest(req);
}
