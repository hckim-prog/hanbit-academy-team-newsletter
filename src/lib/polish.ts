import OpenAI from "openai";
import type { Newsletter } from "./types";

export async function polishNewsletter(newsletter: Newsletter): Promise<Newsletter> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 환경 변수가 필요합니다.");
  }

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
            "Do not mix report-style nominal endings such as 진행, 완료, 예정, 검토, 확인, 필요, 요청, 공유 as sentence endings.",
            "Turn those nominal endings into natural predicates such as 진행했어요, 완료했어요, 예정이에요, 검토하고 있어요, 확인했어요, 필요해요, 요청드려요, 공유해요.",
            "Make every body sentence short and easy to scan. Prefer 1 sentence under 45 Korean characters; use 2 short sentences if needed.",
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
              "All body items should end naturally in 요체, for example ~해요, ~했어요, ~예정이에요, ~필요해요, ~좋아요.",
              "Do not end body items with bare nouns or report fragments.",
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
            body: polished.body?.length ? polished.body : section.body,
          }
        : section;
    }),
    closing: parsed.closing || newsletter.closing,
  };
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
