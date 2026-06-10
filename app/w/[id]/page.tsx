import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BoardClient } from "./board-client";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  return <BoardClient workspaceId={id} />;
}
