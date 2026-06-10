import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireWorkspaceMember(id, "viewer");
  if ("error" in access) return access.error;

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            orderBy: { position: "asc" },
            include: { assignee: { select: { id: true, name: true, image: true } }, _count: { select: { subtasks: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json(workspace);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireWorkspaceMember(id, "owner");
  if ("error" in access) return access.error;

  const { name } = await req.json();
  const workspace = await prisma.workspace.update({ where: { id }, data: { name } });
  return NextResponse.json(workspace);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireWorkspaceMember(id, "owner");
  if ("error" in access) return access.error;

  await prisma.workspace.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
