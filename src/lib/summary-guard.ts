import type { NewsletterSection } from "./types";

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
