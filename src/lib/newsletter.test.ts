import assert from "node:assert/strict";
import test from "node:test";
import { buildNewsletter } from "./newsletter";
import type { RawReport } from "./types";

function report(overrides: Partial<RawReport> = {}): RawReport {
  return {
    displayDate: "6월 30일",
    parsedTime: new Date(2026, 5, 30).getTime(),
    sourceRange: "업무보고!A1:F1",
    signals: [
      "긍정 신호",
      "- 디지털 교재 파일럿을 마치고 유료 전환을 준비하고 있어요.",
      "약한 신호",
      "- 구매 데이터가 정상적으로 쌓이는지 확인이 필요해요.",
    ].join("\n"),
    operations: "- 디지털 교재 50종의 제작과 검수를 완료했어요.",
    support: "없음",
    request: "없음",
    next: "Top 1: 유료 전환 성과를 점검할 예정이에요.",
    ...overrides,
  };
}

test("진행 업무는 집중 모드에만 배치하고 체크 포인트에 반복하지 않는다", () => {
  const newsletter = buildNewsletter(report());
  const focus = newsletter.sections.find((section) => section.id === "focus");
  const watching = newsletter.sections.find((section) => section.id === "watching");

  assert.deepEqual(focus?.body, ["디지털 교재 50종의 제작과 검수를 완료했어요."]);
  assert.deepEqual(watching?.body, ["구매 데이터가 정상적으로 쌓이는지 확인이 필요해요."]);
});

test("요약은 실제 성과와 핵심 업무, 다음 2주 내용을 담는다", () => {
  const newsletter = buildNewsletter(report());
  const summary = newsletter.sections.find((section) => section.id === "summary");

  assert.match(summary?.body[0] ?? "", /디지털 교재 파일럿/u);
  assert.match(summary?.body[0] ?? "", /디지털 교재 50종/u);
  assert.match(summary?.body[0] ?? "", /유료 전환 성과/u);
  assert.doesNotMatch(summary?.body[0] ?? "", /한눈에 살펴봅니다/u);
});

test("요약할 실제 업무가 없으면 한입 요약 섹션을 만들지 않는다", () => {
  const newsletter = buildNewsletter(report({
    signals: "없음",
    operations: "없음",
    support: "없음",
    request: "없음",
    next: "없음",
  }));

  assert.equal(newsletter.sections.some((section) => section.id === "summary"), false);
});

test("여러 보고서의 동일하거나 사실상 같은 문장을 한 번만 남긴다", () => {
  const newsletter = buildNewsletter([
    report({ sourceRange: "김호철!A1:F1" }),
    report({
      sourceRange: "김태진!A1:F1",
      operations: "디지털 교재 50종의 제작과 검수를 완료했습니다.",
    }),
  ]);
  const focus = newsletter.sections.find((section) => section.id === "focus");

  assert.equal(focus?.body.length, 1);
  assert.match(focus?.body[0] ?? "", /디지털 교재 50종/u);
});

test("같은 사실이 성과와 진행 업무에 모두 있으면 성과 섹션을 우선한다", () => {
  const duplicate = "디지털 교재 파일럿을 마치고 유료 전환을 준비하고 있어요.";
  const newsletter = buildNewsletter(report({ operations: duplicate }));
  const focus = newsletter.sections.find((section) => section.id === "focus");
  const bright = newsletter.sections.find((section) => section.id === "bright");

  assert.equal(bright?.body.filter((item) => item.includes("파일럿")).length, 1);
  assert.equal(focus?.body.some((item) => item.includes("파일럿")), false);
});
