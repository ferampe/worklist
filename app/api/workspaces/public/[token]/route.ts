import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const workspace = await prisma.workspace.findUnique({
    where: { publicToken: token, visibility: "public" },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: { isArchived: false },
            orderBy: { position: "asc" },
            include: {
              assignee: { select: { id: true, name: true, image: true } },
              _count: { select: { subtasks: true } },
            },
          },
        },
      },
    },
  });

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(workspace);
}
