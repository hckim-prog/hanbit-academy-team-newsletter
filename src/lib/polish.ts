import OpenAI from "openai";
import type { Newsletter } from "./types";
import { normalizeNewsletterItems, normalizeNewsletterSentence } from "./korean-style";

export type PolishStyle = "concise" | "expand" | "natural";

let skipRemotePolishUntilRestart = false;

export async function polishNewsletter(newsletter: Newsletter, style: PolishStyle = "concise"): Promise<Newsletter> {
  if (!process.env.OPENAI_API_KEY || skipRemotePolishUntilRestart) {
    return applyLocalPolish(newsletter);
  }

  try {
    const openai = new OpenAI({ maxRetries: 0 });
    const response = await openai.responses.create({
      model: process.env.OPENAI_TEXT_MODEL ?? process.env.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini",
      text: {
        format: {
          type: "json_schema",
          name: "polished_korean_newsletter",
          strict: true,
          schema: {
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
          },
        },
      },
      input: [
        {
          role: "system",
          content:
            [
              "You polish Korean internal newsletters for Hanbit Academy members.",
              "Keep facts, dates, names, numbers, and section meanings unchanged. Do not add new facts.",
              "Rewrite body sentences in clear, grammatically complete, friendly-professional Korean 요체.",
              "Every item must make the subject or topic, the action, and the current result understandable without seeing the source spreadsheet.",
              "Preserve meaningful context instead of reducing an item to a short headline or noun fragment.",
              "Remove source list markers such as 1., 2), (3), and circled numbers, but preserve meaningful forms such as 1차, 2주, dates, quantities, and model names.",
              "Every body item must end with 요체, not 음체, 명사형, or report fragments.",
              "Do not mix report-style nominal endings such as 진행, 완료, 예정, 검토, 확인, 필요, 요청, 공유 as sentence endings.",
              "Do not leave noun-list fragments as complete sentences, such as '교수용 자료, 학생 안내문, 태블릿 현장 설명용 자료.' Rewrite them as natural 요체, such as '교수용 자료, 학생 안내문, 태블릿 현장 설명용 자료예요.'",
              "Turn those nominal endings into natural predicates such as 진행했어요, 완료했어요, 예정이에요, 검토하고 있어요, 확인했어요, 필요해요, 요청드려요, 공유해요.",
              styleInstruction(style),
              "Remove duplicate wording, repeated dates, and repeated newsletter titles.",
              "Correct awkward spacing, particles, predicates, and word order using standard Korean writing conventions.",
              "Prefer one complete sentence. Use two connected short sentences when one sentence cannot preserve the context.",
              "Keep a warm, lively, informative tone. Do not become childish or vague.",
            ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              [
                "Polish only heroTitle, section titles, section body sentences, and closing.",
                "Keep ids, tones, image prompts, image urls, subject, sourceDate, and metadata unchanged.",
                "For section body arrays, you may split one long item into multiple shorter bullet items.",
                "Each body item should be one or two complete sentences that explain what happened or what is being done.",
                userStyleInstruction(style),
                "All body items should end naturally in 요체, for example ~해요, ~했어요, ~예정이에요, ~필요해요, ~좋아요.",
                "Do not end body items with bare nouns, noun lists, or report fragments.",
                "Never include leading list numbers in titles or body items.",
                "Return JSON matching the provided schema with keys heroTitle, sections, closing.",
                "sections must be array of {id,title,body}.",
              ].join(" "),
            newsletter,
          }),
        },
      ],
    });

    const text = response.output_text?.trim();
    if (!text) {
      throw new Error("문장체 다듬기 결과가 비어 있습니다.");
    }

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
              body: normalizeNewsletterItems(polished.body?.length ? polished.body : section.body, 6),
            }
          : {
              ...section,
              body: normalizeNewsletterItems(section.body, 6),
            };
      }),
      closing: normalizeNewsletterSentence(parsed.closing || newsletter.closing),
    };
  } catch (error) {
    if (isBillingLimitError(error)) {
      skipRemotePolishUntilRestart = true;
    }
    console.error("OpenAI polish failed; using local Korean style fallback.", error);
    return applyLocalPolish(newsletter);
  }
}

function isBillingLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: unknown; error?: { code?: unknown } };
  return (
    candidate.code === "billing_hard_limit_reached" ||
    candidate.error?.code === "billing_hard_limit_reached"
  );
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
      body: normalizeNewsletterItems(section.body, 6),
    })),
    closing: normalizeNewsletterSentence(newsletter.closing),
  };
}
