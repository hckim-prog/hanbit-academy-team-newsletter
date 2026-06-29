import "server-only";

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { Newsletter, TextAiProvider, TextAiStatus } from "./types";
import { normalizeNewsletterSentence, stripSourceListNumbering } from "./korean-style";

export type PolishStyle = "concise" | "expand" | "natural";
export type PolishResult = {
  newsletter: Newsletter;
  status: TextAiStatus;
  warnings: string[];
};

type PolishOptions = { allowRemote?: boolean };
type ParsedPolish = {
  heroTitle?: string;
  sections: Array<{ id: string; title?: string; body?: string[] }>;
  closing?: string;
};

let skipOpenAiPolishUntilRestart = false;

const polishSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    heroTitle: { type: "string", description: "이번 호 전체를 아우르는 자연스러운 한국어 제목" },
    sections: {
      type: "array",
      description: "입력과 같은 순서, 같은 id, 같은 본문 항목 수를 유지한 섹션",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string", description: "내용을 구체적으로 설명하는 자연스러운 제목" },
          body: {
            type: "array",
            description: "원문 항목과 일대일로 대응하는 완결된 한국어 문장",
            items: { type: "string" },
          },
        },
        required: ["id", "title", "body"],
      },
    },
    closing: { type: "string" },
  },
  required: ["heroTitle", "sections", "closing"],
} as const;

export async function polishNewsletter(
  newsletter: Newsletter,
  style: PolishStyle = "concise",
  options: PolishOptions = {},
): Promise<PolishResult> {
  if (options.allowRemote === false) {
    return localResult(newsletter, style, false, []);
  }

  const providers: Array<{
    provider: Exclude<TextAiProvider, "local">;
    model?: string;
    run: () => Promise<string>;
  }> = [];
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (geminiApiKey) {
    const geminiModels = [...new Set([
      process.env.GEMINI_TEXT_MODEL ?? "gemini-3.5-flash",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
    ])];
    geminiModels.forEach((model, modelIndex) => {
      providers.push({
        provider: "gemini",
        model,
        run: () => withTransientRetry(
          () => polishWithGemini(newsletter, style, geminiApiKey, model),
          modelIndex === 0 ? 1 : 0,
        ),
      });
    });
  }
  if (openAiApiKey && !skipOpenAiPolishUntilRestart) {
    providers.push({
      provider: "openai",
      run: () => polishWithOpenAi(newsletter, style, openAiApiKey),
    });
  }

  const warnings: string[] = [];
  for (let index = 0; index < providers.length; index += 1) {
    const candidate = providers[index];
    try {
      const polished = mergeAndValidatePolishResult(newsletter, await candidate.run(), style);
      const changed = hasNewsletterTextChanged(newsletter, polished);
      if (!changed && index < providers.length - 1) {
        warnings.push(`${providerLabel(candidate.provider)} 결과에 변경이 없어 다른 문장 엔진을 사용했어요.`);
        continue;
      }
      return {
        newsletter: polished,
        status: { provider: candidate.provider, changed, fallbackUsed: index > 0 },
        warnings,
      };
    } catch (error) {
      if (candidate.provider === "openai" && isBillingLimitError(error)) {
        skipOpenAiPolishUntilRestart = true;
      }
      warnings.push(`${providerLabel(candidate.provider)} 연결이 원활하지 않아 다음 문장 엔진을 사용했어요.`);
      console.warn(`${candidate.provider} polish fallback`, { model: candidate.model, ...safeAiError(error) });
    }
  }

  return localResult(newsletter, style, providers.length > 0, warnings);
}

async function polishWithOpenAi(newsletter: Newsletter, style: PolishStyle, apiKey: string) {
  const openai = new OpenAI({ apiKey, maxRetries: 0, timeout: 35_000 });
  const response = await openai.responses.create({
    model: process.env.OPENAI_TEXT_MODEL ?? process.env.OPENAI_RESPONSES_MODEL ?? "gpt-5.5",
    text: {
      format: {
        type: "json_schema",
        name: "polished_korean_newsletter",
        strict: true,
        schema: polishSchema,
      },
    },
    input: [
      { role: "system", content: systemInstruction(style) },
      { role: "user", content: polishRequest(newsletter, style) },
    ],
  });

  const text = response.output_text?.trim();
  if (!text) throw new Error("OpenAI 문장 다듬기 결과가 비어 있습니다.");
  return text;
}

