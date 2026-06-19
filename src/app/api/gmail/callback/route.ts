import { NextResponse } from "next/server";
import { createGmailOAuthClient, getGoogleAccountEmail } from "@/lib/gmail";
import { GMAIL_SESSION_COOKIE, GMAIL_STATE_COOKIE, sealGmailSession, secureCompare } from "@/lib/gmail-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const expectedState = request.headers
      .get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${GMAIL_STATE_COOKIE}=`))
      ?.split("=")[1];

    if (!code || !state || !expectedState || !secureCompare(state, decodeURIComponent(expectedState))) {
      return new NextResponse("Gmail OAuth state is invalid.", { status: 400 });
    }

    const origin = url.origin;
    const client = createGmailOAuthClient(`${origin}/api/gmail/callback`);
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) {
      return new NextResponse("Gmail refresh token이 없습니다. Google 계정 권한을 해제한 뒤 다시 연결해 주세요.", { status: 400 });
    }

    client.setCredentials(tokens);
    const accessToken = tokens.access_token ?? (await client.getAccessToken()).token;
    if (!accessToken) {
      return new NextResponse("Gmail access token을 만들지 못했습니다.", { status: 400 });
    }

    const email = await getGoogleAccountEmail(accessToken);
    const response = NextResponse.redirect(new URL("/?gmail=connected", origin));
    response.cookies.set(GMAIL_SESSION_COOKIE, sealGmailSession({
      email,
      refreshToken: tokens.refresh_token,
      createdAt: Date.now(),
    }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    });
    response.cookies.delete(GMAIL_STATE_COOKIE);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail 연결 처리 중 오류가 발생했습니다.";
    return new NextResponse(message, { status: 500 });
  }
}
