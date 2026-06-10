import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";
import { emit } from "@/lib/emit";

async function getWorkspaceId(columnId: string) {
  const col = await prisma.column.findUnique({ where: { id: columnId }, select: { workspaceId: true } });
  return col?.workspaceId ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId(id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  const data = await req.json();
  const column = await prisma.column.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.color !== undefined && { color: data.color }),
    },
  });
  emit(workspaceId, "column", "updated", column);
  return NextResponse.json(column);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspaceId = await getWorkspaceId(id);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  await prisma.column.delete({ where: { id } });
  emit(workspaceId, "column", "deleted", { id, workspaceId });
  return new NextResponse(null, { status: 204 });
}
