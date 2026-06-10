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
            where: { isArchived: false },
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

  const body = await req.json();

  let publicToken: string | null | undefined = undefined;
  if (body.visibility === "public") {
    const cur = await prisma.workspace.findUnique({ where: { id }, select: { publicToken: true } });
    publicToken = cur?.publicToken ?? crypto.randomUUID();
  } else if (body.visibility === "private") {
    publicToken = null;
  }

  const workspace = await prisma.workspace.update({
    where: { id },
    data: {
      name: body.name,
      visibility: body.visibility,
      columnWidth: body.columnWidth,
      boardBackground: body.boardBackground,
      ...(publicToken !== undefined ? { publicToken } : {}),
    },
  });
  return NextResponse.json(workspace);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireWorkspaceMember(id, "owner");
  if ("error" in access) return access.error;

  await prisma.workspace.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
