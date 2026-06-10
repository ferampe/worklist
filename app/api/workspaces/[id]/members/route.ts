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
