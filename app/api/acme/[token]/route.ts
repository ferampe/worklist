import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const challengeDir = join(process.cwd(), "public", ".well-known", "acme-challenge");
  try {
    const content = readFileSync(join(challengeDir, token), "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
