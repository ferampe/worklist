import { PublicBoardClient } from "./public-board-client";

export default async function PublicBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicBoardClient token={token} />;
}
