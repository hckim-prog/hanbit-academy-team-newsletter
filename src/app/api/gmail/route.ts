import { NextResponse } from "next/server";
import { deliverNewsletterViaGmail, parseRecipientList } from "@/lib/gmail";
import { GMAIL_SESSION_COOKIE, openGmailSession } from "@/lib/gmail-session";

export const runtime = "nodejs";

type RequestBody = {
  recipients?: string;
  subject?: string;
  html?: string;
  mode?: "send" | "draft";
  confirmed?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const mode = body.mode ?? "send";
    const sessionValue = request.headers
      .get("cookie")
      ?.split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${GMAIL_SESSION_COOKIE}=`))
      ?.split("=")[1];
    const session = openGmailSession(sessionValue ? decodeURIComponent(sessionValue) : undefined);

    if (mode === "send" && !body.confirmed) {
      return NextResponse.json({ error: "발송 확인 체크가 필요합니다." }, { status: 400 });
    }

    const recipients = parseRecipientList(body.recipients ?? process.env.ACADEMY_NEWSLETTER_RECIPIENTS ?? "");
    if (!recipients.length) {
      return NextResponse.json({ error: "받는 사람 이메일을 입력해 주세요." }, { status: 400 });
    }

    const subject = (body.subject ?? "").trim();
    if (!subject) {
      return NextResponse.json({ error: "메일 제목이 비어 있습니다." }, { status: 400 });
    }

    const html = (body.html ?? "").trim();
    if (!html) {
      return NextResponse.json({ error: "뉴스레터 HTML 본문이 비어 있습니다." }, { status: 400 });
    }

    const result = await deliverNewsletterViaGmail({
      bcc: recipients,
      subject,
      html,
      mode,
      refreshToken: session?.refreshToken,
      senderEmail: session?.email,
    });

    return NextResponse.json({
      ok: true,
      id: result.id,
      mode: result.mode,
      recipientCount: recipients.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail 처리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
