import "server-only";

import type { AiCredentials } from "./types";

const MAX_API_KEY_LENGTH = 512;

export function parseAiCredentials(value: unknown): AiCredentials {
  if (value === undefined || value === null) {
    return {};
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI API 키 입력 형식이 올바르지 않습니다.");
  }

  const candidate = value as Record<string, unknown>;
  return {
    openAiApiKey: parseApiKey(candidate.openAiApiKey),
    geminiApiKey: parseApiKey(candidate.geminiApiKey),
  };
}

function parseApiKey(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("AI API 키 입력 형식이 올바르지 않습니다.");
  }

  const key = value.trim();
  if (!key || key.length > MAX_API_KEY_LENGTH) {
    throw new Error("AI API 키 길이가 올바르지 않습니다.");
  }

  return key;
}
