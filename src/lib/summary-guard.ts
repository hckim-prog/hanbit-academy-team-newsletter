import type { NewsletterSection } from "./types";

export function preserveNewsletterHeroTitle(sourceTitle: string, candidateTitle?: string): string {
  void candidateTitle;
  return sourceTitle;
}

export function preserveGroundedSummary(
  source: NewsletterSection,
  candidate: NewsletterSection,
): NewsletterSection {
  if (source.id !== "summary") {
    return candidate;
  }

  return {
    ...candidate,
    title: source.title,
    body: source.body,
  };
}
