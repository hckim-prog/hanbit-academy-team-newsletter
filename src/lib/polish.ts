import OpenAI from "openai";
import type { Newsletter } from "./types";
import { normalizeNewsletterItems, normalizeNewsletterSentence } from "./korean-style";

export type PolishStyle = "concise" | "expand" | "natural";

export async function polishNewsletter(newsletter: Newsletter, style: PolishStyle = "concise"): Promise<Newsletter> {
  if (!process.env.OPENAI_API_KEY) {
    return applyLocalPolish(newsletter);
  }

  try {
    const openai = new OpenAI();
    const response = await openai.responses.create({
      model: process.env.OPENAI_TEXT_MODEL ?? process.env.OPENAI_RESPONSES_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            [
              "You polish Korean internal newsletters for Hanbit Academy members.",
              "Keep facts, dates, names, numbers, and section meanings unchanged. Do not add new facts.",
              "Rewrite body sentences in a consistent friendly-professional Korean 요체.",
              "Every body item must end with 요체, not 음체, 명사형, or report fragments.",
              "Do not mix report-style nominal endings such as 진행, 완료, 예정, 검토, 확인, 필요, 요청, 공유 as sentence endings.",
              "Do not leave noun-list fragments as complete sentences, such as '교수용 자료, 학생 안내문, 태블릿 현장 설명용 자료.' Rewrite them as natural 요체, such as '교수용 자료, 학생 안내문, 태블릿 현장 설명용 자료예요.'",
              "Turn those nominal endings into natural predicates such as 진행했어요, 완료했어요, 예정이에요, 검토하고 있어요, 확인했어요, 필요해요, 요청드려요, 공유해요.",
              styleInstruction(style),
              "Remove duplicate wording, repeated dates, and repeated newsletter titles.",
              "Avoid long compound clauses. Split them into separate simple sentences.",
              "Keep a warm, lively, concise tone. Do not become childish.",
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
                "Each body item should be one clear sentence whenever possible.",
                userStyleInstruction(style),
                "All body items should end naturally in 요체, for example ~해요, ~했어요, ~예정이에요, ~필요해요, ~좋아요.",
                "Do not end body items with bare nouns, noun lists, or report fragments.",
                "Return valid JSON only with keys heroTitle, sections, closing.",
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
    console.error("OpenAI polish failed; using local Korean style fallback.", error);
    return applyLocalPolish(newsletter);
  }
}

function styleInstruction(style: PolishStyle) {
  if (style === "expand") {
    return "Make sparse body items slightly more informative and easier to understand. Add only clarifying context that is directly implied by the original text. Prefer 1-2 short sentences per item, under 80 Korean characters total.";
  }

  if (style === "natural") {
    return "Keep roughly the same length, but make the wording smoother, more conversational, and easier to read. Do not shorten aggressively or add new context.";
  }

  return "Make every body sentence short and easy to scan. Prefer 1 sentence under 45 Korean characters; use 2 short sentences if needed.";
}

function userStyleInstruction(style: PolishStyle) {
  if (style === "expand") {
    return "Use the expand style: keep facts unchanged, but add a little context so readers understand why the item matters.";
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
