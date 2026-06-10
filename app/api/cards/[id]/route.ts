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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId(id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "viewer");
  if ("error" in access) return access.error;

  const card = await prisma.card.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
      subtasks: { orderBy: { position: "asc" } },
      attachments: true,
    },
  });
  return NextResponse.json(card);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId(id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  const data = await req.json();
  const card = await prisma.card.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      isDone: data.isDone,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      assigneeId: data.assigneeId,
      columnId: data.columnId,
      position: data.position,
    },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
      _count: { select: { subtasks: true } },
    },
  });
  return NextResponse.json(card);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId(id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  await prisma.card.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
