import type { Newsletter, NewsletterSection, RawReport } from "./types";
import { normalizeNewsletterItems, normalizeNewsletterSentence } from "./korean-style";

const TEAM_NAME = "디지털콘텐츠전환TF";

export function buildNewsletter(input: RawReport | RawReport[]): Newsletter {
  const reports = Array.isArray(input) ? input : [input];
  if (!reports.length) {
    throw new Error("뉴스레터로 만들 업무보고가 없습니다.");
  }

  const latestReport = [...reports].sort((a, b) => b.parsedTime - a.parsedTime)[0];
  const displayMonth = toDisplayMonth(latestReport.displayDate);
  const contentSections = deduplicateNewsletterSections(
    mergeReportSections(reports.map(buildReportSections)),
  );
  const summary = buildSummarySection(contentSections);
  const sections = summary ? [summary, ...contentSections] : contentSections;

  return {
    subject: `[${TEAM_NAME}] ${displayMonth} 격주 뉴스레터`,
    teamName: TEAM_NAME,
    sourceDate: latestReport.displayDate,
    displayMonth,
    sourceRange: reports.map((report) => report.sourceRange).join(" | "),
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

function buildReportSections(report: RawReport): NewsletterSection[] {
  const signals = parseSignalSections(report.signals);
  const bright = compactBullets([signals["긍정 신호"], signals["새로운 기회"]], 4);
  const focus = compactBullets([report.operations], 4);
  const watching = compactBullets([signals["약한 신호"], signals["리스크"]], 4);
  const next = extractTopItems(report.next);
  const request = compactBullets([report.support, report.request], 3);

  return [
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
      body: request,
      imagePrompt: imagePrompt(
        `A photorealistic collaborative review photo of Korean adult coworkers giving feedback on a newsletter or content draft. Show annotated printouts, comment notes, a tablet with blurred layout blocks, coffee cups, and relaxed teamwork in a small review corner rather than a formal boardroom. Collaboration notes: ${request.join(" ")}`,
      ),
    },
  ];
}

function mergeReportSections(reportSections: NewsletterSection[][]): NewsletterSection[] {
  const templates = reportSections[0] ?? [];

  return templates.map((template, sectionIndex) => {
    const combinedBody = reportSections.flatMap(
      (sections) => sections[sectionIndex]?.body ?? [],
    );
    const body = combinedBody.length ? combinedBody : [emptySectionMessage(template.id)];

    return {
      ...template,
      body,
      imagePrompt: `${template.imagePrompt} Combined newsletter section content: ${body.join(" ")}`,
    };
  });
}

const DEDUPLICATION_PRIORITY = ["bright", "focus", "watching", "next", "request"] as const;

function deduplicateNewsletterSections(sections: NewsletterSection[]): NewsletterSection[] {
  const selected: Array<{ sectionId: string; text: string }> = [];
  const sectionsById = new Map(sections.map((section) => [section.id, section]));

  for (const sectionId of DEDUPLICATION_PRIORITY) {
    const section = sectionsById.get(sectionId);
    if (!section) continue;

    for (const text of section.body) {
      const duplicateIndex = selected.findIndex((item) => areDuplicateItems(item.text, text));
      if (duplicateIndex === -1) {
        selected.push({ sectionId, text });
        continue;
      }

      const duplicate = selected[duplicateIndex];
      if (duplicate.sectionId === sectionId && informationScore(text) > informationScore(duplicate.text)) {
        selected[duplicateIndex] = { sectionId, text };
      }
    }
  }

  return sections.map((section) => {
    const body = selected
      .filter((item) => item.sectionId === section.id)
      .map((item) => item.text);

    return {
      ...section,
      body: body.length ? body : [emptySectionMessage(section.id)],
    };
  });
}

function areDuplicateItems(left: string, right: string): boolean {
  const normalizedLeft = normalizeDuplicateText(left);
  const normalizedRight = normalizeDuplicateText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const shorter = normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer = shorter === normalizedLeft ? normalizedRight : normalizedLeft;
  if (shorter.length >= 28 && longer.includes(shorter) && shorter.length / longer.length >= 0.72) {
    return true;
  }

  return trigramSimilarity(normalizedLeft, normalizedRight) >= 0.86;
}

function normalizeDuplicateText(text: string): string {
  return text
    .toLowerCase()
    .replace(/(?:했습니다|했어요|합니다|해요|됐어요|돼요|이에요|예요|입니다)$/u, "")
    .replace(/[^0-9a-z가-힣]/giu, "");
}

function trigramSimilarity(left: string, right: string): number {
  const leftTrigrams = trigrams(left);
  const rightTrigrams = trigrams(right);
  if (!leftTrigrams.size || !rightTrigrams.size) return 0;

  const intersection = [...leftTrigrams].filter((value) => rightTrigrams.has(value)).length;
  const union = new Set([...leftTrigrams, ...rightTrigrams]).size;
  return union ? intersection / union : 0;
}

function trigrams(value: string): Set<string> {
  if (value.length < 3) return new Set([value]);
  return new Set(Array.from({ length: value.length - 2 }, (_, index) => value.slice(index, index + 3)));
}

function informationScore(text: string): number {
  const anchors = text.match(/\d+(?:[.,/]\d+)*(?:%|원|종|명|건|월|일)?|[A-Za-z][A-Za-z0-9-]*/g)?.length ?? 0;
  return text.length + anchors * 12;
}

function emptySectionMessage(sectionId: string): string {
  if (sectionId === "bright") {
    return "이번 보고서에는 별도로 작성된 긍정 신호가 없습니다.";
  }

  if (sectionId === "request") {
    return "이번 호의 별도 협업 요청은 없습니다.";
  }

  return "이번 보고서에는 해당 내용이 별도로 작성되지 않았습니다.";
}

function toDisplayMonth(value: string): string {
  const match = value.trim().match(/(\d{1,2})\s*월/);
  return match ? `${Number(match[1])}월` : value;
}

function parseSignalSections(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  let currentKey: SignalSectionKey | null = null;
  let currentLines: string[] = [];

  const flushCurrentSection = () => {
    if (!currentKey) {
      return;
    }

    const content = currentLines.join("\n").trim();
    if (content) {
      result[currentKey] = [result[currentKey], content].filter(Boolean).join("\n");
    }
    currentLines = [];
  };

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const heading = parseSignalHeading(line);
    if (heading) {
      flushCurrentSection();
      currentKey = heading.key;
      currentLines = heading.inlineContent ? [heading.inlineContent] : [];
      continue;
    }

    if (currentKey) {
      currentLines.push(line);
    }
  }

  flushCurrentSection();

  return result;
}

