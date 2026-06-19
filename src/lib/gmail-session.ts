import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const GMAIL_SESSION_COOKIE = "gmail_session";
export const GMAIL_STATE_COOKIE = "gmail_oauth_state";

export type GmailSession = {
  email: string;
  refreshToken: string;
  createdAt: number;
};

export function createStateToken() {
  return randomBytes(24).toString("base64url");
}

export function sealGmailSession(session: GmailSession) {
  const iv = randomBytes(12);
  const key = sessionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((item) => item.toString("base64url")).join(".");
}

export function openGmailSession(value?: string): GmailSession | null {
  if (!value) {
    return null;
  }

  try {
    const [ivPart, tagPart, ciphertextPart] = value.split(".");
    if (!ivPart || !tagPart || !ciphertextPart) {
      return null;
    }

    const decipher = createDecipheriv("aes-256-gcm", sessionKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");

    const session = JSON.parse(plaintext) as GmailSession;
    if (!session.email || !session.refreshToken) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionKey() {
  const secret = process.env.GMAIL_SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("GMAIL_SESSION_SECRET 환경 변수가 필요합니다.");
  }
  return createHash("sha256").update(secret || "local-development-gmail-session-secret").digest();
}
