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
          "You polish Korean internal newsletters. Keep facts, dates, names, numbers, and section meanings unchanged. Make the tone warm, concise, lively, and professional for Hanbit Academy members. Remove duplicate phrasing. Do not add new facts.",
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "Polish only heroTitle, section titles, section body sentences, and closing. Keep ids, tones, image prompts, image urls, subject, sourceDate, and metadata unchanged. Return valid JSON only with keys heroTitle, sections, closing. sections must be array of {id,title,body}.",
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
