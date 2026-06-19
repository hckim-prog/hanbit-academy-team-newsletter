import OpenAI from "openai";
import type { Newsletter } from "./types";

const IMAGE_COUNT = Number(process.env.NEWSLETTER_IMAGE_COUNT ?? "4");

export async function addGeneratedImages(newsletter: Newsletter): Promise<Newsletter> {
  if (!process.env.OPENAI_API_KEY) {
    return addFallbackPhotos(newsletter);
  }

  const targets = [
    { kind: "hero" as const, prompt: newsletter.heroImagePrompt },
    ...newsletter.sections.slice(0, Math.max(0, IMAGE_COUNT - 1)).map((section) => ({
      kind: "section" as const,
      id: section.id,
      prompt: section.imagePrompt,
    })),
  ];

  try {
    const generated = await Promise.all(
      targets.map(async (target, index) => ({
        ...target,
        url: await generateImage(target.prompt, index),
      })),
    );

    const hero = generated.find((item) => item.kind === "hero");
    const sections = newsletter.sections.map((section) => {
      const match = generated.find((item) => item.kind === "section" && item.id === section.id);
      return match ? { ...section, imageUrl: match.url } : section;
    });

    return {
      ...newsletter,
      heroImageUrl: hero?.url,
      sections,
    };
  } catch (error) {
    console.error("Image generation failed", error);
    return addFallbackPhotos(newsletter);
  }
}

async function generateImage(prompt: string, index: number): Promise<string> {
  const openai = new OpenAI();
  const mode = process.env.OPENAI_IMAGE_MODE ?? "image_api";

  if (mode === "image_api") {
    const result = await openai.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
      prompt,
      size: "1024x1024",
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Image API did not return image data.");
    }
    return `data:image/png;base64,${b64}`;
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_RESPONSES_MODEL ?? "gpt-5.5",
    input: prompt,
    tools: [{ type: "image_generation", action: "generate" }],
  });

  const imageData = response.output
    .filter((output) => output.type === "image_generation_call")
    .map((output) => output.result)
    .find(Boolean);

  if (!imageData) {
    throw new Error(`Responses API did not return image data for image ${index + 1}.`);
  }

  return `data:image/png;base64,${imageData}`;
}

function addFallbackPhotos(newsletter: Newsletter): Newsletter {
  return {
    ...newsletter,
    heroImageUrl: realPhotoUrl(newsletter.heroImagePrompt, "hero"),
    sections: newsletter.sections.map((section) => ({
      ...section,
      imageUrl: realPhotoUrl(`${section.title} ${section.body.join(" ")} ${section.imagePrompt}`, section.id),
    })),
  };
}

function realPhotoUrl(source: string, salt: string): string {
  const keywords = photoKeywords(source);
  const lock = stableHash(`${salt}:${source}`);
  return `https://loremflickr.com/1200/800/${keywords.join(",")}?lock=${lock}`;
}

function photoKeywords(source: string): string[] {
  const normalized = source.toLowerCase();
  const dictionary: Array<[RegExp, string[]]> = [
    [/세미나|seminar|webinar|online|학생|student|class|lecture/, ["seminar", "students", "education"]],
    [/교재|교과서|book|textbook|콘텐츠|content/, ["books", "education", "technology"]],
    [/ai|인공지능|data|데이터|cloud|digital|디지털/, ["technology", "computer", "office"]],
    [/영업|sales|field|현장|catalog|catalogue/, ["business", "meeting", "office"]],
    [/검수|quality|check|리스크|risk|link|file|calendar/, ["workspace", "laptop", "planning"]],
    [/협업|feedback|review|공유|team|coworker/, ["teamwork", "office", "collaboration"]],
  ];

  const matched = dictionary.find(([pattern]) => pattern.test(normalized));
  return matched?.[1] ?? ["education", "technology", "office"];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 100000);
}
