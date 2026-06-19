import { NextResponse } from "next/server";
import { addGeneratedImages } from "@/lib/images";
import { buildNewsletter } from "@/lib/newsletter";
import { getLatestReport } from "@/lib/sheets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { images?: boolean };
    const report = await getLatestReport();
    const newsletter = buildNewsletter(report);
    const withImages = body.images === false ? newsletter : await addGeneratedImages(newsletter);

    return NextResponse.json({
      newsletter: withImages,
      warnings: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "뉴스레터 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
