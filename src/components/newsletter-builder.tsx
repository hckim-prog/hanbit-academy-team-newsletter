"use client";

import {
  ArrowDownToLine,
  CheckCircle2,
  Copy,
  Image as ImageIcon,
  Loader2,
  Mail,
  MailCheck,
  RefreshCw,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GenerateNewsletterResponse, Newsletter } from "@/lib/types";

const statusTone = {
  idle: "border-white/10 bg-white/[0.04] text-zinc-300",
  working: "border-[#d7ff64]/30 bg-[#d7ff64]/10 text-[#eaff9a]",
  done: "border-[#70e3b1]/30 bg-[#70e3b1]/10 text-[#b9f7d8]",
  error: "border-[#ff7a59]/40 bg-[#ff7a59]/10 text-[#ffc0b0]",
};

type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  missing: string[];
};

type WritingStyle = "concise" | "expand" | "natural";

export function NewsletterBuilder() {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [status, setStatus] = useState("대기 중입니다.");
  const [statusKind, setStatusKind] = useState<keyof typeof statusTone>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [subject, setSubject] = useState("");
  const [recipients, setRecipients] = useState("");
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const editedNewsletterRef = useRef<Newsletter | null>(null);

  function setUiStatus(message: string, kind: keyof typeof statusTone = "idle") {
    setStatus(message);
    setStatusKind(kind);
  }

  const refreshGmailStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/gmail/status");
      const payload = (await response.json()) as GmailStatus;
      setGmailStatus(payload);
      if (new URLSearchParams(window.location.search).get("gmail") === "connected") {
        setUiStatus(`${payload.email ?? "Gmail"} 계정 연결이 완료되었습니다.`, "done");
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {
      setGmailStatus(null);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshGmailStatus();
  }, [refreshGmailStatus]);

  useEffect(() => {
    setEmailPreviewHtml(newsletter ? buildEmailHtml(editedNewsletterRef.current ?? newsletter, subject) : "");
  }, [newsletter, subject]);

  async function disconnectGmail() {
    await fetch("/api/gmail/disconnect", { method: "POST" });
    await refreshGmailStatus();
    setUiStatus("Gmail 연결을 해제했습니다.", "idle");
  }

  async function generate() {
    setIsLoading(true);
    setUiStatus(includeImages ? "시트와 이미지를 함께 준비하는 중입니다." : "시트를 읽고 초안을 정리하는 중입니다.", "working");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: includeImages, imageSeed: createImageSeed() }),
      });
      const payload = (await response.json()) as GenerateNewsletterResponse & { error?: string };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "뉴스레터 생성에 실패했습니다.");
      }

      setNewsletter(payload.newsletter);
      editedNewsletterRef.current = payload.newsletter;
      setSubject(payload.newsletter.subject);
      window.setTimeout(updateEmailPreview, 50);
      setUiStatus("초안을 만들었습니다. 가운데 발송본 미리보기에서 실제 Gmail 형태를 확인해 주세요.", "done");
    } catch (error) {
      setUiStatus(error instanceof Error ? error.message : "오류가 발생했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function polishWriting(style: WritingStyle) {
    if (!newsletter) {
      return;
    }

    const styleLabels: Record<WritingStyle, string> = {
      concise: "짧게",
      expand: "자세히",
      natural: "자연스럽게",
    };

    setIsLoading(true);
    setUiStatus(`전체 문장을 ${styleLabels[style]} 다듬는 중입니다.`, "working");

    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletter: getEditedNewsletter(), style }),
      });
      const payload = (await response.json()) as { newsletter?: Newsletter; error?: string };

      if (!response.ok || payload.error || !payload.newsletter) {
        throw new Error(payload.error ?? "문장체 다듬기에 실패했습니다.");
      }

      setNewsletter(payload.newsletter);
      editedNewsletterRef.current = payload.newsletter;
      window.setTimeout(updateEmailPreview, 50);
      setUiStatus(`전체 문장을 ${styleLabels[style]} 적용했습니다.`, "done");
    } catch (error) {
      setUiStatus(error instanceof Error ? error.message : "문장체 다듬기 중 오류가 발생했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshImages() {
    if (!newsletter) {
      return;
    }

    setIsLoading(true);
    setUiStatus("같은 내용에 어울리는 다른 이미지를 고르는 중입니다.", "working");

    try {
      const response = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletter, imageSeed: createImageSeed() }),
      });
      const payload = (await response.json()) as { newsletter?: Newsletter; error?: string };

      if (!response.ok || payload.error || !payload.newsletter) {
        throw new Error(payload.error ?? "이미지 새로고침에 실패했습니다.");
      }

      setNewsletter(payload.newsletter);
      editedNewsletterRef.current = payload.newsletter;
      window.setTimeout(updateEmailPreview, 50);
      setUiStatus("이미지를 새 조합으로 바꿨습니다.", "done");
    } catch (error) {
      setUiStatus(error instanceof Error ? error.message : "이미지 새로고침 중 오류가 발생했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyHtml() {
    if (!newsletter) {
      return;
    }
    await navigator.clipboard.writeText(buildEmailHtml(getEditedNewsletter(), subject));
    setUiStatus("HTML을 클립보드에 복사했습니다.", "done");
  }

  function downloadHtml() {
    if (!newsletter) {
      return;
    }
    const html = buildEmailHtml(getEditedNewsletter(), subject);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `dicon-newsletter-${newsletter.sourceDate.replace(/\s+/g, "-")}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    setUiStatus("HTML 파일을 다운로드했습니다.", "done");
  }

  async function deliver(mode: "draft" | "send") {
    if (!newsletter) {
      return;
    }

    if (mode === "send" && !sendConfirmed) {
      setUiStatus("실제 발송 전 확인 체크가 필요합니다.", "error");
      return;
    }

    setIsLoading(true);
    setUiStatus(mode === "draft" ? "Gmail 임시보관함을 만드는 중입니다." : "Gmail로 발송하는 중입니다.", "working");

    try {
      const response = await fetch("/api/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          subject,
          html: buildEmailHtml(getEditedNewsletter(), subject),
          mode,
          confirmed: sendConfirmed,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        id?: string;
        recipientCount?: number;
        error?: string;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Gmail 처리에 실패했습니다.");
      }

      setUiStatus(
        mode === "draft"
          ? `Gmail 임시보관함을 만들었습니다. 대상 ${payload.recipientCount ?? 0}명.`
          : `Gmail 발송을 완료했습니다. 대상 ${payload.recipientCount ?? 0}명.`,
        "done",
      );
    } catch (error) {
      setUiStatus(error instanceof Error ? error.message : "Gmail 처리 중 오류가 발생했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  function updateEmailPreview() {
    if (newsletter) {
      setEmailPreviewHtml(buildEmailHtml(getEditedNewsletter(), subject));
    }
  }

  function getEditedNewsletter() {
    if (!newsletter) {
      throw new Error("뉴스레터가 없습니다.");
    }

    return editedNewsletterRef.current ?? newsletter;
  }

  return (
    <main className="min-h-screen bg-[#111111] text-[#f6f1e8]">
      <div className="grid min-h-screen grid-cols-[420px_minmax(0,1fr)] max-[1180px]:grid-cols-[360px_minmax(0,1fr)] max-[900px]:block">
        <aside className="sticky top-0 h-screen overflow-auto border-r border-white/10 bg-[#111111] p-5 max-[1040px]:static max-[1040px]:h-auto max-[1040px]:border-b max-[1040px]:border-r-0">
          <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#d7ff64]">Hanbit Academy</p>
              <h1 className="mt-2 text-4xl font-black leading-[0.95] tracking-tight">
                TF
                <br />
                Letter
              </h1>
            </div>
            <div className="grid size-16 place-items-center rounded-full border border-white/15 bg-white/[0.04] text-xs font-black text-white">
              BETA
            </div>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400">
            <span className="rounded-full border border-white/10 px-3 py-2 text-center">Sheet</span>
            <span className="rounded-full border border-white/10 px-3 py-2 text-center">Image</span>
            <span className="rounded-full border border-white/10 px-3 py-2 text-center">Gmail</span>
          </div>

          <section className="space-y-4">
            <label className="flex items-center justify-between rounded-[8px] border border-white/10 bg-white/[0.04] p-4 text-sm font-bold">
              <span className="flex items-center gap-2">
                <ImageIcon size={17} />
                이미지 함께 생성
              </span>
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(event) => setIncludeImages(event.target.checked)}
                className="size-5 accent-[#d7ff64]"
              />
            </label>

            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-black">
                  <MailCheck size={17} />
                  Gmail 연결
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${gmailStatus?.connected ? "bg-[#70e3b1]/20 text-[#b9f7d8]" : "bg-[#ff7a59]/15 text-[#ffc0b0]"}`}>
                  {gmailStatus?.connected ? "연결됨" : "대기"}
                </span>
              </div>
              {gmailStatus?.connected ? (
                <div className="grid gap-2">
                  <p className="text-xs leading-5 text-zinc-400">{gmailStatus.email} 계정으로 발송합니다.</p>
                  <button
                    type="button"
                    onClick={disconnectGmail}
                    className="rounded-[8px] border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 transition hover:bg-white/[0.08]"
                  >
                    연결 해제
                  </button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {gmailStatus && !gmailStatus.configured ? (
                    <p className="text-xs leading-5 text-[#ffc0b0]">
                      Vercel에 {gmailStatus.missing.join(", ")} 값이 필요합니다.
                    </p>
                  ) : (
                    <p className="text-xs leading-5 text-zinc-400">처음 한 번만 Gmail 계정을 연결하면 됩니다.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/api/gmail/connect";
                    }}
                    disabled={gmailStatus ? !gmailStatus.configured : true}
                    className="rounded-[8px] border border-[#d7ff64] bg-[#d7ff64] px-3 py-2 text-xs font-black text-[#111111] transition hover:bg-[#e5ff8f] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Gmail 연결
                  </button>
                </div>
              )}
            </div>

            <Field label="메일 제목" htmlFor="subject">
              <input
                id="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="이번 호를 만들면 제목이 들어옵니다"
                className="field-input"
              />
            </Field>

            <Field label="받는 사람" htmlFor="recipients">
              <textarea
                id="recipients"
                value={recipients}
                onChange={(event) => setRecipients(event.target.value)}
                placeholder="academy@example.com, member@example.com"
                rows={4}
                className="field-input resize-y leading-6"
              />
            </Field>
          </section>

          <section className="mt-5 grid gap-2">
            <ActionButton
              onClick={generate}
              disabled={isLoading}
              icon={isLoading ? <Loader2 className="animate-spin" size={18} /> : <WandSparkles size={18} />}
              label="이번 호 만들기"
              variant="primary"
            />
            <div className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-zinc-500">문장 전체 적용</p>
              <div className="grid grid-cols-3 gap-2">
                <ActionButton
                  onClick={() => polishWriting("concise")}
                  disabled={!newsletter || isLoading}
                  icon={<Sparkles size={15} />}
                  label="짧게"
                  compact
                />
                <ActionButton
                  onClick={() => polishWriting("expand")}
                  disabled={!newsletter || isLoading}
                  icon={<Sparkles size={15} />}
                  label="자세히"
                  compact
                />
                <ActionButton
                  onClick={() => polishWriting("natural")}
                  disabled={!newsletter || isLoading}
                  icon={<Sparkles size={15} />}
                  label="자연스럽게"
                  compact
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <ActionButton
                onClick={refreshImages}
                disabled={!newsletter || isLoading}
                icon={<RefreshCw size={17} />}
                label="이미지 새로고침"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton onClick={copyHtml} disabled={!newsletter || isLoading} icon={<Copy size={17} />} label="HTML 복사" />
              <ActionButton
                onClick={downloadHtml}
                disabled={!newsletter || isLoading}
                icon={<ArrowDownToLine size={17} />}
                label="다운로드"
              />
            </div>
            <ActionButton onClick={() => deliver("draft")} disabled={!newsletter || isLoading} icon={<Mail size={18} />} label="Gmail 임시보관함" />

            <label className="mt-2 flex items-start gap-3 rounded-[8px] border border-[#d7ff64]/20 bg-[#d7ff64]/5 p-3 text-xs font-bold leading-5 text-zinc-300">
              <input
                type="checkbox"
                checked={sendConfirmed}
                onChange={(event) => setSendConfirmed(event.target.checked)}
                className="mt-0.5 size-4 accent-[#d7ff64]"
              />
              <span>본문과 수신자를 검수했고, 실제 Gmail 발송을 진행합니다.</span>
            </label>
            <ActionButton
              onClick={() => deliver("send")}
              disabled={!newsletter || isLoading || !sendConfirmed}
              icon={<Send size={18} />}
              label="Gmail 발송"
              variant="danger"
            />
          </section>

          <section className={`mt-5 rounded-[8px] border p-4 text-sm leading-6 ${statusTone[statusKind]}`}>
            <div className="mb-2 flex items-center gap-2 font-black">
              {statusKind === "done" ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
              상태
            </div>
            {status}
          </section>

          {newsletter ? (
            <section className="mt-5 grid gap-2 border-t border-white/10 pt-5 text-xs text-zinc-500">
              <span>뉴스레터 월: {newsletter.displayMonth}</span>
              <span>생성 시각: {newsletter.generatedAt}</span>
            </section>
          ) : null}
        </aside>

        <section className="min-h-screen bg-[#efebe1] p-8 text-[#141414] max-[720px]:p-4">
          <EmailPreviewCanvas newsletter={newsletter} emailPreviewHtml={emailPreviewHtml} />
        </section>
      </div>
    </main>
  );
}

