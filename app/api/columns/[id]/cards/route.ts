import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: columnId } = await params;
  const column = await prisma.column.findUnique({ where: { id: columnId }, select: { workspaceId: true } });
  if (!column) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(column.workspaceId, "editor");
  if ("error" in access) return access.error;

  const { title } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const last = await prisma.card.findFirst({ where: { columnId }, orderBy: { position: "desc" } });
  const position = (last?.position ?? 0) + 1000;

  const card = await prisma.card.create({
    data: { columnId, title: title.trim(), position },
    include: { assignee: { select: { id: true, name: true, image: true } }, _count: { select: { subtasks: true } } },
  });

  return NextResponse.json(card, { status: 201 });
}