type SignalSectionKey = "긍정 신호" | "약한 신호" | "새로운 기회" | "리스크";

function parseSignalHeading(
  line: string,
): { key: SignalSectionKey; inlineContent: string } | null {
  const match = line.match(
    /^\s*(?:[-•▪◦‣ㄴ]\s*)?(긍정\s*신호|약한\s*신호|새로운\s*기회|리스크)\s*(?::|：)?\s*(.*)$/u,
  );
  if (!match) {
    return null;
  }

  const normalizedLabel = match[1].replace(/\s+/g, "");
  const keyByLabel: Record<string, SignalSectionKey> = {
    긍정신호: "긍정 신호",
    약한신호: "약한 신호",
    새로운기회: "새로운 기회",
    리스크: "리스크",
  };

  return {
    key: keyByLabel[normalizedLabel],
    inlineContent: match[2].trim(),
  };
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
  const heading = parseSignalHeading(line.replace(/[.。]$/g, ""));
  return Boolean(heading && !heading.inlineContent);
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

function buildSummarySection(sections: NewsletterSection[]): NewsletterSection | null {
  const sectionLabels: Array<{ id: string; label: string }> = [
    { id: "bright", label: "성과와 기회" },
    { id: "focus", label: "핵심 업무" },
    { id: "next", label: "다음 2주" },
  ];
  const parts = sectionLabels.flatMap(({ id, label }) => {
    const section = sections.find((candidate) => candidate.id === id);
    const item = section?.body
      .filter(isConcreteSummaryItem)
      .sort((left, right) => informationScore(right) - informationScore(left))[0];
    return item ? [`${label}: ${item}`] : [];
  });

  if (!parts.length) {
    return null;
  }

  const summary = parts.join(" ");
  return {
    id: "summary",
    eyebrow: "이번 호 한입 요약",
    title: "이번 호 핵심 흐름",
    tone: "sun",
    body: [summary],
    imagePrompt: imagePrompt(
      `A photorealistic editorial overview photo for a Korean education technology and publishing team newsletter. Show a varied workspace with printed books, digital textbooks, a tablet, a calendar, sticky planning notes, and one laptop partly off to the side under warm natural daylight. Main story: ${summary}`,
    ),
  };
}

function isConcreteSummaryItem(item: string): boolean {
  const normalized = item.replace(/\s+/g, " ").trim();
  if (normalized.length < 8) return false;

  return !/^(?:없음|해당 없음)|이번 (?:보고서|호).*?(?:없(?:습니다|어요)|작성되지 않았습니다)/u.test(normalized);
}

function toNewsletterSentence(text: string): string {
  let sentence = text.replace(/\s+/g, " ").trim();
  sentence = sentence.replace(/함\.?$/g, "했어요.");
  sentence = sentence.replace(/완료\.?$/g, "완료했어요.");
  sentence = sentence.replace(/필요\.?$/g, "필요해요.");
  sentence = sentence.replace(/예정\.?$/g, "예정이에요.");

  return normalizeNewsletterSentence(sentence);
}

function imagePrompt(prompt: string): string {
  return `${prompt} Make it look like a real professional photo, not an illustration or cartoon. Use editorial lighting, clean composition, and a realistic Seoul office or Korean education-publishing workplace atmosphere. When people are useful, show Korean or East Asian adult professionals, coworkers, presenters, or hands at work. Avoid Western stock-photo casting, children, minors, schoolchildren, elementary or middle school students, and Chinese-specific visual settings. No logos, no watermark, no readable text.`;
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
