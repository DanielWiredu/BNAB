import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { CLMS_SECRET_HEADER, verifyClmsRequest } from "./auth";
import { createCostSheetSchema, createLabourRequestSchema } from "./schemas";
import { createCostSheet, createLabourRequest } from "./inbound";

/**
 * Inbound CLMS route handlers — shared by the canonical `/api/clms/*` routes and
 * the legacy-compatible `/api/GHPACLMS/*` aliases so the external GPHA caller can
 * keep POSTing the exact same JSON to the same path at cutover.
 *
 * Responses mirror the legacy controller shape (200 with a message on success,
 * 200 + "already exists" on idempotent replays).
 */

function headerSecret(req: Request): string | null {
  return req.headers.get(CLMS_SECRET_HEADER);
}

export async function handleCreateLabourRequest(req: Request): Promise<Response> {
  // Gate on the shared secret before parsing an unauthenticated body.
  const gate = verifyClmsRequest({ headerSecret: headerSecret(req) });
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createLabourRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Company key/secret carried in the payload — verified only when configured.
  const companyAuth = verifyClmsRequest({
    headerSecret: headerSecret(req),
    companyKey: parsed.data.companyKey,
    companySecret: parsed.data.companySecret,
  });
  if (!companyAuth.ok) {
    return NextResponse.json({ error: companyAuth.message }, { status: companyAuth.status });
  }

  try {
    const result = await createLabourRequest(parsed.data);
    if (!result.created) {
      return NextResponse.json({ message: "Record with this Id already exists." });
    }
    return NextResponse.json({
      message: "Labour request created successfully",
      labourRequestId: result.labourRequestId,
    });
  } catch (err) {
    logger.error({ err }, "CreateLabourRequest failed");
    return NextResponse.json({ error: "Internal error creating labour request." }, { status: 500 });
  }
}

export async function handleCreateCostSheet(req: Request): Promise<Response> {
  const gate = verifyClmsRequest({ headerSecret: headerSecret(req) });
  if (!gate.ok) return NextResponse.json({ error: gate.message }, { status: gate.status });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createCostSheetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await createCostSheet(parsed.data);
    return NextResponse.json({
      message: "Cost sheet created successfully",
      costSheetId: result.costSheetId,
    });
  } catch (err) {
    logger.error({ err }, "CreateCostSheet failed");
    return NextResponse.json({ error: "Internal error creating cost sheet." }, { status: 500 });
  }
}
