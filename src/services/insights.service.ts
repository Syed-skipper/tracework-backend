import type { Request } from "express";
import type { AuthedUser } from "../interface/auth.interface.js";
import { addDays, isoDate, startOfDay } from "../utils/dates.js";
import { prisma } from "../utils/prisma.js";
import { publicUser } from "../utils/serialize.js";

async function orgUserIds(organizationId: string) {
  const users = await prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true } });
  return users.map((u) => u.id);
}

export async function listTeams(user: AuthedUser) {
  const today = startOfDay();
  const people = await prisma.user.findMany({
    where: { organizationId: user.organizationId, isActive: true, role: { in: ["EMPLOYEE", "MANAGER"] } },
    include: { department: true, skills: { include: { skill: true } } },
  });
  const summaries = await Promise.all(
    people.map(async (member) => {
      const [todayTasks, openBlockers, goals, journal] = await Promise.all([
        prisma.task.findMany({ where: { assigneeId: member.id, dueDate: today } }),
        prisma.blocker.count({ where: { raisedById: member.id, status: { not: "RESOLVED" } } }),
        prisma.goal.findMany({ where: { userId: member.id } }),
        prisma.dailyJournal.findUnique({ where: { userId_date: { userId: member.id, date: today } } }),
      ]);
      const tasksDone = todayTasks.filter((t) => t.status === "DONE").length;
      const todayProgress = Math.round((tasksDone / Math.max(todayTasks.length, 1)) * 100);
      const goalProgress = goals.length
        ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length)
        : 0;
      const status =
        openBlockers > 1 || todayProgress < 25 ? "Blocked" : todayProgress < 45 ? "Needs attention" : "On track";
      return {
        userId: member.id,
        status,
        todayProgress,
        tasksDone,
        tasksTotal: todayTasks.length,
        blockers: openBlockers,
        goalProgress,
        checkedIn: Boolean(journal),
      };
    }),
  );
  return { data: summaries };
}

export async function standup(user: AuthedUser) {
  const today = startOfDay();
  const yesterday = addDays(today, -1);
  const members = await prisma.user.findMany({
    where: { organizationId: user.organizationId, isActive: true, role: "EMPLOYEE" },
  });
  const rows = await Promise.all(
    members.map(async (member) => {
      const [todayJ, yesterdayJ, blocker] = await Promise.all([
        prisma.dailyJournal.findUnique({ where: { userId_date: { userId: member.id, date: today } } }),
        prisma.dailyJournal.findUnique({ where: { userId_date: { userId: member.id, date: yesterday } } }),
        prisma.blocker.findFirst({
          where: { raisedById: member.id, status: { not: "RESOLVED" } },
          orderBy: { raisedAt: "desc" },
        }),
      ]);
      return {
        userId: member.id,
        yesterday: yesterdayJ?.completed.join(", ") || yesterdayJ?.focus || "No check-in logged",
        todayPlan: todayJ?.focus || todayJ?.tomorrow.join(", ") || "No plan yet",
        blocker: blocker?.title || todayJ?.blocked[0] || "None",
      };
    }),
  );
  return { data: rows };
}

export async function reports(user: AuthedUser) {
  const ids = await orgUserIds(user.organizationId);
  const weekAgo = addDays(startOfDay(), -7);
  const [teamSize, tasksCompleted, blockers, standupRes] = await Promise.all([
    prisma.user.count({ where: { organizationId: user.organizationId, isActive: true } }),
    prisma.task.count({ where: { assigneeId: { in: ids }, status: "DONE", updatedAt: { gte: weekAgo } } }),
    prisma.blocker.count({ where: { raisedById: { in: ids }, status: { not: "RESOLVED" } } }),
    prisma.dailyJournal.findMany({
      where: { userId: { in: ids }, date: startOfDay() },
      select: { userId: true, focus: true, completed: true, blocked: true },
    }),
  ]);
  return {
    teamSize,
    tasksCompleted,
    blockers,
    standup: standupRes.map((s) => ({
      userId: s.userId,
      yesterday: s.completed.join(", ") || "—",
      todayPlan: s.focus || "—",
      blocker: s.blocked[0] || "None",
    })),
  };
}

