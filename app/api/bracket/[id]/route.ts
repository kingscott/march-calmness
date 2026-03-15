import { NextRequest, NextResponse } from "next/server";
import { getBracket, deleteBracket } from "@/lib/db";
import type { Bracket, ApiError } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/bracket/[id] ─────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<Bracket | ApiError>> {
  const { id: idStr } = await params;
  const id = Number(idStr);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid bracket id" }, { status: 400 });
  }

  try {
    const bracket = await getBracket(id);
    if (!bracket) {
      return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
    }
    return NextResponse.json(bracket);
  } catch (err) {
    console.error("[bracket/[id] GET] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/bracket/[id] ──────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: Params,
): Promise<NextResponse<{ deleted: true } | ApiError>> {
  const { id: idStr } = await params;
  const id = Number(idStr);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid bracket id" }, { status: 400 });
  }

  try {
    const deleted = await deleteBracket(id);
    if (!deleted) {
      return NextResponse.json({ error: "Bracket not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[bracket/[id] DELETE] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
