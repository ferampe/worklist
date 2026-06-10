import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

async function getWorkspaceId(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { workspaceId: true } } },
  });
  return card?.column.workspaceId ?? null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cardId } = await params;
  const workspaceId = await getWorkspaceId(cardId);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Text required" }, { status: 400 });

  const last = await prisma.subtask.findFirst({ where: { cardId }, orderBy: { position: "desc" } });
  const position = (last?.position ?? 0) + 1000;

  const subtask = await prisma.subtask.create({ data: { cardId, text: text.trim(), position } });
  return NextResponse.json(subtask, { status: 201 });
}
