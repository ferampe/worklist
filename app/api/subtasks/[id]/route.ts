import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

async function getWorkspaceId(subtaskId: string) {
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    select: { card: { select: { column: { select: { workspaceId: true } } } } },
  });
  return subtask?.card.column.workspaceId ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId(id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  const data = await req.json();
  const subtask = await prisma.subtask.update({
    where: { id },
    data: { text: data.text, isDone: data.isDone },
  });
  return NextResponse.json(subtask);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId(id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  await prisma.subtask.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
