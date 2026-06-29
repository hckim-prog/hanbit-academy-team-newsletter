import { NextResponse } from "next/server";
import { addGeneratedImages } from "@/lib/images";
import { buildNewsletter } from "@/lib/newsletter";
import { getLatestReport, isReportSourceId } from "@/lib/sheets";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      images?: boolean;
      imageSeed?: string;
      source?: unknown;
    };
    const source = body.source ?? "kim-hochul";
    if (!isReportSourceId(source)) {
      return NextResponse.json({ error: "선택한 업무보고 문서를 사용할 수 없습니다." }, { status: 400 });
    }

    const report = await getLatestReport(source);
    const newsletter = buildNewsletter(report);
    const withImages = body.images === false ? newsletter : await addGeneratedImages(newsletter, body.imageSeed);

    return NextResponse.json({
      newsletter: withImages,
      warnings: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "뉴스레터 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