async function polishWithGemini(
  newsletter: Newsletter,
  style: PolishStyle,
  apiKey: string,
  model: string,
) {
  const gemini = new GoogleGenAI({ apiKey, httpOptions: { timeout: 15_000 } });
  const response = await gemini.models.generateContent({
    model,
    contents: polishRequest(newsletter, style),
    config: {
      systemInstruction: systemInstruction(style),
      responseMimeType: "application/json",
      responseJsonSchema: polishSchema,
    },
  });

  const text = response.text?.trim();
  if (!text) throw new Error("Gemini 문장 다듬기 결과가 비어 있습니다.");
  return text;
}

function systemInstruction(style: PolishStyle) {
  return [
    "<role>당신은 한빛아카데미 사내 뉴스레터의 한국어 책임 편집자입니다.</role>",
    "<grounding>입력에 명시된 사실만 사용합니다. 이름, 날짜, 수치, 제품명, 업무 상태를 추가·추정·삭제하지 않습니다.</grounding>",
    "<structure>섹션 id와 순서, 각 섹션의 본문 항목 수와 항목 순서를 정확히 유지합니다. 각 입력 항목을 정확히 하나의 출력 항목으로 다듬습니다.</structure>",
    "<quality>각 항목만 읽어도 누가 또는 무엇이, 어떤 일을, 어느 상태까지 했는지 알 수 있는 완결된 한국어 요체 문장으로 씁니다. 비문, 명사형 종결, 조사 오류, 중복 표현, 과도한 수동태를 고칩니다.</quality>",
    "<numbers>목록 머리의 1., 2), ① 같은 표지만 제거합니다. 1차, 2주, 날짜, 수량, 버전처럼 의미 있는 숫자는 반드시 보존합니다.</numbers>",
    `<style>${styleInstruction(style)}</style>`,
    "<review>반환 전에 모든 원문 항목이 일대일로 남아 있고 숫자와 날짜가 보존됐는지 스스로 점검합니다. 최종 JSON만 반환합니다.</review>",
  ].join("\n");
}

function polishRequest(newsletter: Newsletter, style: PolishStyle) {
  const editable = {
    heroTitle: newsletter.heroTitle,
    sections: newsletter.sections.map(({ id, title, body }) => ({ id, title, body })),
    closing: newsletter.closing,
  };
  return [
    `<task>뉴스레터 전체를 ${styleLabel(style)} 스타일로 교정하세요. 제목은 구체적으로, 본문은 원문 사실을 보존하면서 독자가 맥락을 이해할 수 있게 다듬으세요.</task>`,
    "<output>제공된 JSON 스키마를 따르세요. 입력과 같은 섹션 수, id, 본문 항목 수를 유지하세요.</output>",
    `<source_json>${JSON.stringify(editable)}</source_json>`,
  ].join("\n");
}

function mergeAndValidatePolishResult(newsletter: Newsletter, text: string, style: PolishStyle) {
  const parsed = parsePolishResult(text);
  if (parsed.sections.length !== newsletter.sections.length) {
    throw new Error("AI 결과의 섹션 수가 원문과 다릅니다.");
  }

  const sections = newsletter.sections.map((section, sectionIndex) => {
    const candidate = parsed.sections[sectionIndex];
    if (!candidate || candidate.id !== section.id || candidate.body?.length !== section.body.length) {
      throw new Error("AI 결과가 원문의 섹션 또는 항목 순서를 보존하지 않았습니다.");
    }

    const body = candidate.body.map((item, itemIndex) => {
      const cleaned = normalizeNewsletterSentence(stripSourceListNumbering(item));
      if (!cleaned) throw new Error("AI 결과에 빈 본문 항목이 있습니다.");
      assertAnchorsPreserved(section.body[itemIndex], cleaned);
      return cleaned;
    });

    return { ...section, title: candidate.title?.trim() || section.title, body };
  });

  const result: Newsletter = {
    ...newsletter,
    heroTitle: parsed.heroTitle?.trim() || newsletter.heroTitle,
    sections,
    closing: normalizeNewsletterSentence(parsed.closing || newsletter.closing),
  };
  assertStyleQuality(newsletter, result, style);
  return result;
}

function parsePolishResult(text: string): ParsedPolish {
  const normalized = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(normalized) as Omit<ParsedPolish, "sections"> & { sections?: ParsedPolish["sections"] };
  return { ...parsed, sections: Array.isArray(parsed.sections) ? parsed.sections : [] };
}

