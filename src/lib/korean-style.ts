export function normalizeNewsletterItems(items: string[], maxItems = 5): string[] {
  return items
    .flatMap((item) => splitReadableSentences(item))
    .map(normalizeNewsletterSentence)
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeNewsletterSentence(text: string): string {
  let sentence = text.replace(/\s+/g, " ").trim();
  sentence = sentence.replace(/^[-•ㄴ\s]+/, "").trim();
  sentence = sentence.replace(/[.。]+$/g, "");

  const replacements: Array<[RegExp, string]> = [
    [/했습니다$/g, "했어요"],
    [/합니다$/g, "해요"],
    [/됩니다$/g, "돼요"],
    [/됐습니다$/g, "됐어요"],
    [/있습니다$/g, "있어요"],
    [/없습니다$/g, "없어요"],
    [/입니다$/g, "이에요"],
    [/확인됨$/g, "확인됐어요"],
    [/관리됨$/g, "관리됐어요"],
    [/정리됨$/g, "정리됐어요"],
    [/전환됨$/g, "전환됐어요"],
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
  ];

  for (const [pattern, replacement] of replacements) {
    sentence = sentence.replace(pattern, replacement);
  }

  if (!/[.!?。]$/.test(sentence)) {
    sentence += ".";
  }

  return sentence;
}

function splitReadableSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= 70) {
    return [normalized];
  }

  const sentenceParts = normalized
    .split(/(?<=[.!?。])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentenceParts.length > 1) {
    return sentenceParts;
  }

  return normalized
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<string[]>((chunks, part) => {
      const last = chunks[chunks.length - 1];
      if (!last || `${last}, ${part}`.length > 58) {
        chunks.push(part);
      } else {
        chunks[chunks.length - 1] = `${last}, ${part}`;
      }
      return chunks;
    }, []);
}
