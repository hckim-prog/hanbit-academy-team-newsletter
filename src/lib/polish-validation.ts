export function assertAnchorsPreserved(source: string, output: string) {
  const anchors = source.match(/(?:\d+[./:-]?)+\d*|[A-Z][A-Z0-9-]{1,}/g) ?? [];
  for (const anchor of anchors) {
    if (!isAnchorPreserved(anchor, output)) {
      throw new Error(`AI 결과에서 원문 식별 정보가 누락됐습니다: ${anchor}`);
    }
  }
}

export function isAnchorPreserved(anchor: string, output: string): boolean {
  if (output.includes(anchor)) return true;

  const monthDay = anchor.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (monthDay) {
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    const normalizedOutput = output.replace(/\s+/g, "");
    return normalizedOutput.includes(`${month}월${day}일`)
      || normalizedOutput.includes(`${month}.${day}`)
      || normalizedOutput.includes(`${month}-${day}`)
      || normalizedOutput.includes(`${month}/${day}`);
  }

  return false;
}
