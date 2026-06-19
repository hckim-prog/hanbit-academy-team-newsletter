import { OAuth2Client } from "google-auth-library";

type GmailMode = "send" | "draft";

type GmailPayload = {
  to: string[];
  subject: string;
  html: string;
  mode: GmailMode;
};

type GmailResult = {
  id: string;
  mode: GmailMode;
};

export async function deliverNewsletterViaGmail(payload: GmailPayload): Promise<GmailResult> {
  const accessToken = await getGmailAccessToken();
  const sender = process.env.GMAIL_SENDER_EMAIL || (await getGoogleAccountEmail(accessToken));
  const raw = createMimeMessage({
    from: sender,
    to: sender,
    bcc: payload.to,
    subject: payload.subject,
    html: payload.html,
  });

  const endpoint =
    payload.mode === "draft"
      ? "https://gmail.googleapis.com/gmail/v1/users/me/drafts"
      : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
  const body = payload.mode === "draft" ? { message: { raw } } : { raw };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gmail ${payload.mode === "draft" ? "임시보관함 생성" : "발송"} 실패: ${detail.slice(0, 500)}`);
  }

  const result = (await response.json()) as { id?: string; message?: { id?: string } };
  return {
    id: result.id ?? result.message?.id ?? "",
    mode: payload.mode,
  };
}

function createMimeMessage({
  from,
  to,
  bcc,
  subject,
  html,
}: {
  from: string;
  to: string;
  bcc: string[];
  subject: string;
  html: string;
}) {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Bcc: ${bcc.join(", ")}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  const mime = `${headers.join("\r\n")}\r\n\r\n${html}`;
  return Buffer.from(mime).toString("base64url");
}

async function getGmailAccessToken() {
  assertGmailConfig();
  const client = new OAuth2Client(
    requiredEnv("GMAIL_CLIENT_ID"),
    requiredEnv("GMAIL_CLIENT_SECRET"),
  );
  client.setCredentials({ refresh_token: requiredEnv("GMAIL_REFRESH_TOKEN") });
  const token = await client.getAccessToken();

  if (!token.token) {
    throw new Error("Gmail access token을 만들지 못했습니다.");
  }

  return token.token;
}

async function getGoogleAccountEmail(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google 계정 이메일 확인 실패: ${detail.slice(0, 500)}`);
  }

  const profile = (await response.json()) as { email?: string };
  if (!profile.email) {
    throw new Error("Google 계정 이메일을 확인하지 못했습니다. OAuth scope에 openid와 email을 포함해 주세요.");
  }

  return profile.email;
}

function assertGmailConfig() {
  const missing = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN"].filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Gmail OAuth 환경 변수가 필요합니다: ${missing.join(", ")}`);
  }
}

function encodeMimeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }
  return value;
}

export function parseRecipientList(value: string) {
  const recipients = value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const invalid = recipients.filter((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
  if (invalid.length) {
    throw new Error(`이메일 주소 형식이 올바르지 않습니다: ${invalid.join(", ")}`);
  }

  return [...new Set(recipients)];
}
