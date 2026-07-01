import assert from "node:assert/strict";
import test from "node:test";
import { preserveGroundedSummary } from "./summary-guard";
import type { NewsletterSection } from "./types";

function section(overrides: Partial<NewsletterSection> = {}): NewsletterSection {
  return {
    id: "summary",
    eyebrow: "이번 호 한입 요약",
    title: "이번 호 핵심 흐름",
    tone: "sun",
    body: ["성과와 기회: 디지털 교재 50종을 제작했어요. 다음 2주: 유료 전환 성과를 점검할 예정이에요."],
    imagePrompt: "summary image",
    ...overrides,
  };
}

test("AI가 안내 문구를 반환해도 실제 업무 기반 요약을 보존한다", () => {
  const source = section();
  const candidate = section({
    title: "최근 디콘전TF의 주요 성과와 진행 상황",
    body: ["이번 호에서는 디콘전TF의 최근 성과와 핵심 업무, 그리고 향후 2주간의 우선순위를 간략하게 살펴봅니다."],
  });

  const result = preserveGroundedSummary(source, candidate);

  assert.equal(result.title, source.title);
  assert.deepEqual(result.body, source.body);
  assert.doesNotMatch(result.body[0], /이번 호에서는|살펴봅니다/u);
});

test("요약이 아닌 단락은 AI 교정 결과를 유지한다", () => {
  const source = section({ id: "focus", title: "원래 제목" });
  const candidate = section({ id: "focus", title: "다듬은 제목" });

  assert.equal(preserveGroundedSummary(source, candidate).title, "다듬은 제목");
});
