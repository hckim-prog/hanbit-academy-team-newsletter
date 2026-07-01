export type RawReport = {
  displayDate: string;
  parsedTime: number;
  sourceRange: string;
  signals: string;
  operations: string;
  support: string;
  request: string;
  next: string;
};

export type ReportSourceId = "kim-hochul" | "kim-taejin" | "son-hyejin";

export type DocumentType = "leader" | "member";
export type SourcePerson = "김호철" | "김태진" | "손혜진";
export type NewsletterAudienceMode = "team" | "executive";

export type ReportSource = {
  id: ReportSourceId;
  sourcePerson: SourcePerson;
  documentType: DocumentType;
  spreadsheetId: string;
  sheetId: number;
  expectedSpreadsheetTitle: string;
  expectedSheetTitle: string;
  parser: DocumentType;
  reportYear?: number;
};

export type ReportRound = {
  roundId: string;
  anchorDate: string;
  leader: {
    sourceId: ReportSourceId;
    sourcePerson: SourcePerson;
    reportDate: string;
    sourceRange: string;
  };
  members: Array<{
    sourceId: ReportSourceId;
    sourcePerson: SourcePerson;
    reportDate: string;
    sourceRange: string;
    dayDifference: number;
    alignment: "included" | "warning";
  }>;
  excludedCandidates: Array<{
    sourceId: ReportSourceId;
    sourcePerson: SourcePerson;
    reportDate: string;
    sourceRange: string;
    dayDifference: number;
  }>;
  warnings: string[];
};

export type EvidenceRef = {
  sourcePerson: SourcePerson;
  documentType: DocumentType;
  sourceRange: string;
  rawText: string;
  evidenceType: "direction" | "execution" | "metric" | "schedule" | "risk" | "decision";
};

export type FactCard = {
  id: string;
  sourcePerson: SourcePerson;
  documentType: DocumentType;
  sourceRange: string;
  rawText: string;
  topic: string;
  project: string;
  status: "completed" | "in_progress" | "planned" | "blocked" | "risk" | "opportunity" | "request" | "unknown";
  importance: "critical" | "high" | "medium" | "low";
  audience: NewsletterAudienceMode | "both";
  sensitivity: "normal" | "internal" | "confidential" | "financial" | "contract" | "personal";
  evidence: EvidenceRef[];
  numbers: string[];
  dates: string[];
  organizations: string[];
  recommendedSection: "overview" | "progress" | "achievement" | "issue" | "next" | "request";
  newsletterSentence: string;
};

export type StoryCard = {
  id: string;
  leaderTopic: string;
  title: string;
  summary: string;
  leaderFacts: FactCard[];
  supportingFacts: FactCard[];
  status: FactCard["status"];
  importance: FactCard["importance"];
  sensitivity: FactCard["sensitivity"];
  recommendedSection: FactCard["recommendedSection"];
  teamNewsletterSentence: string;
  executiveNewsletterSentence: string;
  evidence: EvidenceRef[];
};

export type EditorialPlan = {
  round: ReportRound;
  audienceMode: NewsletterAudienceMode;
  stories: StoryCard[];
  generatedAt: string;
  warnings: string[];
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

export type TextAiProvider = "gemini" | "openai" | "local";
export type ImageAiProvider = "gemini" | "openai" | "curated" | "mixed";

export type TextAiStatus = {
  provider: TextAiProvider;
  changed: boolean;
  fallbackUsed: boolean;
};

export type ImageAiStatus = {
  provider: ImageAiProvider;
  fallbackUsed: boolean;
  providerCounts?: Partial<Record<Exclude<ImageAiProvider, "mixed">, number>>;
};

export type NewsletterAiStatus = {
  text?: TextAiStatus;
  image?: ImageAiStatus;
};

export type GenerateNewsletterResponse = {
  newsletter: Newsletter;
  warnings: string[];
  aiStatus: NewsletterAiStatus;
};
