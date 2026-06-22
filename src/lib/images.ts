import OpenAI from "openai";
import type { Newsletter } from "./types";

export async function addGeneratedImages(newsletter: Newsletter, imageSeed = String(Date.now())): Promise<Newsletter> {
  if (!process.env.OPENAI_API_KEY) {
    return addFallbackPhotos(newsletter, imageSeed);
  }

  const imageCount = resolveImageCount(newsletter);
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
        url: await generateImage(diversifyPrompt(target.prompt, imageSeed, index), index),
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

function resolveImageCount(newsletter: Newsletter): number {
  const maxImages = newsletter.sections.length + 1;
  const configured = process.env.NEWSLETTER_IMAGE_COUNT;
  const requested = configured ? Number(configured) : maxImages;

  if (!Number.isFinite(requested)) {
    return maxImages;
  }

  return Math.max(1, Math.min(maxImages, Math.floor(requested)));
}

function diversifyPrompt(prompt: string, imageSeed: string, index: number): string {
  const directions = [
    "wide editorial scene with layered foreground objects and Korean or East Asian adult professionals in the background",
    "close documentary detail of hands, printed materials, screens, and tools in use",
    "over-the-shoulder workplace moment with a screen, notes, and natural human activity",
    "clean flat-lay composition of books, tablets, schedules, and review documents",
    "meeting-room perspective with presentation materials, notebooks, and Korean or East Asian adult collaborators",
    "bright candid office moment with movement, depth, and realistic Korean workplace context",
    "focused desk-level shot with calendar marks, QA notes, and digital workflow artifacts",
  ];
  const direction = directions[index % directions.length];

  return `${prompt}
Variation seed: ${imageSeed}-${index}.
Composition direction: ${direction}.
Make this image visually distinct from the other newsletter images in subject distance, angle, lighting, and object mix. If people appear, cast Korean or East Asian adult professionals in a realistic Seoul office or publishing-workplace atmosphere. Avoid Western stock-photo casting, repeating the same desk, laptop-only setup, or generic office meeting composition.`;
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
  const usedPhotos = new Set<string>();
  const heroImageUrl = realPhotoUrl(newsletter.heroImagePrompt, `hero:${imageSeed}`, usedPhotos);

  return {
    ...newsletter,
    heroImageUrl,
    sections: newsletter.sections.map((section) => {
      const imageUrl = realPhotoUrl(`${section.title} ${section.body.join(" ")} ${section.imagePrompt}`, `${section.id}:${imageSeed}`, usedPhotos);
      return {
        ...section,
        imageUrl,
      };
    }),
  };
}

function realPhotoUrl(source: string, salt: string, usedPhotos: Set<string>): string {
  const lock = stableHash(`${salt}:${source}`);
  const photos = curatedPhotoUrls(source);
  const startIndex = lock % photos.length;

  for (let offset = 0; offset < photos.length; offset += 1) {
    const candidate = photos[(startIndex + offset) % photos.length];
    if (!usedPhotos.has(candidate)) {
      usedPhotos.add(candidate);
      return candidate;
    }
  }

  const fallback = photos[startIndex];
  usedPhotos.add(fallback);
  return fallback;
}

function curatedPhotoUrls(source: string): string[] {
  const normalized = source.toLowerCase();
  const dictionary: Array<[RegExp, string[]]> = [
    [
      /korean|한국|east asian|asian|동아시아|professionals?|coworkers?|team|meeting|collaboration|office|business|세미나|협업|회의|공유|영업/,
      [
        unsplash("photo-1731458769726-cef60c792665"),
        unsplash("photo-1754531976828-69e42ce4e0d9"),
        unsplash("photo-1565350831386-8c52421af9fa"),
        unsplash("photo-1633954319432-730a628b0388"),
        unsplash("photo-1754461188805-a5e3b6631b63"),
        unsplash("photo-1646579886741-12b59840c63f"),
      ],
    ],
    [
      /seoul|서울|gangnam|korea|south korea|한국|도시|city|office building|library|교재|교과서|book|출판/,
      [
        unsplash("photo-1754461188805-a5e3b6631b63"),
        unsplash("photo-1633954319432-730a628b0388"),
        unsplash("photo-1565350831386-8c52421af9fa"),
        unsplash("photo-1516979187457-637abb4f9353"),
        unsplash("photo-1532012197267-da84d127e765"),
        unsplash("photo-1544716278-ca5e3f4abd8c"),
        unsplash("photo-1519682337058-a94d519337bc"),
      ],
    ],
    [
      /세미나|seminar|webinar|online|class|lecture/,
      [
        unsplash("photo-1731458769726-cef60c792665"),
        unsplash("photo-1565350831386-8c52421af9fa"),
        unsplash("photo-1559223607-a43c990c692c"),
        unsplash("photo-1517245386807-bb43f82c33c4"),
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1505373877841-8d25f7d46678"),
        unsplash("photo-1542744094-24638eff58bb"),
        unsplash("photo-1540575467063-178a50c2df87"),
        unsplash("photo-1559136555-9303baea8ebd"),
        unsplash("photo-1551836022-d5d88e9218df"),
        unsplash("photo-1556761175-5973dc0f32e7"),
        unsplash("photo-1523580846011-d3a5bc25702b"),
        unsplash("photo-1511578314322-379afb476865"),
        unsplash("photo-1517048676732-d65bc937f952"),
        unsplash("photo-1522202176988-66273c2fd55f"),
        unsplash("photo-1543269865-cbf427effbad"),
        unsplash("photo-1531482615713-2afd69097998"),
        unsplash("photo-1524178232363-1fb2b075b655"),
        unsplash("photo-1552581234-26160f608093"),
        unsplash("photo-1573164713988-8665fc963095"),
        unsplash("photo-1588196749597-9ff075ee6b5b"),
      ],
    ],
    [
      /교재|교과서|book|textbook|콘텐츠|content|출판|편집|원고|publication|publishing|editorial/,
      [
        unsplash("photo-1754461188805-a5e3b6631b63"),
        unsplash("photo-1565350831386-8c52421af9fa"),
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1456513080510-7bf3a84b82f8"),
        unsplash("photo-1497366811353-6870744d04b2"),
        unsplash("photo-1484480974693-6ca0a78fb36b"),
        unsplash("photo-1524995997946-a1c2e315a42f"),
        unsplash("photo-1497633762265-9d179a990aa6"),
        unsplash("photo-1512820790803-83ca734da794"),
        unsplash("photo-1521587760476-6c12a4b040da"),
        unsplash("photo-1519389950473-47ba0277781c"),
        unsplash("photo-1516321497487-e288fb19713f"),
        unsplash("photo-1476275466078-4007374efbbe"),
        unsplash("photo-1516979187457-637abb4f9353"),
        unsplash("photo-1532012197267-da84d127e765"),
        unsplash("photo-1513475382585-d06e58bcb0e0"),
        unsplash("photo-1544716278-ca5e3f4abd8c"),
        unsplash("photo-1519682337058-a94d519337bc"),
        unsplash("photo-1495446815901-a7297e633e8d"),
        unsplash("photo-1497633762265-9d179a990aa6"),
        unsplash("photo-1513001900722-370f803f498d"),
        unsplash("photo-1544947950-fa07a98d237f"),
      ],
    ],
    [
      /ai|인공지능|data|데이터|cloud|digital|디지털|dashboard|workflow|automation|analytics/,
      [
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1460925895917-afdab827c52f"),
        unsplash("photo-1498050108023-c5249f4df085"),
        unsplash("photo-1551434678-e076c223a692"),
        unsplash("photo-1518770660439-4636190af475"),
        unsplash("photo-1519389950473-47ba0277781c"),
        unsplash("photo-1531482615713-2afd69097998"),
        unsplash("photo-1551288049-bebda4e38f71"),
        unsplash("photo-1516321497487-e288fb19713f"),
        unsplash("photo-1558494949-ef010cbdcc31"),
        unsplash("photo-1551288049-bebda4e38f71"),
        unsplash("photo-1504384308090-c894fdcc538d"),
        unsplash("photo-1518770660439-4636190af475"),
        unsplash("photo-1544197150-b99a580bb7a8"),
        unsplash("photo-1485827404703-89b55fcc595e"),
        unsplash("photo-1535223289827-42f1e9919769"),
        unsplash("photo-1550751827-4bd374c3f58b"),
        unsplash("photo-1515879218367-8466d910aaa4"),
        unsplash("photo-1497366754035-f200968a6e72"),
        unsplash("photo-1551434678-e076c223a692"),
      ],
    ],
    [
      /영업|sales|field|현장|catalog|catalogue|customer|client|partner|b2b|business/,
      [
        unsplash("photo-1731458769726-cef60c792665"),
        unsplash("photo-1754531976828-69e42ce4e0d9"),
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1552664730-d307ca884978"),
        unsplash("photo-1517245386807-bb43f82c33c4"),
        unsplash("photo-1497366754035-f200968a6e72"),
        unsplash("photo-1542744173-8e7e53415bb0"),
        unsplash("photo-1556761175-4b46a572b786"),
        unsplash("photo-1556761175-5973dc0f32e7"),
        unsplash("photo-1551836022-d5d88e9218df"),
        unsplash("photo-1559136555-9303baea8ebd"),
        unsplash("photo-1557804506-669a67965ba0"),
        unsplash("photo-1556761175-4b46a572b786"),
        unsplash("photo-1551836022-4c4c79ecde51"),
        unsplash("photo-1542744173-8e7e53415bb0"),
        unsplash("photo-1553877522-43269d4ea984"),
        unsplash("photo-1507679799987-c73779587ccf"),
        unsplash("photo-1560264280-88b68371db39"),
        unsplash("photo-1521791136064-7986c2920216"),
        unsplash("photo-1556761175-129418cb2dfe"),
        unsplash("photo-1560472354-b33ff0c44a43"),
        unsplash("photo-1556761175-5973dc0f32e7"),
      ],
    ],
    [
      /검수|quality|check|리스크|risk|link|file|calendar|qa|schedule|spreadsheet|review/,
      [
        unsplash("photo-1484480974693-6ca0a78fb36b"),
        unsplash("photo-1497366811353-6870744d04b2"),
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1460925895917-afdab827c52f"),
        unsplash("photo-1506784983877-45594efa4cbe"),
        unsplash("photo-1517245386807-bb43f82c33c4"),
        unsplash("photo-1454165804606-c3d57bc86b40"),
        unsplash("photo-1554224155-6726b3ff858f"),
        unsplash("photo-1551288049-bebda4e38f71"),
        unsplash("photo-1516321497487-e288fb19713f"),
        unsplash("photo-1434030216411-0b793f4b4173"),
        unsplash("photo-1506784983877-45594efa4cbe"),
        unsplash("photo-1554224154-26032ffc0d07"),
        unsplash("photo-1454165804606-c3d57bc86b40"),
        unsplash("photo-1512314889357-e157c22f938d"),
        unsplash("photo-1499750310107-5fef28a66643"),
        unsplash("photo-1483058712412-4245e9b90334"),
        unsplash("photo-1516321497487-e288fb19713f"),
        unsplash("photo-1586281380349-632531db7ed4"),
        unsplash("photo-1557804506-669a67965ba0"),
      ],
    ],
    [
      /협업|feedback|review|공유|team|coworker|meeting|planning|project|comment/,
      [
        unsplash("photo-1731458769726-cef60c792665"),
        unsplash("photo-1754531976828-69e42ce4e0d9"),
        unsplash("photo-1565350831386-8c52421af9fa"),
        unsplash("photo-1552664730-d307ca884978"),
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1517245386807-bb43f82c33c4"),
        unsplash("photo-1521737604893-d14cc237f11d"),
        unsplash("photo-1551836022-d5d88e9218df"),
        unsplash("photo-1542744094-24638eff58bb"),
        unsplash("photo-1559136555-9303baea8ebd"),
        unsplash("photo-1531482615713-2afd69097998"),
        unsplash("photo-1556761175-4b46a572b786"),
        unsplash("photo-1557804506-669a67965ba0"),
        unsplash("photo-1517048676732-d65bc937f952"),
        unsplash("photo-1521737604893-d14cc237f11d"),
        unsplash("photo-1552581234-26160f608093"),
        unsplash("photo-1522071820081-009f0129c71c"),
        unsplash("photo-1522202176988-66273c2fd55f"),
        unsplash("photo-1543269865-cbf427effbad"),
        unsplash("photo-1556761175-129418cb2dfe"),
        unsplash("photo-1551836022-d5d88e9218df"),
        unsplash("photo-1500530855697-b586d89ba3ee"),
        unsplash("photo-1556761175-4b46a572b786"),
      ],
    ],
    [
      /newsletter|소식|요약|overview|brief|issue|월|month/,
      [
        unsplash("photo-1731458769726-cef60c792665"),
        unsplash("photo-1565350831386-8c52421af9fa"),
        unsplash("photo-1754461188805-a5e3b6631b63"),
        unsplash("photo-1497366754035-f200968a6e72"),
        unsplash("photo-1497366811353-6870744d04b2"),
        unsplash("photo-1516321318423-f06f85e504b3"),
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1484480974693-6ca0a78fb36b"),
        unsplash("photo-1519389950473-47ba0277781c"),
        unsplash("photo-1516321497487-e288fb19713f"),
        unsplash("photo-1499750310107-5fef28a66643"),
        unsplash("photo-1516979187457-637abb4f9353"),
        unsplash("photo-1544716278-ca5e3f4abd8c"),
      ],
    ],
    [
      /priority|roadmap|우선순위|계획|다음|next|2주|follow-up|todo/,
      [
        unsplash("photo-1506784983877-45594efa4cbe"),
        unsplash("photo-1484480974693-6ca0a78fb36b"),
        unsplash("photo-1512314889357-e157c22f938d"),
        unsplash("photo-1499750310107-5fef28a66643"),
        unsplash("photo-1454165804606-c3d57bc86b40"),
        unsplash("photo-1500530855697-b586d89ba3ee"),
        unsplash("photo-1542744173-8e7e53415bb0"),
        unsplash("photo-1553877522-43269d4ea984"),
        unsplash("photo-1556761175-b413da4baf72"),
        unsplash("photo-1552581234-26160f608093"),
      ],
    ],
  ];

  const matched = dictionary.flatMap(([pattern, photos]) => (pattern.test(normalized) ? photos : []));
  const fallback = [
    unsplash("photo-1731458769726-cef60c792665"),
    unsplash("photo-1754531976828-69e42ce4e0d9"),
    unsplash("photo-1565350831386-8c52421af9fa"),
    unsplash("photo-1633954319432-730a628b0388"),
    unsplash("photo-1754461188805-a5e3b6631b63"),
    unsplash("photo-1497366754035-f200968a6e72"),
    unsplash("photo-1497366811353-6870744d04b2"),
    unsplash("photo-1516321318423-f06f85e504b3"),
    unsplash("photo-1556761175-b413da4baf72"),
    unsplash("photo-1484480974693-6ca0a78fb36b"),
    unsplash("photo-1460925895917-afdab827c52f"),
    unsplash("photo-1552664730-d307ca884978"),
    unsplash("photo-1519389950473-47ba0277781c"),
    unsplash("photo-1531482615713-2afd69097998"),
    unsplash("photo-1542744173-8e7e53415bb0"),
    unsplash("photo-1516979187457-637abb4f9353"),
    unsplash("photo-1522202176988-66273c2fd55f"),
    unsplash("photo-1552581234-26160f608093"),
    unsplash("photo-1553877522-43269d4ea984"),
    unsplash("photo-1506784983877-45594efa4cbe"),
    unsplash("photo-1499750310107-5fef28a66643"),
    unsplash("photo-1544716278-ca5e3f4abd8c"),
    unsplash("photo-1504384308090-c894fdcc538d"),
  ];

  return uniquePhotos(matched.length ? [...matched, ...fallback] : fallback);
}

function unsplash(id: string): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&h=800&q=80`;
}

function uniquePhotos(photos: string[]): string[] {
  return [...new Set(photos)];
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 100000);
}
