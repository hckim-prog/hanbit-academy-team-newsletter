import { NextResponse } from "next/server";
import { parseAiCredentials } from "@/lib/ai-credentials";
import { polishNewsletter } from "@/lib/polish";
import type { Newsletter } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      newsletter?: Newsletter;
      style?: "concise" | "expand" | "natural";
      credentials?: unknown;
    };
    if (!body.newsletter) {
      return NextResponse.json({ error: "다듬을 뉴스레터가 없습니다." }, { status: 400 });
    }

    const newsletter = await polishNewsletter(
      body.newsletter,
      body.style ?? "concise",
      parseAiCredentials(body.credentials),
    );
    return NextResponse.json({ newsletter });
  } catch (error) {
    const message = error instanceof Error ? error.message : "문장체 다듬기에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
