import { NextResponse } from "next/server";
import { createGmailOAuthClient } from "@/lib/gmail";
import { createStateToken, GMAIL_STATE_COOKIE } from "@/lib/gmail-session";

export const runtime = "nodejs";

const scopes = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "openid",
  "email",
];

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/gmail/callback`;
    const state = createStateToken();
    const client = createGmailOAuthClient(redirectUri);
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
      state,
    });
    const response = NextResponse.redirect(url);
    response.cookies.set(GMAIL_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail 연결을 시작하지 못했습니다.";
    return new NextResponse(message, { status: 500 });
  }
}
