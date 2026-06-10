import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const last = await prisma.column.findFirst({
    where: { workspaceId },
    orderBy: { position: "desc" },
  });
  const position = (last?.position ?? 0) + 1000;

  const column = await prisma.column.create({
    data: { workspaceId, name: name.trim(), position },
    include: { cards: true },
  });

  return NextResponse.json(column, { status: 201 });
}
