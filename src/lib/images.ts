import OpenAI from "openai";
import type { Newsletter } from "./types";

export async function addGeneratedImages(newsletter: Newsletter, imageSeed = String(Date.now())): Promise<Newsletter> {
  if (!process.env.OPENAI_API_KEY) {
    return addFallbackPhotos(newsletter, imageSeed);
  }

  const imageCount = Number(process.env.NEWSLETTER_IMAGE_COUNT ?? String(newsletter.sections.length + 1));
  const sectionImageCount = Math.max(0, Math.min(newsletter.sections.length, imageCount - 1));
  const targets = [
    { kind: "hero" as const, prompt: newsletter.heroImagePrompt },
    ...newsletter.sections.slice(0, sectionImageCount).map((section) => ({
      kind: "section" as const,
      id: section.id,
      prompt: section.imagePrompt,
    })),
  ];

  try {
    const generated = await Promise.all(
      targets.map(async (target, index) => ({
        ...target,
        url: await generateImage(`${target.prompt}\nVariation seed: ${imageSeed}-${index}. Use a visibly different composition from prior issues.`, index),
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
    return addFallbackPhotos(newsletter, imageSeed);
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

function addFallbackPhotos(newsletter: Newsletter, imageSeed: string): Newsletter {
  return {
    ...newsletter,
    heroImageUrl: realPhotoUrl(newsletter.heroImagePrompt, `hero:${imageSeed}`),
    sections: newsletter.sections.map((section) => ({
      ...section,
      imageUrl: realPhotoUrl(`${section.title} ${section.body.join(" ")} ${section.imagePrompt}`, `${section.id}:${imageSeed}`),
    })),
  };
}

function realPhotoUrl(source: string, salt: string): string {
  const lock = stableHash(`${salt}:${source}`);
  const keywordGroups = photoKeywordGroups(source);
  const keywords = keywordGroups[lock % keywordGroups.length];
  const provider = lock % 5;

  if (provider === 0) {
    return `https://picsum.photos/seed/hanbit-${lock}/1200/800`;
  }

  return `https://loremflickr.com/1200/800/${keywords.join(",")}/all?lock=${lock}`;
}

function photoKeywordGroups(source: string): string[][] {
  const normalized = source.toLowerCase();
  const dictionary: Array<[RegExp, string[][]]> = [
    [
      /세미나|seminar|webinar|online|class|lecture/,
      [
        ["business", "conference", "meeting"],
        ["office", "presentation", "auditorium"],
        ["technology", "conference", "speaker"],
        ["korean", "business", "meeting"],
      ],
    ],
    [
      /교재|교과서|book|textbook|콘텐츠|content/,
      [
        ["books", "office", "technology"],
        ["publishing", "desk", "laptop"],
        ["library", "computer", "workspace"],
        ["tablet", "book", "office"],
      ],
    ],
    [
      /ai|인공지능|data|데이터|cloud|digital|디지털/,
      [
        ["technology", "computer", "office"],
        ["data", "dashboard", "laptop"],
        ["software", "workspace", "screen"],
        ["artificial-intelligence", "business", "computer"],
      ],
    ],
    [
      /영업|sales|field|현장|catalog|catalogue/,
      [
        ["business", "meeting", "office"],
        ["sales", "presentation", "laptop"],
        ["workshop", "booth", "business"],
        ["conference", "networking", "office"],
      ],
    ],
    [
      /검수|quality|check|리스크|risk|link|file|calendar/,
      [
        ["workspace", "laptop", "planning"],
        ["checklist", "desk", "computer"],
        ["calendar", "office", "laptop"],
        ["document", "review", "workspace"],
      ],
    ],
    [
      /협업|feedback|review|공유|team|coworker/,
      [
        ["teamwork", "office", "business"],
        ["collaboration", "meeting", "laptop"],
        ["coworking", "workshop", "office"],
        ["business", "discussion", "workspace"],
      ],
    ],
  ];

  const matched = dictionary.find(([pattern]) => pattern.test(normalized));
  return matched?.[1] ?? [
    ["korean", "office", "technology"],
    ["business", "workspace", "laptop"],
    ["books", "desk", "computer"],
    ["conference", "office", "presentation"],
  ];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 100000);
}
