import { NextResponse } from "next/server";
import { GMAIL_SESSION_COOKIE } from "@/lib/gmail-session";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(GMAIL_SESSION_COOKIE);
  return response;
}
