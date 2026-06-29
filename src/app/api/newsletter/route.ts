import { NextResponse } from "next/server";
import { addGeneratedImages } from "@/lib/images";
import { buildNewsletter } from "@/lib/newsletter";
import { polishNewsletter } from "@/lib/polish";
import { getLatestReports, isReportSourceId } from "@/lib/sheets";
import type { ReportSourceId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      images?: boolean;
      imageSeed?: string;
      source?: unknown;
      sources?: unknown;
    };
    const requestedSources = Array.isArray(body.sources)
      ? body.sources
      : [body.source ?? "kim-hochul"];
    if (
      requestedSources.length < 1 ||
      requestedSources.length > 3 ||
      !requestedSources.every(isReportSourceId)
    ) {
      return NextResponse.json({ error: "선택한 업무보고 문서를 사용할 수 없습니다." }, { status: 400 });
    }

    const sources = [...new Set(requestedSources)] as ReportSourceId[];
    const reports = await getLatestReports(sources);
    const newsletter = await polishNewsletter(buildNewsletter(reports), "expand");
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
