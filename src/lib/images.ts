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
  const photos = curatedPhotoUrls(source);
  return photos[lock % photos.length];
}

function curatedPhotoUrls(source: string): string[] {
  const normalized = source.toLowerCase();
  const dictionary: Array<[RegExp, string[]]> = [
    [
      /세미나|seminar|webinar|online|class|lecture/,
      [
        unsplash("photo-1559223607-a43c990c692c"),
        unsplash("photo-1517245386807-bb43f82c33c4"),
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1516321318423-f06f85e504b3"),
      ],
    ],
    [
      /교재|교과서|book|textbook|콘텐츠|content/,
      [
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1456513080510-7bf3a84b82f8"),
        unsplash("photo-1497366811353-6870744d04b2"),
        unsplash("photo-1484480974693-6ca0a78fb36b"),
      ],
    ],
    [
      /ai|인공지능|data|데이터|cloud|digital|디지털/,
      [
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1460925895917-afdab827c52f"),
        unsplash("photo-1498050108023-c5249f4df085"),
        unsplash("photo-1551434678-e076c223a692"),
      ],
    ],
    [
      /영업|sales|field|현장|catalog|catalogue/,
      [
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1552664730-d307ca884978"),
        unsplash("photo-1517245386807-bb43f82c33c4"),
        unsplash("photo-1497366754035-f200968a6e72"),
      ],
    ],
    [
      /검수|quality|check|리스크|risk|link|file|calendar/,
      [
        unsplash("photo-1484480974693-6ca0a78fb36b"),
        unsplash("photo-1497366811353-6870744d04b2"),
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1460925895917-afdab827c52f"),
      ],
    ],
    [
      /협업|feedback|review|공유|team|coworker/,
      [
        unsplash("photo-1552664730-d307ca884978"),
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1517245386807-bb43f82c33c4"),
        unsplash("photo-1521737604893-d14cc237f11d"),
      ],
    ],
  ];

  const matched = dictionary.find(([pattern]) => pattern.test(normalized));
  return matched?.[1] ?? [
    unsplash("photo-1497366754035-f200968a6e72"),
    unsplash("photo-1497366811353-6870744d04b2"),
    unsplash("photo-1516321318423-f06f85e504b3"),
    unsplash("photo-1556761175-b413da4baf72"),
  ];
}

function unsplash(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&h=800&q=80`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 100000);
}
