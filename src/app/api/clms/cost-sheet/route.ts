import { handleCreateCostSheet } from "@/server/integrations/clms/handlers";

// Canonical inbound endpoint (was POST /api/GHPACLMS/CreateCostSheet).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(req: Request): Promise<Response> {
  return handleCreateCostSheet(req);
}
