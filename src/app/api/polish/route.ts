import { NextResponse } from "next/server";
import { polishNewsletter } from "@/lib/polish";
import type { Newsletter } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      newsletter?: Newsletter;
      style?: "concise" | "expand" | "natural";
    };
    if (!body.newsletter) {
      return NextResponse.json({ error: "다듬을 뉴스레터가 없습니다." }, { status: 400 });
    }

    const result = await polishNewsletter(body.newsletter, body.style ?? "concise");
    return NextResponse.json({
      newsletter: result.newsletter,
      aiStatus: { text: result.status },
      warnings: result.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "문장체 다듬기에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
