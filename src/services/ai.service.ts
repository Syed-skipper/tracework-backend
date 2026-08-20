import { HttpError } from "../exceptions/http.exception.js";

export interface StructuredSummary {
  completed: string[];
  learned: string[];
  blockers: string[];
  tomorrow: string[];
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clean = (s: string) => s.trim().replace(/^[-•]\s*/, "").replace(/\s+/g, " ");
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const BUCKETS: { key: keyof StructuredSummary; words: string[] }[] = [
  { key: "learned", words: ["learn", "learned", "learnt", "read", "studied", "explored", "understood"] },
  { key: "blockers", words: ["block", "blocked", "waiting", "stuck", "pending", "delayed", "need"] },
  { key: "tomorrow", words: ["tomorrow", "next", "plan", "will", "later", "upcoming"] },
];

function bucketise(notes: string): StructuredSummary {
  const result: StructuredSummary = { completed: [], learned: [], blockers: [], tomorrow: [] };
  const chunks = notes
    .split(/[\n.;]+|,(?=\s*(?:learned|learnt|waiting|blocked|tomorrow|next))/i)
    .map(clean)
    .filter(Boolean);

  let current: keyof StructuredSummary = "completed";
  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    const hit = BUCKETS.find((b) => b.words.some((w) => lower.startsWith(w) || lower.includes(` ${w} `)));
    if (hit) current = hit.key;
    else if (/^(fixed|built|shipped|worked|completed|reviewed|deployed|refactored|wrote)/.test(lower))
      current = "completed";

    const stripped = chunk
      .replace(/^(tomorrow|next|then|also|and)\s+/i, "")
      .replace(/^(i\s+)?(learned|learnt|studied)\s+(about\s+)?/i, "")
      .replace(/^(waiting for|blocked by|blocked on|stuck on)\s+/i, "Waiting for ");
    if (stripped) result[current].push(sentence(clean(stripped)));
  }
  return result;
}

export async function summarizeNotes(notes: string): Promise<StructuredSummary> {
  if (!notes.trim()) throw new HttpError(400, "notes is required");
  await delay(400);
  const parsed = bucketise(notes);
  if (!Object.values(parsed).some((v) => v.length)) {
    return {
      completed: ["Worked on planned tasks"],
      learned: [],
      blockers: [],
      tomorrow: ["Continue where you left off"],
    };
  }
  return parsed;
}

export async function chat(prompt: string): Promise<string> {
  if (!prompt.trim()) throw new HttpError(400, "prompt is required");
  await delay(350);
  const p = prompt.toLowerCase();
  if (p.includes("blocker"))
    return "You have 1 active blocker: the payment API documentation, open for 2 days and affecting 3 people. Sarah is chasing the vendor with docs expected Thursday. Everything else on Payments is moving.";
  if (p.includes("tomorrow") || p.includes("focus"))
    return "Tomorrow is best spent on integration testing for checkout (est. 3h) while the API docs are still pending. Keep the webhook retry work parked — it depends on the blocked contract. Pairing with Priya for 45 minutes would also close out the dashboard states.";
  if (p.includes("skill"))
    return "You're actively developing Redis (62%), Docker (55%) and AWS (34%). Redis moved the most this month, backed by the cache-aside work on invoice lookup. AWS is your thinnest area relative to your backend architecture goal.";
  if (p.includes("last month") || p.includes("quarter") || p.includes("summar"))
    return "Over the last month you completed 82 tasks across Payments and Platform, logged 20 hours of learning across 12 topics, and raised 9 blockers of which 7 are resolved. Standout work: the payment validation fix, the Redis caching layer and the invoice export.";
  if (p.includes("team"))
    return "Your team completed 43 tasks this week with 4 active blockers. Rahul is blocked on the staging environment (2 days), Priya is waiting on design approval. Learning is healthy at 28 hours. The payments goal is at 78% and on track for the 15th.";
  if (p.includes("risk"))
    return "Two goals look at risk: 'Ship payments platform v2' (64%, webhook retries depend on the blocked API contract) and 'AWS infrastructure' (38% with 3 months left). Both improve if the vendor docs land this week.";
  if (p.includes("stand"))
    return "Stand-up draft:\n• Arun — done: payment validation, PR #452. Today: integration testing. Blocked: API docs.\n• Priya — done: dashboard UI. Today: responsive pass. Blocked: design approval.\n• Rahul — done: migration debugging. Today: pipeline rebuild. Blocked: staging.\n• Meena — done: refund regression suite. Today: checkout smoke tests. No blockers.";
  return "Based on your journal, the through-line this week is payments reliability: validation, refunds and retries. The one thing worth protecting time for is integration testing — it's the last gate before release.";
}