function createImageSeed() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  variant = "secondary",
  compact = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  compact?: boolean;
}) {
  const variants = {
    primary: "border-[#d7ff64] bg-[#d7ff64] text-[#111111] hover:bg-[#e5ff8f]",
    secondary: "border-white/10 bg-white/[0.06] text-zinc-100 hover:bg-white/[0.11]",
    danger: "border-[#ff6b4a] bg-[#ff6b4a] text-white hover:bg-[#ff7d61]",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-[8px] border font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${compact ? "min-h-10 px-2 py-2 text-xs" : "min-h-12 px-4 py-3 text-sm"} ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmailPreviewCanvas({
  newsletter,
  emailPreviewHtml,
}: {
  newsletter: Newsletter | null;
  emailPreviewHtml: string;
}) {
  return (
    <div className="mx-auto max-w-[900px]">
      <div className="mb-4 flex items-center justify-between border-b border-black/10 pb-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ff6b4a]">Gmail Preview</p>
          <h2 className="mt-1 text-2xl font-black">발송본 미리보기</h2>
        </div>
        <span className="rounded-full border border-black/10 bg-white/60 px-3 py-1 text-[11px] font-black text-zinc-500">720px</span>
      </div>

      <div className="rounded-[8px] border border-black/10 bg-white p-3 shadow-[0_30px_90px_rgba(20,20,20,0.14)]">
        {newsletter && emailPreviewHtml ? (
          <iframe
            title="Gmail 발송 미리보기"
            srcDoc={emailPreviewHtml}
            className="h-[calc(100vh-160px)] min-h-[720px] w-full rounded-[6px] bg-[#efebe1] max-[900px]:h-[760px]"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="grid min-h-[720px] place-items-center rounded-[6px] bg-[#efebe1] px-8 text-center text-sm font-bold leading-6 text-zinc-500">
            이번 호를 만들면 실제 Gmail 발송 크기의 미리보기가 여기에 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}

function buildEmailHtml(newsletter: Newsletter, subject: string) {
  const sectionRows = newsletter.sections
    .map((section, index) => {
      const body =
        section.body.length === 1
          ? `<p style="margin:0;color:#2a2a2a;font-size:16px;line-height:1.75;">${escapeHtml(section.body[0])}</p>`
          : `<ul style="margin:0;padding:0 0 0 18px;color:#2a2a2a;font-size:15px;line-height:1.7;">${section.body
              .map((item) => `<li style="margin:0 0 8px 0;">${escapeHtml(item)}</li>`)
              .join("")}</ul>`;

      return `
        <tr>
          <td style="border-top:1px solid #ddd6c8;background:#f7f3e9;">
            <div style="padding:22px 28px 26px 28px;">
              <p style="margin:0 0 18px 0;color:#141414;font-size:14px;line-height:1.4;">${String(index + 1).padStart(2, "0")}</p>
              ${section.imageUrl ? `<div style="margin:0 0 18px 0;">${emailImage(section.imageUrl, `${index + 1}. ${section.title}`, 180, 120)}</div>` : ""}
              <p style="margin:0 0 12px 0;color:#141414;font-size:14px;line-height:1.5;">${escapeHtml(section.eyebrow)}</p>
              <h3 style="margin:0 0 14px 0;color:#141414;font-size:24px;line-height:1.25;font-weight:900;">${escapeHtml(section.title)}</h3>
              ${body}
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>디지털콘텐츠전환TF 뉴스레터</title>
    <style>
      body{margin:0;background:#efebe1;color:#141414;font-family:Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
      img{border:0;outline:none;text-decoration:none}
      @media screen and (max-width:760px){.email-shell{padding:0!important}.email-card{width:100%!important}.email-pad{padding-left:22px!important;padding-right:22px!important}.email-title{font-size:34px!important}}
    </style>
  </head>
  <body>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:100%;background:#efebe1;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="720" cellspacing="0" cellpadding="0" border="0" class="email-card" style="width:720px;max-width:720px;border-collapse:collapse;background:#f7f3e9;border:1px solid #d9d2c4;">
            <tr>
              <td style="background:#141414;color:#efebe1;">
                <div class="email-pad" style="padding:30px 32px 22px 32px;">
                  <p style="margin:0 0 14px 0;color:#d7ff64;font-size:13px;font-weight:800;line-height:1.5;">${escapeHtml(subject || newsletter.subject)}</p>
                  <h1 class="email-title" style="margin:0;color:#f6f1e8;font-size:42px;line-height:1.08;font-weight:900;letter-spacing:0;">${escapeHtml(newsletter.heroTitle)}</h1>
                  ${newsletter.heroImageUrl ? `<div style="margin:22px 0 0 0;">${heroEmailImage(newsletter.heroImageUrl, newsletter.heroTitle)}</div>` : ""}
                </div>
              </td>
            </tr>
            ${sectionRows}
            <tr>
              <td style="background:#141414;color:#efebe1;padding:24px 28px;">
                <p style="margin:0 0 10px 0;color:#d7ff64;font-size:11px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;">Next issue</p>
                <p style="margin:0;color:#f6f1e8;font-size:18px;line-height:1.6;font-weight:700;">${escapeHtml(newsletter.closing)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function emailImage(src: string, alt: string, width: number, height: number) {
  return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" width="${width}" height="${height}" style="display:block;width:${width}px;max-width:100%;height:${height}px;border:0;border-radius:8px;margin:0;padding:0;">`;
}

function heroEmailImage(src: string, alt: string) {
  return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" width="656" style="display:block;width:100%;max-width:656px;height:auto;border:0;border-radius:8px;margin:0;padding:0;">`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
