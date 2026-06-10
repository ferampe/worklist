import { getIO } from "./socket-server";

type Entity = "card" | "column";
type Action = "created" | "updated" | "deleted";

export function emit(workspaceId: string, entity: Entity, action: Action, payload: unknown) {
  const io = getIO();
  if (!io) return;
  io.to(`workspace:${workspaceId}`).emit(`${entity}:${action}`, payload);
}
