import type { StatusFormat, WeeklyStatusInput } from "../../services/ai.service.js";
import type { AiProvider, AiProviderId } from "./types.js";
import { openRouterProvider } from "./openrouter.provider.js";

const providers: Record<AiProviderId, AiProvider> = {
  openrouter: openRouterProvider,
};

export function getAiProvider(id: AiProviderId): AiProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown AI provider: ${id}`);
  return provider;
}

export const SUGGESTED_OPENROUTER_MODELS = [
  { id: "openrouter/free", label: "OpenRouter Free (auto)", hint: "Routes to an available free model" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o mini", hint: "Paid — if your key has credits" },
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash", hint: "Paid — if your key has credits" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku", hint: "Paid — if your key has credits" },
] as const;

export function buildWeeklySummaryPrompt(input: WeeklyStatusInput & { format: StatusFormat }): {
  system: string;
  user: string;
} {
  const format = input.format;
  const system = `You are Tracework, a work-reporting assistant.
Summarize ONLY the facts supplied by the user. Do not invent accomplishments, metrics, meetings, deadlines, performance, or employee activity.
Never invent tasks that were not listed. If a section has no items, omit it or say none were logged.
Do not judge people. Describe submitted work, not who is "inactive" or underperforming.
Keep language professional, supportive, and concise.
Do not mention that you are an AI unless asked.
Output plain text suitable for copy/paste into email or Slack.`;

  const workBlock = [
    `Period: ${input.periodLabel}`,
    `Author first name only for closing if needed: ${input.name.split(" ")[0] ?? "User"}`,
    input.managerName ? `Manager greeting name: ${input.managerName}` : null,
    "",
    "Completed:",
    ...(input.completed.length ? input.completed.map((i) => `- ${i}`) : ["- (none logged)"]),
    "",
    "In progress:",
    ...((input.inProgress ?? []).length ? (input.inProgress ?? []).map((i) => `- ${i}`) : ["- (none logged)"]),
    "",
    "Learning:",
    ...((input.learned ?? []).length ? (input.learned ?? []).map((i) => `- ${i}`) : ["- (none logged)"]),
    "",
    "Blockers:",
    ...((input.blockers ?? []).length ? (input.blockers ?? []).map((i) => `- ${i}`) : ["- (none logged)"]),
    "",
    "Next week / tomorrow notes:",
    ...((input.nextWeek ?? []).length ? (input.nextWeek ?? []).map((i) => `- ${i}`) : ["- (none logged)"]),
  ]
    .filter((line) => line !== null)
    .join("\n");

  let instructions = "";
  if (format === "email") {
    instructions = `Write an email draft with:
Subject: Weekly Work Update — ${input.periodLabel}
Greeting, then sections Completed / In Progress / Next Week (and Blockers only if present).
Short closing with the author's first name.`;
  } else if (format === "bullets") {
    instructions = `Write a Slack/Teams friendly bullet update with short section headers: Completed, In Progress, Next Week (and Blockers if any).`;
  } else if (format === "detailed") {
    instructions = `Write a detailed weekly review with sections: Completed, In Progress, Learning, Blockers, Plan for next week.`;
  } else if (format === "personal") {
    instructions = `Write a simple personal weekly recap in friendly plain language with Completed, Still moving, Up next.`;
  } else {
    instructions = `Write a concise manager update with sections: Completed, In Progress, Next Week (and Needs attention if blockers exist).`;
  }

  return {
    system,
    user: `${instructions}\n\nWork log:\n${workBlock}`,
  };
}
