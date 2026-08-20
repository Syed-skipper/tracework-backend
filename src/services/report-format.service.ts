import type { ReportType, ReportFormat } from "../constants/reports.js";

export interface ReportWorkContext {
  reportType: ReportType;
  format: ReportFormat;
  periodLabel: string;
  subjectName: string;
  subjectKind: "self" | "employee" | "team";
  managerName?: string;
  employeeCount?: number;
  updatesSubmitted?: number;
  expectedUpdates?: number;
  completed: string[];
  inProgress: string[];
  learned: string[];
  blockers: string[];
  nextWeek: string[];
  projects: string[];
  goals: { title: string; progress: number }[];
  achievements: string[];
  recognitions: string[];
  tasksCompleted: number;
  tasksAssigned: number;
  tasksInProgress: number;
  tasksBlocked: number;
}

function uniq(items: string[], max = 20) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const item = raw.trim().replace(/^[-•]\s*/, "");
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

function bullets(items: string[], empty: string) {
  const list = uniq(items);
  if (!list.length) return empty;
  return list.map((i) => `• ${i}`).join("\n");
}

function recordedOrNone(items: string[], none: string) {
  return bullets(items, none);
}

export function reportTitle(ctx: ReportWorkContext) {
  const typeLabel =
    ctx.reportType === "daily"
      ? "Daily Work Update"
      : ctx.reportType === "weekly"
        ? "Weekly Summary"
        : ctx.reportType === "monthly"
          ? "Monthly Review"
          : ctx.reportType === "performance"
            ? "Performance Review"
            : "Work Report";
  return `${typeLabel} — ${ctx.subjectName} — ${ctx.periodLabel}`;
}

export function reportSubjectLine(ctx: ReportWorkContext) {
  return reportTitle(ctx);
}

function heading(ctx: ReportWorkContext) {
  return `${reportTitle(ctx)}\n`;
}

function statsBlock(ctx: ReportWorkContext) {
  if (ctx.subjectKind === "team") {
    const lines = [`Employees: ${ctx.employeeCount ?? 0}`];
    if (ctx.expectedUpdates != null) {
      lines.push(`Updates submitted: ${ctx.updatesSubmitted ?? 0} of ${ctx.expectedUpdates} expected`);
    }
    lines.push(`Tasks completed: ${ctx.tasksCompleted}`);
    return `\nTeam overview\n${lines.map((l) => `• ${l}`).join("\n")}\n`;
  }
  if (ctx.reportType === "performance" || ctx.reportType === "monthly" || ctx.reportType === "custom") {
    return `\nRecorded activity\n• ${ctx.tasksCompleted} of ${ctx.tasksAssigned} assigned tasks completed.\n• ${ctx.tasksInProgress} in progress, ${ctx.tasksBlocked} blocked.\n`;
  }
  return "";
}

export function renderReportTemplate(ctx: ReportWorkContext): { subject: string; body: string } {
  const subject = reportSubjectLine(ctx);
  const completed = recordedOrNone(ctx.completed, "• No completed work was recorded during this period.");
  const inProgress = recordedOrNone(ctx.inProgress, "• No in-progress work was recorded during this period.");
  const blockers = recordedOrNone(ctx.blockers, "• No blockers were recorded during this period.");
  const learned = recordedOrNone(ctx.learned, "• No learning was recorded during this period.");
  const next = recordedOrNone(ctx.nextWeek, "• No upcoming priorities were recorded during this period.");
  const projects = recordedOrNone(ctx.projects, "• No projects were recorded during this period.");
  const goals = ctx.goals.length
    ? ctx.goals.map((g) => `• ${g.title} (${g.progress}%)`).join("\n")
    : "• No goals were recorded during this period.";
  const achievements = recordedOrNone(ctx.achievements, "• No achievements were recorded during this period.");

  const first = ctx.subjectName.split(" ")[0] ?? ctx.subjectName;
  const manager = ctx.managerName?.trim() || "there";

  if (ctx.format === "email") {
    const body = `Hi ${manager},

Here is the ${ctx.reportType} report for ${ctx.subjectName} (${ctx.periodLabel}).

Completed
${completed}

In Progress
${inProgress}

${ctx.blockers.length ? `Blocked\n${blockers}\n\n` : ""}Next
${next}

Thanks,
${first}`;
    return { subject, body: body.trim() };
  }

  if (ctx.format === "bullets") {
    const body = `${heading(ctx)}
Completed
${completed}

In Progress
${inProgress}

${ctx.learned.length ? `Learning\n${learned}\n\n` : ""}Blocked
${blockers}

Next
${next}`;
    return { subject, body: body.trim() };
  }

  if (ctx.reportType === "daily") {
    const body = `${heading(ctx)}
Completed
${completed}

In Progress
${inProgress}

Blocked
${blockers}`;
    return { subject, body: body.trim() };
  }

  if (ctx.reportType === "performance") {
    const body = `${heading(ctx)}${statsBlock(ctx)}
Key contributions
${completed}

Projects
${projects}

Completed work
• ${ctx.tasksCompleted} assigned tasks completed during this period.
${uniq(ctx.completed, 12).map((i) => `• ${i}`).join("\n") || ""}

In progress
${inProgress}

Challenges
${blockers}

Learning and development
${learned}

Goals progress
${goals}

Significant achievements
${achievements}

Evidence-based summary
During ${ctx.periodLabel}, ${ctx.subjectName} completed ${ctx.tasksCompleted} assigned tasks${
      ctx.projects[0] ? ` and contributed to ${uniq(ctx.projects, 4).join(", ")}` : ""
    }. This summary lists recorded work only. It does not assign a performance rating, score, or promotion recommendation.`;
    return { subject, body: body.trim() };
  }

  const extra =
    ctx.reportType === "monthly" || ctx.format === "detailed" || ctx.reportType === "custom"
      ? `
Projects
${projects}

Learning
${learned}

Goals
${goals}

Achievements
${achievements}
`
      : ctx.learned.length
        ? `\nLearning\n${learned}\n`
        : "";

  const body = `${heading(ctx)}${statsBlock(ctx)}
Completed
${completed}

In Progress
${inProgress}

Blocked
${blockers}
${extra}
Next
${next}`;

  return { subject, body: body.trim() };
}

