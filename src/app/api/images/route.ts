import { NextResponse } from "next/server";
import { parseAiCredentials } from "@/lib/ai-credentials";
import { addGeneratedImages } from "@/lib/images";
import type { Newsletter } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      newsletter?: Newsletter;
      imageSeed?: string;
      credentials?: unknown;
    };
    if (!body.newsletter) {
      return NextResponse.json({ error: "이미지를 바꿀 뉴스레터가 없습니다." }, { status: 400 });
    }

    const newsletter = await addGeneratedImages(
      body.newsletter,
      body.imageSeed,
      parseAiCredentials(body.credentials),
    );
    return NextResponse.json({ newsletter });
  } catch (error) {
    const message = error instanceof Error ? error.message : "이미지 새로고침에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
