import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/access";
import { unlink } from "fs/promises";
import path from "path";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { card: { select: { column: { select: { workspaceId: true } } } } },
  });
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(attachment.card.column.workspaceId, "editor");
  if ("error" in access) return access.error;

  try {
    await unlink(path.join(process.cwd(), "public", attachment.storagePath));
  } catch {
    // File may already be gone — continue
  }

  await prisma.attachment.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
