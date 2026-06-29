export function normalizeNewsletterItems(items: string[], maxItems = 5): string[] {
  return items
    .flatMap((item) => splitReadableSentences(item))
    .map(normalizeNewsletterSentence)
    .filter(Boolean)
    .slice(0, maxItems);
}

export function stripSourceListNumbering(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      let cleaned = line;
      for (let index = 0; index < 3; index += 1) {
        const next = cleaned.replace(
          /^(\s*(?:[-•▪◦‣ㄴ]\s*)?)(?:(?:\(?\d{1,3}\)?[.)])|[①-⑳])\s*/u,
          "$1",
        );
        if (next === cleaned) {
          break;
        }
        cleaned = next;
      }
      return cleaned;
    })
    .join("\n");
}

export function normalizeNewsletterSentence(text: string): string {
  let sentence = stripSourceListNumbering(text).replace(/\s+/g, " ").trim();
  sentence = sentence.replace(/^[-•▪◦‣ㄴ\s]+/, "").trim();
  sentence = sentence.replace(/[.。]+$/g, "");
  sentence = normalizeCommonKoreanSpacing(sentence);
  sentence = rewriteCommonReportFragment(sentence);
  sentence = sentence
    .replace(/했어요\s+소식/g, "한 소식")
    .replace(/됐어요\s+소식/g, "된 소식")
    .replace(/있어요\s+소식/g, "있는 소식")
    .replace(/없어요\s+소식/g, "없는 소식");

  const replacements: Array<[RegExp, string]> = [
    [/했습니다$/g, "했어요"],
    [/합니다$/g, "해요"],
    [/했고$/g, "했어요"],
    [/됐고$/g, "됐어요"],
    [/였고$/g, "였어요"],
    [/었고$/g, "었어요"],
    [/았고$/g, "았어요"],
    [/혔고$/g, "혔어요"],
    [/높고$/g, "높아요"],
    [/낮고$/g, "낮아요"],
    [/됩니다$/g, "돼요"],
    [/됐습니다$/g, "됐어요"],
    [/있습니다$/g, "있어요"],
    [/없습니다$/g, "없어요"],
    [/입니다$/g, "이에요"],
    [/확인됨$/g, "확인됐어요"],
    [/관리됨$/g, "관리됐어요"],
    [/정리됨$/g, "정리됐어요"],
    [/전환됨$/g, "전환됐어요"],
    [/이동$/g, "이동했어요"],
    [/전환$/g, "전환했어요"],
    [/착수$/g, "착수했어요"],
    [/완료됨$/g, "완료됐어요"],
    [/가능함$/g, "가능해요"],
    [/필요함$/g, "필요해요"],
    [/수 있음$/g, "수 있어요"],
    [/있음$/g, "있어요"],
    [/없음$/g, "없어요"],
    [/했음$/g, "했어요"],
    [/냄$/g, "냈어요"],
    [/높음$/g, "높아요"],
    [/낮음$/g, "낮아요"],
    [/늘어남$/g, "늘어났어요"],
    [/나타남$/g, "나타났어요"],
    [/줄어듦$/g, "줄었어요"],
    [/거\s*같음$/g, "것 같아요"],
    [/것\s*같음$/g, "것 같아요"],
    [/됨$/g, "됐어요"],
    [/함$/g, "했어요"],
    [/임$/g, "이에요"],
    [/완료$/g, "완료했어요"],
    [/예정$/g, "예정이에요"],
    [/필요$/g, "필요해요"],
    [/요청$/g, "요청드려요"],
    [/공유$/g, "공유해요"],
    [/확인$/g, "확인했어요"],
    [/검토$/g, "검토하고 있어요"],
    [/진행$/g, "진행하고 있어요"],
    [/고민$/g, "고민하고 있어요"],
  ];

  for (const [pattern, replacement] of replacements) {
    sentence = sentence.replace(pattern, replacement);
  }

  sentence = completeNominalEnding(sentence);

  if (!/[.!?。]$/.test(sentence)) {
    sentence += ".";
  }

  return sentence;
}

function normalizeCommonKoreanSpacing(sentence: string): string {
  return sentence
    .replace(/모객진행/g, "모객 진행")
    .replace(/모객페이지/g, "모객 페이지")
    .replace(/교수전용페이지/g, "교수 전용 페이지")
    .replace(/후속작업/g, "후속 작업")
    .replace(/가격책정/g, "가격 책정")
    .replace(/만드는데는/g, "만드는 데는")
    .replace(/거\s+같/g, "것 같");
}

function rewriteCommonReportFragment(sentence: string): string {
  const scheduledRecruiting = sentence.match(
    /^(.+?)\s+모객\s+진행\s*\((\d{1,2})\/(\d{1,2})\s*~\s*\)$/u,
  );
  if (scheduledRecruiting) {
    const [, topic, month, day] = scheduledRecruiting;
    return `${topic}${topicParticle(topic)} ${Number(month)}월 ${Number(day)}일부터 모객을 진행하고 있어요`;
  }

  const openedInside = sentence.match(/^(.+?)\s+내\s+(.+?)\s+오픈$/u);
  if (openedInside) {
    const [, location, target] = openedInside;
    return `${location}에서 ${target}${objectParticle(target)} 열었어요`;
  }

  const opened = sentence.match(/^(.+?)\s+오픈$/u);
  if (opened) {
    const target = opened[1];
    return `${target}${objectParticle(target)} 열었어요`;
  }

  const completedAndStarted = sentence.match(/^(.+?)\s+완료\s+및\s+착수$/u);
  if (completedAndStarted) {
    const target = completedAndStarted[1];
    return `${target}${objectParticle(target)} 완료하고 다음 작업에 착수했어요`;
  }

  const completed = sentence.match(/^(.+?)\s+완료$/u);
  if (completed) {
    const target = completed[1];
    return `${target}${objectParticle(target)} 완료했어요`;
  }

  if (/후속 작업$/u.test(sentence)) {
    return `${sentence}${objectParticle(sentence)} 진행하고 있어요`;
  }

  if (/\s준비$/u.test(sentence)) {
    return `${sentence}${objectParticle(sentence)} 하고 있어요`;
  }

  return sentence;
}

function completeNominalEnding(sentence: string): string {
  if (!sentence || /[요죠다]$/.test(sentence)) {
    return sentence;
  }

  if (!/[가-힣A-Za-z0-9)%]$/.test(sentence)) {
    return sentence;
  }

  return `${sentence}${hasFinalConsonant(lastMeaningfulChar(sentence)) ? "이에요" : "예요"}`;
}

function lastMeaningfulChar(text: string): string {
  return text.replace(/\s+$/g, "").at(-1) ?? "";
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

function objectParticle(text: string): string {
  return hasFinalConsonant(lastHangulChar(text)) ? "을" : "를";
}

function topicParticle(text: string): string {
  return hasFinalConsonant(lastHangulChar(text)) ? "은" : "는";
}

function lastHangulChar(text: string): string {
  return [...text].reverse().find((char) => /[가-힣]/u.test(char)) ?? "";
}

function splitReadableSentences(text: string): string[] {
  const sourceLines = stripSourceListNumbering(text)
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return sourceLines.flatMap((line) => {
    const sentenceParts = line
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?。])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    return sentenceParts.length ? sentenceParts : [line];
  });
}
