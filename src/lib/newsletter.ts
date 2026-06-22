import type { Newsletter, NewsletterSection, RawReport } from "./types";
import { normalizeNewsletterItems, normalizeNewsletterSentence } from "./korean-style";

const TEAM_NAME = "디지털콘텐츠전환TF";

export function buildNewsletter(report: RawReport): Newsletter {
  const displayMonth = toDisplayMonth(report.displayDate);
  const signals = parseSignalSections(report.signals);
  const bright = compactBullets([signals["긍정 신호"], signals["새로운 기회"]], 4);
  const focus = compactBullets([report.operations], 4);
  const watching = compactBullets([signals["약한 신호"], signals["리스크"], report.operations], 4);
  const next = extractTopItems(report.next);
  const request = compactBullets([report.support, report.request], 3);

  const sections: NewsletterSection[] = [
    {
      id: "summary",
      eyebrow: "이번 호 한입 요약",
      title: "요즘 TF는 이런 흐름으로 움직이고 있어요",
      tone: "sun",
      body: [buildOneLine(bright, next)],
      imagePrompt: imagePrompt(
        `A photorealistic editorial overview photo for a Korean education technology and publishing team newsletter. Show a varied workspace with printed books, digital textbooks, a tablet, a calendar, sticky planning notes, and one laptop partly off to the side under warm natural daylight. Main story: ${buildOneLine(bright, next)}`,
      ),
    },
    {
      id: "focus",
      eyebrow: "집중 모드",
      title: "지금 가장 열심히 챙기는 일",
      tone: "mint",
      body: focus,
      imagePrompt: imagePrompt(
        `A photorealistic documentary-style photo of Korean adult professionals preparing education publishing materials for sales and internal sharing. Show hands sorting printed sample books, tablets with blurred content, catalog sheets, file folders, and checklist pages on a worktable, not a generic laptop-only meeting. Related tasks: ${focus.join(" ")}`,
      ),
    },
    {
      id: "bright",
      eyebrow: "반짝 소식",
      title: "좋은 신호가 보였어요",
      tone: "sky",
      body: bright,
      imagePrompt: imagePrompt(
        `A photorealistic upbeat photo of an online seminar or professional education session for adult educators and business partners. Show a presenter area, a large screen with unreadable blurred slides, notebooks, microphones or tablets, and attentive Korean adult participants, with positive energy and no schoolchildren. Related signal: ${bright.join(" ")}`,
      ),
    },
    {
      id: "watching",
      eyebrow: "체크 포인트",
      title: "차근차근 살펴보는 중",
      tone: "coral",
      body: watching,
      imagePrompt: imagePrompt(
        `A photorealistic close-up quality review photo with a different mood from the other images. Show spreadsheet-like grids blurred on a monitor, printed QA notes, marked checkboxes, link verification notes, a calendar corner, and a hand using a pen or trackpad in a quiet office workspace. Watch points: ${watching.join(" ")}`,
      ),
    },
    {
      id: "next",
      eyebrow: "다음 2주",
      title: "집중해서 볼 우선순위",
      tone: "violet",
      body: next,
      imagePrompt: imagePrompt(
        `A photorealistic project planning photo showing a two-week roadmap from a top-down or angled perspective. Include a whiteboard or planning board, colored sticky notes, printed roadmap sheets, digital book work artifacts, AI/data review notes, and seminar follow-up materials arranged with clear depth. Next priorities: ${next.join(" ")}`,
      ),
    },
    {
      id: "request",
      eyebrow: "함께 보기",
      title: "같이 봐주시면 좋아요",
      tone: "sky",
      body: request.length ? request : ["이번 호의 별도 협업 요청은 없습니다."],
      imagePrompt: imagePrompt(
        `A photorealistic collaborative review photo of Korean adult coworkers giving feedback on a newsletter or content draft. Show annotated printouts, comment notes, a tablet with blurred layout blocks, coffee cups, and relaxed teamwork in a small review corner rather than a formal boardroom. Collaboration notes: ${request.join(" ")}`,
      ),
    },
  ];

  return {
    subject: `[${TEAM_NAME}] ${displayMonth} 격주 뉴스레터`,
    teamName: TEAM_NAME,
    sourceDate: report.displayDate,
    displayMonth,
    sourceRange: report.sourceRange,
    generatedAt: formatKoreanDateTime(new Date()),
    heroTitle: "디콘전TF 소식이 도착했어요",
    heroSubtitle: `${displayMonth} 소식을 정리한 ${TEAM_NAME} 격주 뉴스레터입니다.`,
    heroImagePrompt: imagePrompt(
      `A photorealistic magazine-style hero photo for a Korean digital content transformation and education publishing team newsletter. Show a rich first-glance scene with books, tablets, editorial notes, a seminar screen in the distance, AI-assisted workflow hints, project planning materials, and a modern education office atmosphere. Issue month: ${displayMonth}.`,
    ),
    sections,
    closing: "다음 소식도 가볍게 읽히지만 알맹이는 또렷하게 정리해 올게요.",
  };
}