export async function generateReview(period: string, name = "Arun Sharma"): Promise<string> {
  await delay(500);
  return `${period} Contributions — ${name}

Major accomplishments
• Completed the payment gateway integration end to end, including refunds and validation hardening.
• Introduced a Redis caching layer for invoice lookup, cutting p95 response time by 62%.
• Fixed a class of authentication issues around token rotation.
• Consistently participated in code reviews (avg. 4 reviews/week).

Skills developed
• Redis — cache-aside, TTL strategy and invalidation.
• Docker — multi-stage builds, image size reduced 82%.
• AWS — IAM least-privilege roles per environment.

Impact
• Reduced API response time on the invoice path from 380ms to 24ms.
• Improved deployment reliability by removing a recurring migration failure.
• Unblocked two teammates by documenting the payments runbook.

Areas to grow next quarter
• Lead a design review to broaden architecture influence.
• Deepen AWS/Terraform to move the infrastructure goal past 38%.`;
}

export type StatusFormat = "personal" | "manager" | "bullets" | "detailed" | "email";

export interface WeeklyStatusInput {
  name: string;
  periodLabel: string;
  completed: string[];
  inProgress?: string[];
  learned?: string[];
  blockers?: string[];
  nextWeek?: string[];
  managerName?: string;
  format?: StatusFormat;
}

function uniq(items: string[], max = 12) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = sentence(clean(raw));
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function bullets(items: string[], fallback: string) {
  const list = items.length ? items : [fallback];
  return list.map((i) => `• ${i}`).join("\n");
}

/** Build a shareable weekly status from the user's own captured work (not surveillance). */
export async function generateWeeklyStatus(input: WeeklyStatusInput): Promise<{
  format: StatusFormat;
  subject: string;
  body: string;
  sections: {
    completed: string[];
    inProgress: string[];
    learned: string[];
    blockers: string[];
    nextWeek: string[];
  };
}> {
  await delay(350);
  const format = input.format ?? "manager";
  const completed = uniq(input.completed);
  const inProgress = uniq(input.inProgress ?? []);
  const learned = uniq(input.learned ?? [], 8);
  const blockers = uniq(input.blockers ?? [], 8);
  const nextWeek = uniq(input.nextWeek ?? [], 8);
  const subject = `Weekly Work Update — ${input.periodLabel}`;
  const manager = input.managerName?.trim() || "there";

  const sections = { completed, inProgress, learned, blockers, nextWeek };

  let body = "";
  if (format === "email") {
    body = `Hi ${manager},

Here is my weekly update for ${input.periodLabel}:

**Completed**
${bullets(completed, "No completed items logged this week.")}

**In Progress**
${bullets(inProgress, "Nothing marked in progress.")}

**Next Week**
${bullets(nextWeek, "Continue priority work from this week.")}
${blockers.length ? `\n**Blockers / Needs**\n${bullets(blockers, "")}` : ""}
${learned.length ? `\n**Learning**\n${bullets(learned, "")}` : ""}

Thanks,
${input.name}`;
  } else if (format === "bullets") {
    body = `*Weekly update — ${input.periodLabel}*\n\n*Completed*\n${bullets(completed, "—")}\n\n*In progress*\n${bullets(inProgress, "—")}\n\n*Next week*\n${bullets(nextWeek, "—")}${blockers.length ? `\n\n*Blockers*\n${bullets(blockers, "")}` : ""}`;
  } else if (format === "detailed") {
    body = `${input.periodLabel} — detailed review for ${input.name}

Completed
${bullets(completed, "No completed work logged.")}

In progress
${bullets(inProgress, "None.")}

Learning
${bullets(learned, "No learning logged.")}

Blockers
${bullets(blockers, "None lasting.")}

Plan for next week
${bullets(nextWeek, "Carry forward current priorities.")}`;
  } else if (format === "personal") {
    body = `Your week — ${input.periodLabel}

You finished:
${bullets(completed, "Nothing captured yet — log today's work.")}

Still moving:
${bullets(inProgress, "—")}

Up next:
${bullets(nextWeek, "Pick one focus for Monday.")}`;
  } else {
    // manager
    body = `Weekly update — ${input.periodLabel}

Completed
${bullets(completed, "No completed items logged this week.")}

In Progress
${bullets(inProgress, "Nothing marked in progress.")}

Next Week
${bullets(nextWeek, "Continue priority work from this week.")}${blockers.length ? `\n\nNeeds attention\n${bullets(blockers, "")}` : ""}`;
  }

  return { format, subject, body: body.trim(), sections };
}

