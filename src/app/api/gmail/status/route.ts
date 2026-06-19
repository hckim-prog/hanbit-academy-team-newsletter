import { NextResponse } from "next/server";
import { getMissingGmailOAuthConfig } from "@/lib/gmail";
import { GMAIL_SESSION_COOKIE, openGmailSession } from "@/lib/gmail-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const sessionValue = cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${GMAIL_SESSION_COOKIE}=`))
    ?.split("=")[1];
  const session = openGmailSession(sessionValue ? decodeURIComponent(sessionValue) : undefined);
  const missing = getMissingGmailOAuthConfig();

  return NextResponse.json({
    configured: missing.length === 0,
    connected: Boolean(session || process.env.GMAIL_REFRESH_TOKEN),
    email: session?.email || process.env.GMAIL_SENDER_EMAIL || null,
    missing,
  });
}