function assertAnchorsPreserved(source: string, output: string) {
  const anchors = source.match(/(?:\d+[./:-]?)+\d*|[A-Z][A-Z0-9-]{1,}/g) ?? [];
  for (const anchor of anchors) {
    if (!output.includes(anchor)) throw new Error(`AI 결과에서 원문 식별 정보가 누락됐습니다: ${anchor}`);
  }
}

function assertStyleQuality(source: Newsletter, output: Newsletter, style: PolishStyle) {
  const before = bodyCharacters(source);
  const after = bodyCharacters(output);
  if (style === "expand" && after < before * 0.82) {
    throw new Error("자세히 다듬은 결과가 원문보다 지나치게 짧습니다.");
  }
  if (style === "concise" && after > before * 1.35) {
    throw new Error("짧게 다듬은 결과가 원문보다 지나치게 깁니다.");
  }
}

function localResult(newsletter: Newsletter, style: PolishStyle, fallbackUsed: boolean, warnings: string[]): PolishResult {
  const polished = applyLocalPolish(newsletter, style);
  return {
    newsletter: polished,
    status: { provider: "local", changed: hasNewsletterTextChanged(newsletter, polished), fallbackUsed },
    warnings,
  };
}

function applyLocalPolish(newsletter: Newsletter, style: PolishStyle): Newsletter {
  return {
    ...newsletter,
    sections: newsletter.sections.map((section) => ({
      ...section,
      body: section.body.map((item) => applyLocalStyle(normalizeNewsletterSentence(item), style)),
    })),
    closing: applyLocalStyle(normalizeNewsletterSentence(newsletter.closing), style),
  };
}

function applyLocalStyle(sentence: string, style: PolishStyle) {
  if (style === "concise") {
    return sentence
      .replace(/진행하고 있어요\./g, "진행 중이에요.")
      .replace(/검토하고 있어요\./g, "검토 중이에요.")
      .replace(/확인하고 있어요\./g, "확인 중이에요.")
      .replace(/준비하고 있어요\./g, "준비 중이에요.");
  }
  if (style === "natural") {
    return sentence
      .replace(/관련하여/g, "관련해")
      .replace(/통하여/g, "통해")
      .replace(/진행 중에 있어요/g, "진행하고 있어요");
  }
  return sentence;
}

async function withTransientRetry<T>(run: () => Promise<T>, retries: number): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= retries || !isTransientError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
    }
  }
}

function isTransientError(error: unknown) {
  const status = safeAiError(error).status;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function hasNewsletterTextChanged(before: Newsletter, after: Newsletter) {
  return JSON.stringify(textSnapshot(before)) !== JSON.stringify(textSnapshot(after));
}

function textSnapshot(newsletter: Newsletter) {
  return {
    heroTitle: newsletter.heroTitle,
    sections: newsletter.sections.map(({ id, title, body }) => ({ id, title, body })),
    closing: newsletter.closing,
  };
}

function bodyCharacters(newsletter: Newsletter) {
  return newsletter.sections.flatMap((section) => section.body).join("").length;
}

function styleInstruction(style: PolishStyle) {
  if (style === "expand") return "짧은 메모도 행동과 현재 결과가 드러나도록 1~2문장, 약 45~120자로 설명하되 원문에 없는 배경은 만들지 않습니다.";
  if (style === "natural") return "길이는 비슷하게 유지하고 딱딱하거나 어색한 표현을 친근하고 전문적인 한국어로 매끄럽게 고칩니다.";
  return "핵심 사실을 모두 남기고 군더더기만 덜어 한 항목을 가급적 한 문장으로 간결하게 씁니다.";
}

function styleLabel(style: PolishStyle) {
  return style === "expand" ? "자세히" : style === "natural" ? "자연스럽게" : "짧게";
}

function providerLabel(provider: Exclude<TextAiProvider, "local">) {
  return provider === "gemini" ? "Gemini" : "OpenAI";
}

function isBillingLimitError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; error?: { code?: unknown } };
  return ["billing_hard_limit_reached", "insufficient_quota"].includes(String(candidate.code ?? candidate.error?.code));
}

function safeAiError(error: unknown): { name?: string; code?: unknown; status?: unknown } {
  if (!error || typeof error !== "object") return {};
  const candidate = error as { name?: string; code?: unknown; status?: unknown };
  return { name: candidate.name, code: candidate.code, status: candidate.status };
}
