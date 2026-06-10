import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWorkspaceMember } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const access = await requireWorkspaceMember(workspaceId, "viewer");
  if ("error" in access) return access.error;

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json(members.map((m) => ({ ...m.user, role: m.role })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const access = await requireWorkspaceMember(workspaceId, "owner");
  if ("error" in access) return access.error;

  const { email, role = "editor" } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requerido" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  if (existing) return NextResponse.json({ error: "Ya es miembro" }, { status: 409 });

  await prisma.workspaceMember.create({ data: { workspaceId, userId: user.id, role } });

  return NextResponse.json({ ...user, role }, { status: 201 });
}
