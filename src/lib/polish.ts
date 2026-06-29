import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import type { AiCredentials, Newsletter } from "./types";
import { normalizeNewsletterItems, normalizeNewsletterSentence } from "./korean-style";

export type PolishStyle = "concise" | "expand" | "natural";

let skipRemotePolishUntilRestart = false;
const MAX_SECTION_ITEMS = 18;

const polishSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    heroTitle: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          body: { type: "array", items: { type: "string" } },
        },
        required: ["id", "title", "body"],
      },
    },
    closing: { type: "string" },
  },
  required: ["heroTitle", "sections", "closing"],
} as const;

type PolishOptions = AiCredentials & { allowRemote?: boolean };

export async function polishNewsletter(
  newsletter: Newsletter,
  style: PolishStyle = "concise",
  options: PolishOptions = {},
): Promise<Newsletter> {
  const userProvidedCredentials = Boolean(options.openAiApiKey || options.geminiApiKey);
  if (options.allowRemote === false && !userProvidedCredentials) {
    return applyLocalPolish(newsletter);
  }

  const geminiApiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY;
  const openAiApiKey = options.openAiApiKey ?? process.env.OPENAI_API_KEY;
  const providers: Array<{ name: "Gemini" | "OpenAI"; run: () => Promise<string> }> = [];

  if (geminiApiKey) {
    providers.push({
      name: "Gemini",
      run: () => polishWithGemini(newsletter, style, geminiApiKey),
    });
  }
  if (openAiApiKey && (!skipRemotePolishUntilRestart || options.openAiApiKey)) {
    providers.push({
      name: "OpenAI",
      run: () => polishWithOpenAi(newsletter, style, openAiApiKey),
    });
  }

  for (const provider of providers) {
    try {
      return mergePolishResult(newsletter, await provider.run());
    } catch (error) {
      if (provider.name === "OpenAI" && !options.openAiApiKey && isBillingLimitError(error)) {
        skipRemotePolishUntilRestart = true;
      }
      console.error(`${provider.name} polish failed; trying the next fallback.`, safeAiError(error));
    }
  }

  return applyLocalPolish(newsletter);
}

