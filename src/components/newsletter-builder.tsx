"use client";

import {
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  WandSparkles,
} from "lucide-react";
import { useRef, useState } from "react";
import type { GenerateNewsletterResponse, Newsletter } from "@/lib/types";

export function NewsletterBuilder() {
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [status, setStatus] = useState("대기 중입니다.");
  const [isLoading, setIsLoading] = useState(false);
  const [includeImages, setIncludeImages] = useState(true);
  const [subject, setSubject] = useState("");
  const [recipients, setRecipients] = useState("");
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const previewRef = useRef<HTMLElement>(null);

  async function generate() {
    setIsLoading(true);
    setStatus(includeImages ? "시트와 이미지를 함께 준비하는 중입니다..." : "시트를 읽고 초안을 정리하는 중입니다...");

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
      setStatus("초안을 만들었습니다. 본문을 눌러 바로 수정할 수 있어요.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyHtml() {
    if (!newsletter) {
      return;
    }
    await navigator.clipboard.writeText(buildEmailHtml(previewRef.current?.innerHTML ?? ""));
    setStatus("HTML을 클립보드에 복사했습니다.");
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
    setStatus("HTML 파일을 다운로드했습니다.");
  }

  async function deliver(mode: "draft" | "send") {
    if (!newsletter) {
      return;
    }

    if (mode === "send" && !sendConfirmed) {
      setStatus("실제 발송 전 확인 체크가 필요합니다.");
      return;
    }

    setIsLoading(true);
    setStatus(mode === "draft" ? "Gmail 임시보관함을 만드는 중입니다..." : "Gmail로 발송하는 중입니다...");

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

      setStatus(
        mode === "draft"
          ? `Gmail 임시보관함을 만들었습니다. 대상 ${payload.recipientCount ?? 0}명.`
          : `Gmail 발송을 완료했습니다. 대상 ${payload.recipientCount ?? 0}명.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Gmail 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fff7e8] text-[#172033]">
      <div className="grid min-h-screen grid-cols-[minmax(300px,380px)_1fr] max-[980px]:block">
        <aside className="sticky top-0 h-screen overflow-auto border-r border-[#efd9ac] bg-white p-6 max-[980px]:static max-[980px]:h-auto max-[980px]:border-b max-[980px]:border-r-0">
          <div className="mb-7">
            <p className="mb-2 text-sm font-black text-[#ff6f4f]">HANBIT ACADEMY</p>
            <h1 className="text-2xl font-black leading-tight min-[1180px]:text-3xl">
              디콘전TF 뉴스레터
              <br />
              생성기
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#667085]">
              원본 Google Sheet는 읽기만 하고, Vercel 웹앱에서 검수 가능한 웹 뉴스레터를 만듭니다.
            </p>
          </div>

          <label className="mb-3 flex items-center gap-3 rounded-lg border border-[#f0d59b] bg-[#fffaf0] p-4 text-sm font-bold">
            <input
              type="checkbox"
              checked={includeImages}
              onChange={(event) => setIncludeImages(event.target.checked)}
              className="size-4 accent-[#ff7a59]"
            />
            <span className="flex items-center gap-2">
              <ImageIcon size={17} />
              이미지 함께 생성
            </span>
          </label>

          <label className="mb-2 block text-sm font-bold" htmlFor="subject">
            메일 제목
          </label>
          <input
            id="subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="이번 호를 만들면 제목이 들어옵니다"
            className="mb-4 w-full rounded-lg border border-[#e6c989] bg-[#fffdfa] px-3 py-3 text-sm outline-none focus:border-[#ff7a59]"
          />

          <label className="mb-2 block text-sm font-bold" htmlFor="recipients">
            받는 사람
          </label>
          <textarea
            id="recipients"
            value={recipients}
            onChange={(event) => setRecipients(event.target.value)}
            placeholder="academy@example.com, member@example.com"
            rows={4}
            className="mb-4 w-full resize-y rounded-lg border border-[#e6c989] bg-[#fffdfa] px-3 py-3 text-sm leading-6 outline-none focus:border-[#ff7a59]"
          />

          <div className="grid gap-3">
            <button
              onClick={generate}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#ffd166] px-4 py-3 font-black text-[#1b1b1b] transition hover:bg-[#ffc23d] disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <WandSparkles size={18} />}
              이번 호 만들기
            </button>
            <button
              onClick={copyHtml}
              disabled={!newsletter || isLoading}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#e9f7ff] px-4 py-3 font-black text-[#164e76] transition hover:bg-[#d7f0ff] disabled:opacity-50"
            >
              <Copy size={18} />
              HTML 복사
            </button>
            <button
              onClick={downloadHtml}
              disabled={!newsletter || isLoading}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#f8f2e7] px-4 py-3 font-black text-[#614719] transition hover:bg-[#efe3d1] disabled:opacity-50"
            >
              <Download size={18} />
              HTML 다운로드
            </button>
            <button
              onClick={() => deliver("draft")}
              disabled={!newsletter || isLoading}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#e8f8ec] px-4 py-3 font-black text-[#176b35] transition hover:bg-[#d9f2df] disabled:opacity-50"
            >
              <Mail size={18} />
              Gmail 임시보관함
            </button>

            <label className="flex items-start gap-3 rounded-lg border border-[#f0d59b] bg-[#fffaf0] p-3 text-xs font-bold leading-5 text-[#73531a]">
              <input
                type="checkbox"
                checked={sendConfirmed}
                onChange={(event) => setSendConfirmed(event.target.checked)}
                className="mt-0.5 size-4 accent-[#ff7a59]"
              />
              <span>본문과 수신자를 검수했고, 실제 Gmail 발송을 진행합니다.</span>
            </label>
            <button
              onClick={() => deliver("send")}
              disabled={!newsletter || isLoading || !sendConfirmed}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#ff7a59] px-4 py-3 font-black text-white transition hover:bg-[#f06744] disabled:opacity-50"
            >
              <Send size={18} />
              Gmail 발송
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-[#f0d59b] bg-[#fffaf0] p-4 text-sm leading-6 text-[#73531a]">
            <div className="mb-2 flex items-center gap-2 font-black">
              <RefreshCw size={16} />
              상태
            </div>
            {status}
          </div>

          {newsletter ? (
            <div className="mt-5 grid gap-2 text-xs text-[#667085]">
              <span>원천 날짜: {newsletter.sourceDate}</span>
              <span>원천 범위: {newsletter.sourceRange}</span>
              <span>생성 시각: {newsletter.generatedAt}</span>
            </div>
          ) : null}
        </aside>

        <section className="p-8 max-[720px]:p-4">
          <NewsletterPreview newsletter={newsletter} subject={subject} previewRef={previewRef} />
        </section>
      </div>
    </main>
  );
}

function NewsletterPreview({
  newsletter,
  subject,
  previewRef,
}: {
  newsletter: Newsletter | null;
  subject: string;
  previewRef: React.RefObject<HTMLElement | null>;
}) {
  if (!newsletter) {
    return (
      <article className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-[#f2d7a0] bg-[#fffaf0] shadow-[0_18px_45px_rgba(103,73,15,0.12)]">
        <div className="bg-[#ffb563] p-10 text-[#2e1b00]">
          <p className="mb-3 text-sm font-black">디지털콘텐츠전환TF 격주 소식</p>
          <h2 className="text-4xl font-black leading-tight">이번 호를 만들어 주세요</h2>
          <p className="mt-4 max-w-2xl leading-7">
            왼쪽의 버튼을 누르면 최신 보고를 읽고 이미지가 포함된 웹 뉴스레터 초안을 만듭니다.
          </p>
        </div>
        <div className="grid place-items-center p-16 text-center text-[#667085]">
          <FileText size={42} />
          <p className="mt-4 text-sm">생성된 뉴스레터는 이곳에서 바로 수정할 수 있습니다.</p>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={previewRef}
      contentEditable
      suppressContentEditableWarning
      className="newsletter mx-auto max-w-5xl overflow-hidden rounded-lg border border-[#f2d7a0] bg-[#fffaf0] shadow-[0_18px_45px_rgba(103,73,15,0.12)] outline-none focus:ring-4 focus:ring-[#ffd166]/40"
      aria-label="뉴스레터 편집 영역"
    >
      <header className="hero grid grid-cols-[1.1fr_.9fr] gap-8 bg-[#ffb563] p-9 text-[#2e1b00] max-[820px]:block">
        <div>
          <p className="mb-3 text-sm font-black">{newsletter.teamName} 격주 소식</p>
          <h2 className="text-4xl font-black leading-tight">{newsletter.heroTitle}</h2>
          <p className="mt-4 max-w-2xl leading-7">{newsletter.heroSubtitle}</p>
          {subject ? <p className="mt-5 text-sm font-bold opacity-80">{subject}</p> : null}
        </div>
        {newsletter.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={newsletter.heroImageUrl}
            alt=""
            className="aspect-[4/3] w-full rounded-lg border-4 border-white/55 object-cover shadow-lg max-[820px]:mt-7"
          />
        ) : null}
      </header>

      <div className="grid gap-5 p-7">
        {newsletter.sections.map((section) => (
          <section
            key={section.id}
            className={`section section-${section.tone} grid grid-cols-[170px_1fr] gap-5 rounded-lg border border-[#f1ddb2] bg-white p-5 max-[720px]:block`}
          >
            {section.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={section.imageUrl}
                alt=""
                className="aspect-square w-full rounded-lg object-cover max-[720px]:mb-4 max-[720px]:max-w-52"
              />
            ) : null}
            <div>
              <p className="mb-2 text-xs font-black text-[#ff6f4f]">{section.eyebrow}</p>
              <h3 className="mb-3 text-2xl font-black leading-snug">{section.title}</h3>
              {section.body.length === 1 ? (
                <p className="leading-8">{section.body[0]}</p>
              ) : (
                <ul className="list-disc space-y-2 pl-5 leading-8">
                  {section.body.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      <footer className="p-7 pt-0">
        <p className="rounded-lg bg-[#fff2c9] p-5 font-bold leading-7 text-[#6b3d00]">{newsletter.closing}</p>
      </footer>
    </article>
  );
}

function buildEmailHtml(innerHtml: string) {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>디지털콘텐츠전환TF 뉴스레터</title>
    <style>
      body{margin:0;background:#fff7e8;color:#172033;font-family:Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
      .newsletter{max-width:980px;margin:0 auto;border:1px solid #f2d7a0;border-radius:8px;overflow:hidden;background:#fffaf0}
      .hero{background:#ffb563;color:#2e1b00;padding:36px;display:block}
      .hero img{max-width:100%;border-radius:8px;margin-top:22px}
      .section{margin:0 0 18px;padding:22px;border:1px solid #f1ddb2;border-radius:8px;background:#fff}
      .section img{width:160px;max-width:100%;border-radius:8px;display:block;margin-bottom:14px}
      h2{font-size:34px;line-height:1.2;margin:0} h3{font-size:22px;line-height:1.35;margin:0 0 12px}
      p,li{line-height:1.75}.section p:first-child{color:#ff6f4f;font-size:12px;font-weight:900}
      footer p{margin:0;padding:18px 22px;border-radius:8px;background:#fff2c9;color:#6b3d00;font-weight:700}
    </style>
  </head>
  <body>
    <div style="padding:24px">${innerHtml}</div>
  </body>
</html>`;
}
