import { NextRequest, NextResponse } from "next/server";
import { insertBracket } from "@/lib/db";
import { parseBracketPdf, BracketParseError } from "@/lib/bracket-parser";
import type { UploadResponse, ApiError } from "@/lib/types";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<UploadResponse | ApiError>> {
  // ── Parse multipart form ────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const name = formData.get("name");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field (must be a PDF)" }, { status: 400 });
  }
  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json({ error: "Missing 'name' field" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }

  // ── Parse bracket via Claude ────────────────────────────────────────────────
  try {
    const pdfArrayBuffer = await file.arrayBuffer();
    const { picks } = await parseBracketPdf(pdfArrayBuffer);
    const bracket = await insertBracket(name.trim(), picks);
    return NextResponse.json({ bracket }, { status: 201 });
  } catch (err) {
    if (err instanceof BracketParseError) {
      return NextResponse.json(
        { error: `Bracket parsing failed: ${err.message}` },
        { status: 422 },
      );
    }
    console.error("[bracket/upload] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
