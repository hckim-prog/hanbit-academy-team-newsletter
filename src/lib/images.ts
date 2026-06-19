import OpenAI from "openai";
import type { Newsletter } from "./types";

const IMAGE_COUNT = Number(process.env.NEWSLETTER_IMAGE_COUNT ?? "4");

export async function addGeneratedImages(newsletter: Newsletter): Promise<Newsletter> {
  if (!process.env.OPENAI_API_KEY) {
    return addFallbackImages(newsletter, "OpenAI API key is not configured");
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
    return addFallbackImages(newsletter, "Image generation failed");
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

function addFallbackImages(newsletter: Newsletter, reason: string): Newsletter {
  return {
    ...newsletter,
    heroImageUrl: fallbackSvg("hero", reason),
    sections: newsletter.sections.map((section) => ({
      ...section,
      imageUrl: fallbackSvg(section.tone, reason),
    })),
  };
}

function fallbackSvg(tone: string, reason: string): string {
  const palettes: Record<string, [string, string, string]> = {
    hero: ["#ffd166", "#ff7a59", "#fff7e8"],
    sky: ["#5ab1ef", "#cfefff", "#ffffff"],
    mint: ["#61d394", "#ddf9e8", "#ffffff"],
    coral: ["#ff7a59", "#ffe0d6", "#ffffff"],
    violet: ["#9b8cff", "#ece8ff", "#ffffff"],
    sun: ["#ffd166", "#fff1bd", "#ffffff"],
  };
  const [a, b, c] = palettes[tone] ?? palettes.hero;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
    <rect width="1200" height="760" rx="48" fill="${c}"/>
    <circle cx="240" cy="210" r="145" fill="${a}" opacity=".85"/>
    <circle cx="890" cy="230" r="190" fill="${b}" opacity=".9"/>
    <rect x="250" y="360" width="700" height="155" rx="42" fill="${a}" opacity=".28"/>
    <rect x="320" y="300" width="560" height="250" rx="56" fill="#fff" stroke="${a}" stroke-width="10"/>
    <path d="M410 410h380M410 470h270" stroke="#172033" stroke-width="24" stroke-linecap="round" opacity=".22"/>
    <path d="M840 390l40 44 76-96" stroke="${a}" stroke-width="28" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="600" y="650" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" fill="#73531a">${escapeXml(reason)}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}
