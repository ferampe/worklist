import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireWorkspaceMember } from "@/lib/access";
import { writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function getWorkspaceId(cardId: string) {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { column: { select: { workspaceId: true } } },
  });
  return card?.column.workspaceId ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cardId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await getWorkspaceId(cardId);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "viewer");
  if ("error" in access) return access.error;

  const attachments = await prisma.attachment.findMany({
    where: { cardId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(attachments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: cardId } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await getWorkspaceId(cardId);
  if (!workspaceId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const access = await requireWorkspaceMember(workspaceId, "editor");
  if ("error" in access) return access.error;

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Tipo no permitido" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Archivo muy grande (máx 20 MB)" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await writeFile(path.join(uploadDir, filename), buffer);

  const attachment = await prisma.attachment.create({
    data: {
      cardId,
      storagePath: `uploads/${filename}`,
      url: `/uploads/${filename}`,
      mimeType: file.type,
      size: file.size,
      name: file.name,
    },
  });
  return NextResponse.json(attachment, { status: 201 });
}
