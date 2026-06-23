export type RawReportSource = {
  name: string;
  displayDate: string;
  parsedTime: number;
  sourceRange: string;
};

export type RawReport = {
  displayDate: string;
  parsedTime: number;
  sourceRange: string;
  sources: RawReportSource[];
  signals: string;
  operations: string;
  support: string;
  request: string;
  next: string;
};

export type NewsletterSection = {
  id: string;
  eyebrow: string;
  title: string;
  tone: "sky" | "mint" | "coral" | "violet" | "sun";
  body: string[];
  imagePrompt: string;
  imageUrl?: string;
};

export type Newsletter = {
  subject: string;
  teamName: string;
  sourceDate: string;
  displayMonth: string;
  sourceRange: string;
  generatedAt: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImagePrompt: string;
  heroImageUrl?: string;
  sections: NewsletterSection[];
  closing: string;
};

export type GenerateNewsletterResponse = {
  newsletter: Newsletter;
  warnings: string[];
};
