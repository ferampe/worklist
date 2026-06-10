import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: session.user.id },
    include: { workspace: { include: { _count: { select: { columns: true } } } } },
    orderBy: { workspace: { createdAt: "desc" } },
  });

  return NextResponse.json(memberships.map((m) => ({ ...m.workspace, role: m.role })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      ownerId: session.user.id,
      members: { create: { userId: session.user.id, role: "owner" } },
    },
  });

  return NextResponse.json(workspace, { status: 201 });
}
