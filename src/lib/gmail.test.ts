import assert from "node:assert/strict";
import test from "node:test";
import { createMimeMessage } from "./gmail";

test("여러 수신자를 To가 아닌 Bcc 헤더에 넣는다", () => {
  const raw = createMimeMessage({
    from: "sender@example.com",
    bcc: ["first@example.com", "second@example.com"],
    subject: "격주 뉴스레터",
    html: "<p>본문</p>",
  });
  const mime = Buffer.from(raw, "base64url").toString("utf8");

  assert.match(mime, /^To: undisclosed-recipients:;$/m);
  assert.match(mime, /^Bcc: first@example\.com, second@example\.com$/m);
  assert.doesNotMatch(mime, /^To: .*first@example\.com/m);
  assert.doesNotMatch(mime, /^To: .*second@example\.com/m);
});
