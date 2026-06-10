import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

type Params = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: workspaceId, userId } = await params;
  const access = await requireWorkspaceMember(workspaceId, "owner");
  if ("error" in access) return access.error;

  if (userId === access.userId) {
    return NextResponse.json({ error: "No puedes cambiar tu propio rol" }, { status: 400 });
  }

  const { role } = await req.json();
  await prisma.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId } },
    data: { role },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: workspaceId, userId } = await params;
  const access = await requireWorkspaceMember(workspaceId, "owner");
  if ("error" in access) return access.error;

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "No se puede eliminar al owner" }, { status: 400 });
  }

  await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } });

  return new NextResponse(null, { status: 204 });
}
