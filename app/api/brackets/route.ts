import { NextResponse } from "next/server";
import { listBrackets } from "@/lib/db";
import type { BracketListResponse, ApiError } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<BracketListResponse | ApiError>> {
  try {
    const brackets = listBrackets();
    return NextResponse.json({ brackets });
  } catch (err) {
    console.error("[brackets] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