export function buildReportPrompt(ctx: ReportWorkContext): { system: string; user: string } {
  const system = `You are Tracework, a work-reporting assistant.
Summarize ONLY the recorded facts supplied below. Do not invent tasks, accomplishments, dates, metrics, projects, goals, meetings, performance, or employee behavior.
If a section has no recorded items, write that nothing was recorded — do not guess.
Never assign a performance rating, score, promotion, or salary recommendation.
Do not call anyone a high or low performer. Describe recorded work only.
Distinguish recorded facts from wording: you may rephrase listed items, but you must not add new ones.
Keep language professional, supportive, and concise. Output plain text.`;

  const typeInstructions: Record<string, string> = {
    daily: `Write a concise Daily Work Update with sections: Completed, In Progress, Blocked (omit Blocked if none were recorded).`,
    weekly: `Write a Weekly Summary with: Completed, Major accomplishments (from completed items only), In Progress, Blocked, Learning (if recorded), Next week's priorities.`,
    monthly: `Write a Monthly Review with: Major accomplishments, Projects, Completed work, In Progress, Challenges, Learning, Goals, Next month's priorities. Use only listed facts.`,
    performance: `Write an evidence-based Performance Review. Include review period, key contributions, completed work with the recorded task counts, projects, challenges, learning, goals. End with an evidence-based summary that restates counts and listed work. Do NOT rate the employee.`,
    custom: `Write a professional work report for the period with Completed, In Progress, Blocked, Learning, Next. Use only listed facts.`,
  };

  const formatNote =
    ctx.format === "email"
      ? `Write as an email: greeting to ${ctx.managerName?.trim() || "there"}, body sections, closing with first name ${ctx.subjectName.split(" ")[0]}.`
      : ctx.format === "bullets"
        ? "Use short bullet sections."
        : ctx.format === "detailed"
          ? "Be thorough but do not invent extra items."
          : "Be concise and professional.";

  const workBlock = [
    `Report type: ${ctx.reportType}`,
    `Subject: ${ctx.subjectName} (${ctx.subjectKind})`,
    `Period: ${ctx.periodLabel}`,
    ctx.employeeCount != null ? `Employees: ${ctx.employeeCount}` : null,
    ctx.expectedUpdates != null
      ? `Updates submitted: ${ctx.updatesSubmitted ?? 0} / ${ctx.expectedUpdates}`
      : null,
    `Tasks completed (recorded count): ${ctx.tasksCompleted}`,
    `Tasks assigned (recorded count): ${ctx.tasksAssigned}`,
    `Tasks in progress (recorded count): ${ctx.tasksInProgress}`,
    `Tasks blocked (recorded count): ${ctx.tasksBlocked}`,
    "",
    "Completed items:",
    ...(ctx.completed.length ? uniq(ctx.completed).map((i) => `- ${i}`) : ["- (none recorded)"]),
    "",
    "In progress:",
    ...(ctx.inProgress.length ? uniq(ctx.inProgress).map((i) => `- ${i}`) : ["- (none recorded)"]),
    "",
    "Blockers:",
    ...(ctx.blockers.length ? uniq(ctx.blockers).map((i) => `- ${i}`) : ["- (none recorded)"]),
    "",
    "Learning:",
    ...(ctx.learned.length ? uniq(ctx.learned).map((i) => `- ${i}`) : ["- (none recorded)"]),
    "",
    "Next / upcoming:",
    ...(ctx.nextWeek.length ? uniq(ctx.nextWeek).map((i) => `- ${i}`) : ["- (none recorded)"]),
    "",
    "Projects:",
    ...(ctx.projects.length ? uniq(ctx.projects).map((i) => `- ${i}`) : ["- (none recorded)"]),
    "",
    "Goals:",
    ...(ctx.goals.length ? ctx.goals.map((g) => `- ${g.title} (${g.progress}%)`) : ["- (none recorded)"]),
    "",
    "Achievements:",
    ...(ctx.achievements.length ? uniq(ctx.achievements).map((i) => `- ${i}`) : ["- (none recorded)"]),
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    system,
    user: `${typeInstructions[ctx.reportType] ?? typeInstructions.custom}\n${formatNote}\n\nRecorded work:\n${workBlock}`,
  };
}
