import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNewsletterSentence } from "./korean-style";

test("하겠습니다로 끝나는 계획은 할 예정이에요로 바꾼다", () => {
  const cases = [
    ["기본 정보를 확정해 일괄 등록 가능한 상태로 정리하겠습니다.", "기본 정보를 확정해 일괄 등록 가능한 상태로 정리할 예정이에요."],
    ["다음 미팅을 준비하겠습니다.", "다음 미팅을 준비할 예정이에요."],
    ["계약 조건을 검토하겠습니다.", "계약 조건을 검토할 예정이에요."],
    ["후속 업무를 진행하겠습니다.", "후속 업무를 진행할 예정이에요."],
  ];

  for (const [source, expected] of cases) {
    assert.equal(normalizeNewsletterSentence(source), expected);
  }
});

test("완료한 업무의 했습니다 종결은 기존처럼 했어요로 유지한다", () => {
  assert.equal(normalizeNewsletterSentence("디지털 교재 등록을 완료했습니다."), "디지털 교재 등록을 완료했어요.");
});
