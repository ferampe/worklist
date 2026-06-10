import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer) {
  if (io) return io;
  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    socket.on("join-workspace", (workspaceId: string) => {
      socket.join(`workspace:${workspaceId}`);
    });
    socket.on("leave-workspace", (workspaceId: string) => {
      socket.leave(`workspace:${workspaceId}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}
