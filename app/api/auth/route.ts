import { NextRequest, NextResponse } from "next/server";
import { verifyPasscode, createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { passcode } = await request.json();

  if (typeof passcode !== "string" || !(await verifyPasscode(passcode))) {
    return NextResponse.json({ error: "Incorrect passcode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return response;
}