async function polishWithOpenAi(
  newsletter: Newsletter,
  style: PolishStyle,
  apiKey: string,
): Promise<string> {
  const openai = new OpenAI({ apiKey, maxRetries: 0 });
  const response = await openai.responses.create({
    model: process.env.OPENAI_TEXT_MODEL ?? process.env.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini",
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
  if (!text) {
    throw new Error("OpenAI 문장체 다듬기 결과가 비어 있습니다.");
  }
  return text;
}

async function polishWithGemini(
  newsletter: Newsletter,
  style: PolishStyle,
  apiKey: string,
): Promise<string> {
  const gemini = new GoogleGenAI({ apiKey });
  const response = await gemini.models.generateContent({
    model: process.env.GEMINI_TEXT_MODEL ?? "gemini-3.5-flash",
    contents: polishRequest(newsletter, style),
    config: {
      systemInstruction: systemInstruction(style),
      responseMimeType: "application/json",
      responseJsonSchema: polishSchema,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Gemini 문장체 다듬기 결과가 비어 있습니다.");
  }
  return text;
}

function systemInstruction(style: PolishStyle): string {
  return [
    "You polish Korean internal newsletters for Hanbit Academy members.",
    "Keep facts, dates, names, numbers, section meanings, and body item order unchanged. Do not add or omit facts.",
    "Rewrite body sentences in clear, grammatically complete, friendly-professional Korean 요체.",
    "Every item must make the subject or topic, the action, and the current result understandable without seeing the source spreadsheet.",
    "Preserve meaningful context instead of reducing an item to a short headline or noun fragment.",
    "Remove source list markers such as 1., 2), (3), and circled numbers, but preserve meaningful forms such as 1차, 2주, dates, quantities, and model names.",
    "Every body item must end with 요체, not 음체, 명사형, or report fragments.",
    "Correct awkward spacing, particles, predicates, and word order using standard Korean writing conventions.",
    styleInstruction(style),
    "Keep a warm, lively, informative tone. Do not become childish or vague.",
  ].join(" ");
}

function polishRequest(newsletter: Newsletter, style: PolishStyle): string {
  return JSON.stringify({
    instruction: [
      "Polish only heroTitle, section titles, section body sentences, and closing.",
      "Keep ids, tones, image prompts, image urls, subject, sourceDate, and metadata unchanged.",
      "Preserve every body item and its original order. Never regroup items by person or topic.",
      "Each body item should be one or two complete sentences that explain what happened or what is being done.",
      userStyleInstruction(style),
      "All body items should end naturally in 요체.",
      "Never include leading list numbers in titles or body items.",
      "Return JSON matching the provided schema with keys heroTitle, sections, closing.",
    ].join(" "),
    newsletter,
  });
}

function mergePolishResult(newsletter: Newsletter, text: string): Newsletter {
  const parsed = parsePolishResult(text);
  return {
    ...newsletter,
    heroTitle: parsed.heroTitle || newsletter.heroTitle,
    sections: newsletter.sections.map((section) => {
      const polished = parsed.sections.find((item) => item.id === section.id);
      return polished
        ? {
            ...section,
            title: polished.title || section.title,
            body: normalizeNewsletterItems(
              polished.body?.length ? polished.body : section.body,
              MAX_SECTION_ITEMS,
            ),
          }
        : {
            ...section,
            body: normalizeNewsletterItems(section.body, MAX_SECTION_ITEMS),
          };
    }),
    closing: normalizeNewsletterSentence(parsed.closing || newsletter.closing),
  };
}

function isBillingLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; error?: { code?: unknown } };
  return (
    candidate.code === "billing_hard_limit_reached" ||
    candidate.error?.code === "billing_hard_limit_reached" ||
    candidate.code === "insufficient_quota" ||
    candidate.error?.code === "insufficient_quota"
  );
}

function safeAiError(error: unknown): { name?: string; code?: unknown; status?: unknown } {
  if (!error || typeof error !== "object") {
    return {};
  }

  const candidate = error as { name?: string; code?: unknown; status?: unknown };
  return {
    name: candidate.name,
    code: candidate.code,
    status: candidate.status,
  };
}

function styleInstruction(style: PolishStyle) {
  if (style === "expand") {
    return "Make sparse body items informative enough to understand on their own. Add only clarifying context directly implied by the original text. Prefer 1-2 sentences and roughly 45-120 Korean characters per item; do not shorten a meaningful item merely to meet a character target.";
  }

  if (style === "natural") {
    return "Keep roughly the same length, but make the wording smoother, more conversational, and easier to read. Do not shorten aggressively or add new context.";
  }

  return "Make every body sentence short and easy to scan. Prefer 1 sentence under 45 Korean characters; use 2 short sentences if needed.";
}

function userStyleInstruction(style: PolishStyle) {
  if (style === "expand") {
    return "Use the expand style: keep facts unchanged, restore omitted subjects or predicates when they are clear from context, and explain the action and result so readers understand the item without the spreadsheet.";
  }

  if (style === "natural") {
    return "Use the natural style: keep length similar, smooth awkward phrasing, and make the tone friendly-professional.";
  }

  return "Use the concise style: remove filler, shorten long clauses, and keep the core point only.";
}

function parsePolishResult(text: string) {
  const normalized = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(normalized) as {
    heroTitle?: string;
    sections?: Array<{ id: string; title?: string; body?: string[] }>;
    closing?: string;
  };

  return {
    heroTitle: parsed.heroTitle,
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    closing: parsed.closing,
  };
}

function applyLocalPolish(newsletter: Newsletter): Newsletter {
  return {
    ...newsletter,
    sections: newsletter.sections.map((section) => ({
      ...section,
      body: normalizeNewsletterItems(section.body, MAX_SECTION_ITEMS),
    })),
    closing: normalizeNewsletterSentence(newsletter.closing),
  };
}
