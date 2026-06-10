import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: columnId } = await params;

  const column = await prisma.column.findUnique({ where: { id: columnId }, select: { workspaceId: true } });
  if (!column) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(column.workspaceId, "viewer");
  if ("error" in access) return access.error;

  const cards = await prisma.card.findMany({
    where: { columnId, isArchived: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      columnId: true,
      title: true,
      color: true,
      isDone: true,
      isArchived: true,
      dueDate: true,
      position: true,
      description: true,
      assignee: { select: { id: true, name: true, image: true } },
      _count: { select: { subtasks: true } },
    },
  });

  return NextResponse.json(cards);
}