function toDisplayMonth(value: string): string {
  const match = value.trim().match(/(\d{1,2})\s*월/);
  return match ? `${Number(match[1])}월` : value;
}

function parseSignalSections(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  const source = text.replace(/\r\n/g, "\n");
  const regex =
    /•\s*(긍정 신호|약한 신호|새로운 기회|리스크)\s*\n([\s\S]*?)(?=\n\s*•\s*(?:긍정 신호|약한 신호|새로운 기회|리스크)\s*\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    result[match[1]] = match[2].trim();
  }

  return result;
}

function compactBullets(blocks: Array<string | undefined>, limit: number): string[] {
  const items = blocks
    .filter(Boolean)
    .join("\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-•ㄴ\s]+/, "").trim())
    .filter((line) => !isSignalHeading(line))
    .filter((line) => line && line !== "없음")
    .map(toNewsletterSentence);

  return normalizeNewsletterItems([...new Set(items)], limit);
}

function isSignalHeading(line: string): boolean {
  return /^(긍정 신호|약한 신호|새로운 기회|리스크)$/u.test(line.replace(/[.。:：]$/g, "").trim());
}

function extractTopItems(text: string): string[] {
  const matches = text.trim().match(/Top\s*\d+[\s\S]*?(?=\n\s*Top\s*\d+|$)/gi);
  if (!matches) {
    return compactBullets([text], 3);
  }

  return matches.slice(0, 3).map((item) => {
    const firstLine = item
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)[0];
    return toNewsletterSentence(firstLine.replace(/Top\s*\d+\s*:\s*/i, ""));
  });
}

function buildOneLine(bright: string[], next: string[]): string {
  if (bright.length) {
    const topic = extractTopic(bright[0]);
    return `이번 호는 ${topic}${objectParticle(topic)} 중심으로 전해드려요.`;
  }
  if (next.length) {
    const topic = extractTopic(next[0]);
    return `이번 호는 ${topic}${objectParticle(topic)} 중심으로 전해드려요.`;
  }
  return `${TEAM_NAME}의 최근 2주 진행 상황을 보기 좋게 정리했어요.`;
}

function toNewsletterSentence(text: string): string {
  let sentence = text.replace(/\s+/g, " ").trim();
  sentence = sentence.replace(/함\.?$/g, "했어요.");
  sentence = sentence.replace(/완료\.?$/g, "완료했어요.");
  sentence = sentence.replace(/필요\.?$/g, "필요해요.");
  sentence = sentence.replace(/예정\.?$/g, "예정이에요.");

  return normalizeNewsletterSentence(sentence);
}

function trimEndMark(text: string): string {
  return text.replace(/[.!?。]$/, "");
}

function extractTopic(text: string): string {
  const sentence = trimEndMark(text).replace(/\s+/g, " ").trim();
  const subject = sentence.match(/^(.{3,35}?)(?:은|는)\s/);
  if (subject) {
    return subject[1].trim();
  }

  return sentence
    .replace(/(?:했어요|됐어요|있어요|없어요|이에요|예요)$/g, "")
    .replace(/\s*(?:소식|건|작업|과제)$/g, (match) => match.trim())
    .trim()
    .slice(0, 36);
}

function objectParticle(text: string): string {
  return hasFinalConsonant(text.at(-1) ?? "") ? "을" : "를";
}

function hasFinalConsonant(char: string): boolean {
  const code = char.charCodeAt(0);
  const hangulStart = 0xac00;
  const hangulEnd = 0xd7a3;

  if (code < hangulStart || code > hangulEnd) {
    return false;
  }

  return (code - hangulStart) % 28 !== 0;
}

function imagePrompt(prompt: string): string {
  return `${prompt} Make it look like a real professional photo, not an illustration or cartoon. Use editorial lighting, clean composition, realistic Korean adult professionals or hands when people are useful. Avoid children, minors, schoolchildren, elementary or middle school students, and Chinese-specific visual settings. No logos, no watermark, no readable text.`;
}

function formatKoreanDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
