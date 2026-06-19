import type { Newsletter, NewsletterSection, RawReport } from "./types";

const TEAM_NAME = "디지털콘텐츠전환TF";

export function buildNewsletter(report: RawReport): Newsletter {
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
        "A compact cheerful editorial illustration showing a digital transformation team newsletter overview, bright office desk, sticky notes, tablet, books, clean Korean edtech vibe, no text.",
      ),
    },
    {
      id: "focus",
      eyebrow: "집중 모드",
      title: "지금 가장 열심히 챙기는 일",
      tone: "mint",
      body: focus,
      imagePrompt: imagePrompt(
        "A cute energetic editorial illustration of a team organizing digital textbooks, tablets, checklists, and class materials for sales field use, playful but professional, no text.",
      ),
    },
    {
      id: "bright",
      eyebrow: "반짝 소식",
      title: "좋은 신호가 보였어요",
      tone: "sky",
      body: bright,
      imagePrompt: imagePrompt(
        "A lively optimistic illustration of students joining an online seminar, video call tiles, cheerful learning atmosphere, warm colors, no text.",
      ),
    },
    {
      id: "watching",
      eyebrow: "체크 포인트",
      title: "차근차근 살펴보는 중",
      tone: "coral",
      body: watching,
      imagePrompt: imagePrompt(
        "A neat editorial illustration of quality checks for digital purchase links and data files, magnifying glass, calendar, folder, small UI panels, no text.",
      ),
    },
    {
      id: "next",
      eyebrow: "다음 2주",
      title: "집중해서 볼 우선순위",
      tone: "violet",
      body: next,
      imagePrompt: imagePrompt(
        "A playful roadmap illustration with three priority markers, digital books, AI data cloud, seminar follow-up notes, clean vector style, no text.",
      ),
    },
    {
      id: "request",
      eyebrow: "함께 보기",
      title: "같이 봐주시면 좋아요",
      tone: "sky",
      body: request.length ? request : ["이번 호의 별도 협업 요청은 없습니다."],
      imagePrompt: imagePrompt(
        "A friendly collaboration illustration with coworkers reviewing a polished newsletter and sharing feedback, soft office colors, no text.",
      ),
    },
  ];

  return {
    subject: `[${TEAM_NAME}] ${report.displayDate} 격주 뉴스레터`,
    teamName: TEAM_NAME,
    sourceDate: report.displayDate,
    sourceRange: report.sourceRange,
    generatedAt: formatKoreanDateTime(new Date()),
    heroTitle: "디콘전TF 소식이 도착했어요",
    heroSubtitle: `${report.displayDate} 기준으로 정리한 ${TEAM_NAME} 격주 뉴스레터입니다.`,
    heroImagePrompt: imagePrompt(
      "A bright charming hero illustration for a Korean digital content transformation team newsletter. Show books becoming tablets, a friendly AI sparkle, seminar screen, soft modern office, cute but professional editorial style, no readable text.",
    ),
    sections,
    closing: "다음 소식도 가볍게 읽히지만 알맹이는 또렷하게 정리해 올게요.",
  };
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
    .filter((line) => line && line !== "없음")
    .map(toNewsletterSentence);

  return [...new Set(items)].slice(0, limit);
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
    return `이번 호는 ${trimEndMark(bright[0])} 소식을 중심으로 전해드려요.`;
  }
  if (next.length) {
    return `이번 호는 ${trimEndMark(next[0])}를 중심으로 전해드려요.`;
  }
  return `${TEAM_NAME}의 최근 2주 진행 상황을 보기 좋게 정리했어요.`;
}

function toNewsletterSentence(text: string): string {
  let sentence = text.replace(/\s+/g, " ").trim();
  sentence = sentence.replace(/함\.?$/g, "했어요.");
  sentence = sentence.replace(/완료\.?$/g, "완료했어요.");
  sentence = sentence.replace(/필요\.?$/g, "필요해요.");
  sentence = sentence.replace(/예정\.?$/g, "예정이에요.");

  if (!/[.!?。]$/.test(sentence)) {
    sentence += ".";
  }
  return sentence;
}

function trimEndMark(text: string): string {
  return text.replace(/[.!?。]$/, "");
}

function imagePrompt(prompt: string): string {
  return `${prompt} Use a bright newsletter-ready composition, rounded friendly shapes, rich but clean color palette, no logos, no watermark, no readable letters.`;
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
