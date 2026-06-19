"use client";

import {
  ArrowDownToLine,
  CheckCircle2,
  Copy,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  MailCheck,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
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

type ReviewComment = {
  id: string;
  text: string;
  note: string;
};

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
  const [selectedText, setSelectedText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const previewRef = useRef<HTMLElement>(null);

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
        body: JSON.stringify({ images: includeImages }),
      });
      const payload = (await response.json()) as GenerateNewsletterResponse & { error?: string };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "뉴스레터 생성에 실패했습니다.");
      }

      setNewsletter(payload.newsletter);
      setSubject(payload.newsletter.subject);
      setReviewComments([]);
      setReviewNote("");
      setSelectedText("");
      window.setTimeout(updateEmailPreview, 50);
      setUiStatus("초안을 만들었습니다. 미리보기 본문을 눌러 바로 수정할 수 있어요.", "done");
    } catch (error) {
      setUiStatus(error instanceof Error ? error.message : "오류가 발생했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyHtml() {
    if (!newsletter) {
      return;
    }
    await navigator.clipboard.writeText(buildEmailHtml(previewRef.current?.innerHTML ?? ""));
    setUiStatus("HTML을 클립보드에 복사했습니다.", "done");
  }

  function downloadHtml() {
    if (!newsletter) {
      return;
    }
    const html = buildEmailHtml(previewRef.current?.innerHTML ?? "");
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
          html: buildEmailHtml(previewRef.current?.innerHTML ?? ""),
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
    setEmailPreviewHtml(buildEmailHtml(previewRef.current?.innerHTML ?? "", { includeReviewMarks: true }));
  }

  function captureSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";
    if (!text || !previewRef.current || !selection?.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    if (!previewRef.current.contains(container.nodeType === Node.TEXT_NODE ? container.parentElement : container)) {
      return;
    }

    setSelectedText(text.slice(0, 120));
  }

  function addReviewComment() {
    const selection = window.getSelection();
    const note = reviewNote.trim();
    if (!note || !selection?.rangeCount || !previewRef.current) {
      setUiStatus("주석을 달 문장을 드래그하고 메모를 입력해 주세요.", "error");
      return;
    }

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      setUiStatus("주석을 달 문장을 먼저 선택해 주세요.", "error");
      return;
    }

    const container = range.commonAncestorContainer;
    if (!previewRef.current.contains(container.nodeType === Node.TEXT_NODE ? container.parentElement : container)) {
      setUiStatus("뉴스레터 본문 안의 문장을 선택해 주세요.", "error");
      return;
    }

    const id = `c-${Date.now()}`;
    const text = selection.toString().trim();
    const mark = document.createElement("span");
    mark.className = "review-comment-highlight";
    mark.dataset.commentId = id;
    mark.title = note;

    try {
      range.surroundContents(mark);
    } catch {
      mark.append(range.extractContents());
      range.insertNode(mark);
    }

    selection.removeAllRanges();
    setReviewComments((items) => [...items, { id, text, note }]);
    setReviewNote("");
    setSelectedText("");
    updateEmailPreview();
    setUiStatus("선택한 문장에 검수 주석을 달았습니다. 발송본에서는 주석 표시가 빠집니다.", "done");
  }

  function removeReviewComment(id: string) {
    const mark = previewRef.current?.querySelector(`[data-comment-id="${id}"]`);
    if (mark) {
      mark.replaceWith(...Array.from(mark.childNodes));
    }
    setReviewComments((items) => items.filter((item) => item.id !== id));
    updateEmailPreview();
  }

  return (
    <main className="min-h-screen bg-[#111111] text-[#f6f1e8]">
      <div className="grid min-h-screen grid-cols-[420px_minmax(0,1fr)_380px] max-[1280px]:grid-cols-[360px_minmax(0,1fr)] max-[1040px]:block">
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
              <span>원천 날짜: {newsletter.sourceDate}</span>
              <span>원천 범위: {newsletter.sourceRange}</span>
              <span>생성 시각: {newsletter.generatedAt}</span>
            </section>
          ) : null}
        </aside>

        <section className="min-h-screen bg-[#efebe1] p-8 text-[#141414] max-[720px]:p-4">
          <NewsletterPreview
            newsletter={newsletter}
            subject={subject}
            previewRef={previewRef}
            onInput={updateEmailPreview}
            onMouseUp={captureSelection}
            onKeyUp={captureSelection}
          />
        </section>
        <ReviewPanel
          newsletter={newsletter}
          emailPreviewHtml={emailPreviewHtml}
          selectedText={selectedText}
          reviewNote={reviewNote}
          comments={reviewComments}
          onNoteChange={setReviewNote}
          onAddComment={addReviewComment}
          onRemoveComment={removeReviewComment}
        />
      </div>
    </main>
  );
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
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "danger";
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
      className={`flex min-h-12 items-center justify-center gap-2 rounded-[8px] border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}

function NewsletterPreview({
  newsletter,
  subject,
  previewRef,
  onInput,
  onMouseUp,
  onKeyUp,
}: {
  newsletter: Newsletter | null;
  subject: string;
  previewRef: React.RefObject<HTMLElement | null>;
  onInput: () => void;
  onMouseUp: () => void;
  onKeyUp: () => void;
}) {
  if (!newsletter) {
    return (
      <article className="mx-auto max-w-6xl overflow-hidden rounded-[8px] border border-black/10 bg-[#f7f3e9] shadow-[0_30px_90px_rgba(20,20,20,0.16)]">
        <div className="grid min-h-[420px] grid-cols-[1fr_1.2fr] border-b border-black/10 max-[900px]:block">
          <div className="flex flex-col justify-between bg-[#141414] p-8 text-[#efebe1]">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff64]">Digital Content TF</p>
            <h2 className="mt-16 text-6xl font-black leading-[0.95] tracking-tight max-[720px]:text-4xl">
              Make
              <br />
              the issue
            </h2>
            <p className="mt-8 max-w-sm text-sm leading-6 text-zinc-400">
              왼쪽의 버튼을 누르면 최신 보고를 읽고, 이미지가 포함된 웹 뉴스레터 초안을 만듭니다.
            </p>
          </div>
          <div className="grid place-items-center p-8">
            <div className="w-full max-w-md rounded-[8px] border border-black/10 bg-white p-5">
              <div className="mb-10 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-zinc-500">
                <span>Preview</span>
                <FileText size={18} />
              </div>
              <div className="h-28 rounded-[8px] bg-[#d7ff64]" />
              <div className="mt-5 space-y-3">
                <div className="h-4 w-3/4 rounded-full bg-black/15" />
                <div className="h-4 w-1/2 rounded-full bg-black/10" />
                <div className="h-4 w-5/6 rounded-full bg-black/10" />
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={previewRef}
      contentEditable
      suppressContentEditableWarning
      onInput={onInput}
      onMouseUp={onMouseUp}
      onKeyUp={onKeyUp}
      className="newsletter mx-auto max-w-6xl overflow-hidden rounded-[8px] border border-black/10 bg-[#f7f3e9] shadow-[0_30px_90px_rgba(20,20,20,0.16)] outline-none focus:ring-4 focus:ring-[#d7ff64]/60"
      aria-label="뉴스레터 편집 영역"
    >
      <header className="hero grid min-h-[460px] grid-cols-[1fr_1.08fr] border-b border-black/10 max-[900px]:block">
        <div className="flex flex-col justify-between bg-[#141414] p-8 text-[#efebe1]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7ff64]">{newsletter.teamName}</p>
            <p className="mt-3 text-xs text-zinc-500">{newsletter.sourceDate} / {newsletter.sourceRange}</p>
          </div>
          <div>
            <h2 className="max-w-xl text-6xl font-black leading-[0.92] tracking-tight max-[720px]:text-4xl">
              {newsletter.heroTitle}
            </h2>
            <p className="mt-5 max-w-lg text-base leading-7 text-zinc-300">{newsletter.heroSubtitle}</p>
            {subject ? <p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">{subject}</p> : null}
          </div>
        </div>
        <div className="bg-[#d7ff64] p-5">
          {newsletter.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={newsletter.heroImageUrl} alt="" className="h-full min-h-[420px] w-full rounded-[8px] object-cover" />
          ) : (
            <div className="h-full min-h-[420px] rounded-[8px] bg-black/10" />
          )}
        </div>
      </header>

      <div className="grid gap-px bg-black/10">
        {newsletter.sections.map((section, index) => (
          <section key={section.id} className="section grid grid-cols-[260px_1fr] bg-[#f7f3e9] max-[760px]:block">
            <div className={`section-${section.tone} border-r border-black/10 p-5 max-[760px]:border-b max-[760px]:border-r-0`}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/50">0{index + 1}</p>
              {section.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={section.imageUrl} alt="" className="mt-5 aspect-[4/3] w-full rounded-[8px] object-cover" />
              ) : null}
            </div>
            <div className="p-7">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-[#ff6b4a]">{section.eyebrow}</p>
              <h3 className="mb-5 max-w-3xl text-3xl font-black leading-tight tracking-tight">{section.title}</h3>
              {section.body.length === 1 ? (
                <p className="max-w-4xl text-lg leading-9 text-[#282828]">{section.body[0]}</p>
              ) : (
                <ul className="grid gap-3 text-base leading-8 text-[#282828]">
                  {section.body.map((item) => (
                    <li key={item} className="border-l-4 border-black/15 pl-4">
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      <footer className="grid grid-cols-[260px_1fr] border-t border-black/10 bg-[#141414] text-[#efebe1] max-[760px]:block">
        <div className="p-6 text-xs font-black uppercase tracking-[0.18em] text-[#d7ff64]">Next issue</div>
        <p className="p-6 text-xl font-bold leading-8">{newsletter.closing}</p>
      </footer>
    </article>
  );
}

function ReviewPanel({
  newsletter,
  emailPreviewHtml,
  selectedText,
  reviewNote,
  comments,
  onNoteChange,
  onAddComment,
  onRemoveComment,
}: {
  newsletter: Newsletter | null;
  emailPreviewHtml: string;
  selectedText: string;
  reviewNote: string;
  comments: ReviewComment[];
  onNoteChange: (value: string) => void;
  onAddComment: () => void;
  onRemoveComment: (id: string) => void;
}) {
  return (
    <aside className="sticky top-0 h-screen overflow-auto border-l border-white/10 bg-[#151515] p-4 text-[#f6f1e8] max-[1280px]:col-span-2 max-[1280px]:h-auto max-[1280px]:border-l-0 max-[1280px]:border-t max-[1040px]:static">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d7ff64]">Send Preview</p>
          <h2 className="mt-1 text-xl font-black">발송본 검수</h2>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-black text-zinc-400">720px</span>
      </div>

      <div className="rounded-[8px] border border-white/10 bg-white p-2">
        {newsletter && emailPreviewHtml ? (
          <iframe
            title="Gmail 발송 미리보기"
            srcDoc={emailPreviewHtml}
            className="h-[420px] w-full rounded-[6px] bg-[#efebe1]"
            sandbox=""
          />
        ) : (
          <div className="grid h-[420px] place-items-center rounded-[6px] bg-[#efebe1] px-8 text-center text-sm font-bold leading-6 text-zinc-500">
            이번 호를 만들면 실제 Gmail 발송 크기의 미리보기가 여기에 표시됩니다.
          </div>
        )}
      </div>

      <section className="mt-4 rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-black">
          <MessageSquarePlus size={17} />
          주석 달기
        </div>
        <p className="mb-2 min-h-10 rounded-[8px] border border-white/10 bg-black/20 p-3 text-xs leading-5 text-zinc-400">
          {selectedText ? `선택: ${selectedText}` : "가운데 본문에서 문장을 드래그해 선택하세요."}
        </p>
        <textarea
          value={reviewNote}
          onChange={(event) => onNoteChange(event.target.value)}
          rows={3}
          placeholder="수정 의견을 입력하세요"
          className="field-input resize-y leading-6"
        />
        <button
          type="button"
          onClick={onAddComment}
          disabled={!newsletter || !reviewNote.trim()}
          className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d7ff64] bg-[#d7ff64] px-3 py-2 text-xs font-black text-[#111111] transition hover:bg-[#e5ff8f] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MessageSquarePlus size={15} />
          선택 문장에 주석
        </button>
      </section>

      <section className="mt-4 grid gap-2">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Comments {comments.length}</p>
        {comments.length ? (
          comments.map((comment, index) => (
            <article key={comment.id} className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-black text-[#d7ff64]">#{index + 1}</span>
                <button
                  type="button"
                  onClick={() => onRemoveComment(comment.id)}
                  className="rounded-[6px] border border-white/10 p-1.5 text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label="주석 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="mb-2 text-xs leading-5 text-zinc-500">{comment.text}</p>
              <p className="text-sm leading-6 text-zinc-100">{comment.note}</p>
            </article>
          ))
        ) : (
          <p className="rounded-[8px] border border-white/10 bg-white/[0.04] p-3 text-xs leading-5 text-zinc-500">
            아직 주석이 없습니다. 검수 중 수정할 문장을 선택해 메모를 남겨보세요.
          </p>
        )}
      </section>
    </aside>
  );
}

function buildEmailHtml(innerHtml: string, options: { includeReviewMarks?: boolean } = {}) {
  const safeInnerHtml = options.includeReviewMarks ? innerHtml : stripReviewComments(innerHtml);
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>디지털콘텐츠전환TF 뉴스레터</title>
    <style>
      body{margin:0;background:#efebe1;color:#141414;font-family:Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
      .email-shell{width:100%;padding:20px 0;background:#efebe1}
      .newsletter{width:720px;max-width:720px;margin:0 auto;border:1px solid #d9d2c4;border-radius:8px;overflow:hidden;background:#f7f3e9}
      .hero{background:#141414!important;color:#efebe1!important;padding:30px;display:block}
      .hero img{width:100%;max-width:660px;max-height:320px;border-radius:8px;margin-top:20px;object-fit:cover;display:block}
      .section{margin:0;border-top:1px solid #d9d2c4;background:#f7f3e9!important;padding:22px;display:block}
      .section img{width:180px;max-width:100%;max-height:140px;border-radius:8px;object-fit:cover;display:block;margin-bottom:16px}
      h2{font-size:34px;line-height:1.12;margin:0} h3{font-size:22px;line-height:1.3;margin:0 0 14px}
      p,li{font-size:15px;line-height:1.72}.section p:first-child{color:#ff6b4a;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      footer{background:#141414;color:#efebe1;padding:24px} footer p{margin:0;font-size:18px;font-weight:700;line-height:1.6}
      .review-comment-highlight{background:#fff3a3;color:inherit;border-bottom:2px solid #ff6b4a}
      @media screen and (max-width:760px){.newsletter{width:100%!important;max-width:100%!important}.email-shell{padding:0}.hero{padding:24px}.hero img{max-width:100%;max-height:260px}h2{font-size:30px}.section{padding:20px}}
    </style>
  </head>
  <body>
    <div class="email-shell">
      <div class="newsletter">${safeInnerHtml}</div>
    </div>
  </body>
</html>`;
}

function stripReviewComments(innerHtml: string) {
  if (typeof DOMParser === "undefined") {
    return innerHtml;
  }

  const document = new DOMParser().parseFromString(`<div>${innerHtml}</div>`, "text/html");
  document.querySelectorAll(".review-comment-highlight").forEach((node) => {
    node.replaceWith(...Array.from(node.childNodes));
  });
  return document.body.firstElementChild?.innerHTML ?? innerHtml;
}