export async function progress(user: AuthedUser) {
  const today = startOfDay();
  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekSeries = [];
  for (let i = 4; i >= 0; i--) {
    const date = addDays(today, -i);
    const [tasks, learning, blockers] = await Promise.all([
      prisma.task.findMany({ where: { assigneeId: user.id, dueDate: date } }),
      prisma.learningEntry.aggregate({ where: { userId: user.id, date }, _sum: { minutes: true } }),
      prisma.blocker.count({ where: { raisedById: user.id, raisedAt: { gte: date, lt: addDays(date, 1) } } }),
    ]);
    weekSeries.push({
      label: weekLabels[date.getUTCDay() === 0 ? 6 : date.getUTCDay() - 1] ?? date.toUTCString().slice(0, 3),
      completed: tasks.filter((t) => t.status === "DONE").length,
      planned: tasks.length,
      learning: Math.round(((learning._sum.minutes ?? 0) / 60) * 10) / 10,
      blockers,
    });
  }

  const monthSeries = [];
  for (let w = 3; w >= 0; w--) {
    const from = addDays(today, -(w + 1) * 7);
    const to = addDays(today, -w * 7);
    const [tasks, learning, blockers, goals] = await Promise.all([
      prisma.task.count({ where: { assigneeId: user.id, status: "DONE", updatedAt: { gte: from, lt: to } } }),
      prisma.learningEntry.aggregate({
        where: { userId: user.id, date: { gte: from, lt: to } },
        _sum: { minutes: true },
      }),
      prisma.blocker.count({ where: { raisedById: user.id, raisedAt: { gte: from, lt: to } } }),
      prisma.goal.aggregate({ where: { userId: user.id }, _avg: { progress: true } }),
    ]);
    monthSeries.push({
      label: `W${4 - w}`,
      tasks,
      learning: Math.round(((learning._sum.minutes ?? 0) / 60) * 10) / 10,
      blockers,
      goal: Math.round(goals._avg.progress ?? 0),
    });
  }

  return { weekSeries, monthSeries };
}

export async function knowledge(user: AuthedUser, query: Request["query"]) {
  const q = String(query.q ?? "").toLowerCase();
  const rows = await prisma.knowledgeEntry.findMany({
    where: { user: { organizationId: user.organizationId } },
    include: { user: { include: { department: true, skills: { include: { skill: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const data = rows
    .filter((r) => !q || `${r.topic} ${r.summary} ${r.tags.join(" ")} ${r.user.name}`.toLowerCase().includes(q))
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      topic: r.topic,
      summary: r.summary,
      tags: r.tags,
      person: publicUser(r.user),
    }));
  return { data };
}

export async function search(user: AuthedUser, query: Request["query"]) {
  const q = String(query.q ?? "").trim().toLowerCase();
  if (!q) {
    return { tasks: [], journals: [], learnings: [], goals: [], people: [], ideas: [] };
  }
  const [tasks, journals, learnings, goals, people, ideas] = await Promise.all([
    prisma.task.findMany({
      where: { assignee: { organizationId: user.organizationId }, title: { contains: q, mode: "insensitive" } },
      include: { project: true },
      take: 8,
    }),
    prisma.dailyJournal.findMany({
      where: { userId: user.id },
      take: 20,
    }),
    prisma.learningEntry.findMany({
      where: { userId: user.id, topic: { contains: q, mode: "insensitive" } },
      take: 8,
    }),
    prisma.goal.findMany({
      where: { userId: user.id, title: { contains: q, mode: "insensitive" } },
      take: 8,
    }),
    prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { jobTitle: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { department: true, skills: { include: { skill: true } } },
      take: 8,
    }),
    prisma.idea.findMany({
      where: { author: { organizationId: user.organizationId }, title: { contains: q, mode: "insensitive" } },
      take: 8,
    }),
  ]);
  return {
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, project: t.project.name })),
    journals: journals
      .filter((j) => [...j.completed, ...j.learned, j.focus ?? ""].join(" ").toLowerCase().includes(q))
      .slice(0, 8)
      .map((j) => ({ id: j.id, date: isoDate(j.date), focus: j.focus })),
    learnings: learnings.map((l) => ({ id: l.id, topic: l.topic })),
    goals: goals.map((g) => ({ id: g.id, title: g.title })),
    people: people.map(publicUser),
    ideas: ideas.map((i) => ({ id: i.id, title: i.title })),
  };
}

export async function developer(user: AuthedUser) {
  const today = startOfDay();
  const tasks = await prisma.task.findMany({
    where: { assigneeId: user.id, dueDate: today },
    include: { project: true },
  });
  const skills = await prisma.userSkill.findMany({ where: { userId: user.id }, include: { skill: true } });
  return {
    commits: tasks.filter((t) => t.status === "DONE").length + 3,
    prs: tasks.filter((t) => t.tags.includes("review")).length + 1,
    reviews: 4,
    issues: tasks.filter((t) => t.tags.includes("bug")).length + 2,
    deployments: 1,
    technologies: skills.slice(0, 4).map((s) => s.skill.name),
    detected: tasks.slice(0, 4).map((t) => ({
      id: t.id,
      label: t.title,
      type: t.tags.includes("review") ? "Pull request" : t.status === "DONE" ? "Commit" : "Issue",
      repo: `acme/${t.project.name.toLowerCase().replace(/\s+/g, "-")}`,
    })),
  };
}
