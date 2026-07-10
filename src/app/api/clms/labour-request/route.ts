import { handleCreateLabourRequest } from "@/server/integrations/clms/handlers";

// Canonical inbound endpoint (was POST /api/GHPACLMS/CreateLabourRequest).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request): Promise<Response> {
  return handleCreateLabourRequest(req);
}
