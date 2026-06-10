import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export default function proxy(req: NextRequest) {
  // Static uploads are public — skip auth entirely
  if (req.nextUrl.pathname.startsWith("/uploads/")) {
    return NextResponse.next();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (auth as any)(req);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
