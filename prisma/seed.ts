import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function day(offset: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000);
}

async function main() {
  await prisma.generatedReport.deleteMany();
  await prisma.savedReviewPeriod.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.reminderDispatch.deleteMany();
  await prisma.updateRequest.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.organizationWorkUpdatePolicy.deleteMany();
  await prisma.ideaVote.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.userAiConfig.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.recognition.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.blocker.deleteMany();
  await prisma.goalMilestone.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.learningEntry.deleteMany();
  await prisma.dailyJournal.deleteMany();
  await prisma.dailyPlan.deleteMany();
  await prisma.task.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.knowledgeEntry.deleteMany();
  await prisma.userSkill.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.project.deleteMany();
  await prisma.leaveType.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { name: "Acme Technologies", plan: "Business", kind: "ENTERPRISE" },
  });

  await prisma.organizationWorkUpdatePolicy.create({
    data: {
      organizationId: org.id,
      enabled: true,
      requireDaily: true,
      reminderTime: "17:00",
      workingDays: [1, 2, 3, 4, 5],
      notifyInApp: true,
      notifyEmail: true,
      reminderFrequency: "once_daily",
    },
  });

  const deptNames = ["Engineering", "Product", "Design", "QA", "HR", "Marketing"] as const;
  const departments = Object.fromEntries(
    await Promise.all(
      deptNames.map(async (name) => {
        const d = await prisma.department.create({ data: { organizationId: org.id, name } });
        return [name, d.id] as const;
      }),
    ),
  );

  const leaveTypes = {
    Casual: await prisma.leaveType.create({
      data: { organizationId: org.id, name: "Casual Leave", daysPerYear: 12, accrual: "Annual grant", carry: "3 days" },
    }),
    Sick: await prisma.leaveType.create({
      data: { organizationId: org.id, name: "Sick Leave", daysPerYear: 8, accrual: "Annual grant", carry: "None" },
    }),
    Earned: await prisma.leaveType.create({
      data: { organizationId: org.id, name: "Earned Leave", daysPerYear: 18, accrual: "1.5 / month", carry: "Unlimited" },
    }),
  };

  const projectNames = ["Payments", "Platform", "Web App", "Infra", "Design System", "Personal"];
  const projects = Object.fromEntries(
    await Promise.all(
      projectNames.map(async (name) => {
        const p = await prisma.project.create({ data: { organizationId: org.id, name } });
        return [name, p.id] as const;
      }),
    ),
  );

  const passwordHash = await bcrypt.hash("workpulse", 10);

  const sarah = await prisma.user.create({
    data: {
      id: "u6",
      organizationId: org.id,
      email: "sarah@acmetech.io",
      passwordHash,
      name: "Sarah Mathew",
      role: "MANAGER",
      jobTitle: "Engineering Manager",
      departmentId: departments["Engineering"],
      joinedAt: new Date("2020-02-03"),
      avatarInitials: "SM",
    },
  });

  await prisma.user.create({
    data: {
      id: "u0",
      organizationId: org.id,
      email: "admin@acmetech.io",
      passwordHash,
      name: "Acme Admin",
      role: "ORG_ADMIN",
      jobTitle: "Organization Admin",
      departmentId: departments["HR"],
      joinedAt: new Date("2019-01-01"),
      avatarInitials: "AA",
    },
  });

  await prisma.user.create({
    data: {
      id: "u7",
      organizationId: org.id,
      email: "hr@acmetech.io",
      passwordHash,
      name: "Neha Kapoor",
      role: "HR_ADMIN",
      jobTitle: "HR Business Partner",
      departmentId: departments["HR"],
      joinedAt: new Date("2020-06-15"),
      avatarInitials: "NK",
    },
  });

  await prisma.user.createMany({
    data: [
      {
        id: "u1",
        organizationId: org.id,
        email: "arun@acmetech.io",
        passwordHash,
        name: "Arun Sharma",
        role: "EMPLOYEE",
        jobTitle: "Senior Backend Engineer",
        departmentId: departments["Engineering"],
        managerId: sarah.id,
        joinedAt: new Date("2022-04-11"),
        avatarInitials: "AS",
      },
      {
        id: "u2",
        organizationId: org.id,
        email: "priya@acmetech.io",
        passwordHash,
        name: "Priya Nair",
        role: "EMPLOYEE",
        jobTitle: "Frontend Engineer",
        departmentId: departments["Engineering"],
        managerId: sarah.id,
        joinedAt: new Date("2023-01-09"),
        avatarInitials: "PN",
      },
      {
        id: "u3",
        organizationId: org.id,
        email: "rahul@acmetech.io",
        passwordHash,
        name: "Rahul Verma",
        role: "EMPLOYEE",
        jobTitle: "DevOps Engineer",
        departmentId: departments["Engineering"],
        managerId: sarah.id,
        joinedAt: new Date("2021-08-02"),
        avatarInitials: "RV",
      },
      {
        id: "u4",
        organizationId: org.id,
        email: "meena@acmetech.io",
        passwordHash,
        name: "Meena Iyer",
        role: "EMPLOYEE",
        jobTitle: "QA Engineer",
        departmentId: departments["QA"],
        managerId: sarah.id,
        joinedAt: new Date("2023-06-19"),
        avatarInitials: "MI",
      },
      {
        id: "u5",
        organizationId: org.id,
        email: "vikram@acmetech.io",
        passwordHash,
        name: "Vikram Rao",
        role: "EMPLOYEE",
        jobTitle: "Product Designer",
        departmentId: departments["Design"],
        managerId: sarah.id,
        joinedAt: new Date("2022-11-14"),
        avatarInitials: "VR",
      },
    ],
  });

  await prisma.department.update({
    where: { id: departments["Engineering"]! },
    data: { managerId: sarah.id },
  });

  const skillNames = [
    "Node.js",
    "PostgreSQL",
    "Redis",
    "Docker",
    "AWS",
    "React",
    "TypeScript",
    "Accessibility",
    "Kubernetes",
    "Terraform",
    "Playwright",
    "API Testing",
    "Design Systems",
    "Prototyping",
    "Coaching",
    "System Design",
  ];
  for (const name of skillNames) {
    await prisma.skill.create({ data: { name } });
  }
  const skills = Object.fromEntries((await prisma.skill.findMany()).map((s) => [s.name, s.id]));

  await prisma.userSkill.createMany({
    data: [
      { userId: "u1", skillId: skills["Node.js"]!, level: 88, trend: "up" },
      { userId: "u1", skillId: skills["PostgreSQL"]!, level: 74, trend: "up" },
      { userId: "u1", skillId: skills["Redis"]!, level: 62, trend: "up" },
      { userId: "u1", skillId: skills["Docker"]!, level: 55, trend: "up" },
      { userId: "u1", skillId: skills["AWS"]!, level: 34, trend: "flat" },
      { userId: "u2", skillId: skills["React"]!, level: 92, trend: "up" },
      { userId: "u2", skillId: skills["TypeScript"]!, level: 84, trend: "up" },
      { userId: "u2", skillId: skills["Accessibility"]!, level: 58, trend: "up" },
      { userId: "u3", skillId: skills["Kubernetes"]!, level: 81, trend: "up" },
      { userId: "u3", skillId: skills["Terraform"]!, level: 70, trend: "flat" },
      { userId: "u3", skillId: skills["AWS"]!, level: 78, trend: "up" },
      { userId: "u4", skillId: skills["Playwright"]!, level: 76, trend: "up" },
      { userId: "u4", skillId: skills["API Testing"]!, level: 69, trend: "flat" },
      { userId: "u5", skillId: skills["Design Systems"]!, level: 87, trend: "up" },
      { userId: "u5", skillId: skills["Prototyping"]!, level: 72, trend: "flat" },
      { userId: "u6", skillId: skills["Coaching"]!, level: 84, trend: "up" },
      { userId: "u6", skillId: skills["System Design"]!, level: 79, trend: "flat" },
    ],
  });

  await prisma.task.createMany({
    data: [
      {
        projectId: projects["Payments"]!,
        assigneeId: "u1",
        title: "Fix payment validation edge case",
        description: "Amounts over 10k fail the decimal check on the gateway callback.",
        priority: "CRITICAL",
        status: "DONE",
        dueDate: day(0),
        estimateMins: 90,
        tags: ["bug", "api"],
      },
      {
        projectId: projects["Payments"]!,
        assigneeId: "u1",
        title: "Review PR #452 — refund service",
        priority: "MEDIUM",
        status: "DONE",
        dueDate: day(0),
        estimateMins: 30,
        tags: ["review"],
      },
      {
        projectId: projects["Platform"]!,
        assigneeId: "u1",
        title: "Add Redis cache to invoice lookup",
        description: "Cache-aside with 5 min TTL and explicit invalidation on write.",
        priority: "HIGH",
        status: "IN_PROGRESS",
        dueDate: day(0),
        estimateMins: 150,
        tags: ["performance"],
      },
      {
        projectId: projects["Payments"]!,
        assigneeId: "u1",
        title: "Write integration tests for checkout",
        priority: "HIGH",
        status: "TODO",
        dueDate: day(0),
        estimateMins: 120,
        tags: ["testing"],
      },
      {
        projectId: projects["Payments"]!,
        assigneeId: "u1",
        title: "Wire up webhook retries",
        priority: "MEDIUM",
        status: "BLOCKED",
        dueDate: day(1),
        estimateMins: 60,
        tags: ["api"],
      },
      {
        projectId: projects["Payments"]!,
        assigneeId: "u1",
        title: "Finish payment integration testing",
        priority: "HIGH",
        status: "TODO",
        dueDate: day(1),
        estimateMins: 180,
        tags: ["testing"],
      },
      {
        projectId: projects["Web App"]!,
        assigneeId: "u1",
        title: "Pair with Priya on dashboard states",
        priority: "LOW",
        status: "TODO",
        dueDate: day(1),
        estimateMins: 45,
        tags: ["collab"],
      },
      {
        projectId: projects["Web App"]!,
        assigneeId: "u2",
        title: "Responsive pass on analytics cards",
        priority: "MEDIUM",
        status: "IN_PROGRESS",
        dueDate: day(0),
        estimateMins: 120,
        tags: ["ui"],
      },
      {
        projectId: projects["Infra"]!,
        assigneeId: "u3",
        title: "Harden staging deploy pipeline",
        priority: "HIGH",
        status: "BLOCKED",
        dueDate: day(0),
        estimateMins: 200,
        tags: ["ci"],
      },
    ],
  });

  const journals = [
    {
      userId: "u1",
      date: day(0),
      completion: 60,
      mood: 4,
      focus: "Ship the payment validation fix with tests.",
      completed: ["Fixed payment validation edge case", "Reviewed PR #452"],
      learned: ["Redis cache invalidation strategies"],
      blocked: ["Waiting for payment API documentation"],
      tomorrow: ["Finish integration testing", "Wire up webhook retries"],
    },
    {
      userId: "u1",
      date: day(-1),
      completion: 85,
      mood: 4,
      focus: "Unblock the refund flow.",
      completed: ["Refactored refund service", "Debugged gateway timeout"],
      learned: ["Idempotency keys for payment retries"],
      blocked: [] as string[],
      tomorrow: ["Fix payment validation", "Review PR #452"],
      managerNote: "Refund flow is ready for QA on Thursday.",
    },
    {
      userId: "u1",
      date: day(-2),
      completion: 100,
      mood: 5,
      completed: ["Shipped invoice export", "Cleaned up migration scripts"],
      learned: ["Postgres partial indexes"],
      blocked: [],
      tomorrow: ["Refund service refactor"],
    },
    {
      userId: "u1",
      date: day(-3),
      completion: 45,
      mood: 2,
      completed: ["Triaged production alerts"],
      learned: [] as string[],
      blocked: ["Staging environment was down all afternoon"],
      tomorrow: ["Invoice export"],
    },
    {
      userId: "u1",
      date: day(-4),
      completion: 90,
      mood: 3,
      completed: ["Auth token rotation", "Docs for the payments runbook"],
      learned: ["Docker multi-stage builds"],
      blocked: [],
      tomorrow: ["Triage alerts"],
    },
    {
      userId: "u2",
      date: day(0),
      completion: 35,
      mood: 3,
      focus: "Responsive pass on analytics.",
      completed: ["Completed the dashboard UI"],
      learned: ["Accessible dialog patterns"],
      blocked: ["Design approval pending"],
      tomorrow: ["Responsive design pass on analytics"],
    },
    {
      userId: "u3",
      date: day(0),
      completion: 20,
      mood: 2,
      focus: "Rebuild the staging pipeline.",
      completed: ["Debugged the staging migration failures"],
      learned: ["Kubernetes rollout strategies"],
      blocked: ["Staging environment unstable"],
      tomorrow: ["Rebuild the staging pipeline"],
    },
    {
      userId: "u4",
      date: day(0),
      completion: 80,
      mood: 4,
      focus: "Automate checkout smoke tests.",
      completed: ["Wrote regression suite for refunds"],
      learned: ["Playwright fixtures"],
      blocked: [],
      tomorrow: ["Automate checkout smoke tests"],
    },
  ];

  for (const j of journals) {
    await prisma.dailyJournal.create({ data: j });
    await prisma.dailyPlan.create({
      data: { userId: j.userId, date: j.date, focus: "focus" in j ? j.focus : undefined, mood: j.mood },
    });
  }

  await prisma.learningEntry.createMany({
    data: [
      {
        userId: "u1",
        topic: "Redis caching & invalidation",
        description: "Cache-aside vs write-through, TTL strategy and stampede protection.",
        date: day(0),
        minutes: 45,
        confidence: 3,
        project: "Platform",
        tags: ["redis", "performance"],
      },
      {
        userId: "u1",
        topic: "Idempotency keys",
        description: "Safely retrying payment operations without double-charging.",
        date: day(-1),
        minutes: 40,
        confidence: 4,
        project: "Payments",
        tags: ["payments"],
      },
      {
        userId: "u1",
        topic: "Postgres partial indexes",
        description: "Cut the invoice lookup query from 380ms to 24ms.",
        date: day(-2),
        minutes: 60,
        confidence: 4,
        project: "Platform",
        tags: ["postgres"],
      },
      {
        userId: "u1",
        topic: "Docker multi-stage builds",
        description: "Reduced the API image from 1.2GB to 210MB.",
        date: day(-4),
        minutes: 75,
        confidence: 3,
        project: "Infra",
        tags: ["docker"],
      },
      {
        userId: "u1",
        topic: "AWS IAM least privilege",
        description: "Scoped deployment roles per environment.",
        date: day(-7),
        minutes: 50,
        confidence: 2,
        project: "Infra",
        tags: ["aws", "security"],
      },
    ],
  });

  await prisma.goal.create({
    data: {
      userId: "u1",
      title: "Become stronger in backend architecture",
      type: "Professional",
      progress: 82,
      targetDate: new Date("2026-09-30"),
      evidence: ["Built the payment service", "Implemented Redis caching", "Reworked authentication token rotation"],
      milestones: {
        create: [
          { title: "Own a service end to end", done: true },
          { title: "Design a caching layer", done: true },
          { title: "Lead a design review", done: false },
        ],
      },
    },
  });
  await prisma.goal.create({
    data: {
      userId: "u1",
      title: "Ship the payments platform v2",
      type: "Team",
      progress: 64,
      targetDate: new Date("2026-10-15"),
      evidence: ["Refund service shipped", "Gateway timeouts down 60%"],
      milestones: {
        create: [
          { title: "Refund service", done: true },
          { title: "Webhook retries", done: false },
          { title: "Merchant dashboard", done: false },
        ],
      },
    },
  });
  await prisma.goal.create({
    data: {
      userId: "u1",
      title: "Get comfortable with AWS infrastructure",
      type: "Learning",
      progress: 38,
      targetDate: new Date("2026-12-01"),
      evidence: ["Scoped deployment IAM roles"],
      milestones: {
        create: [
          { title: "IAM fundamentals", done: true },
          { title: "Deploy via Terraform", done: false },
        ],
      },
    },
  });

  const b1 = await prisma.blocker.create({
    data: {
      title: "Payment API documentation missing",
      description: "The webhook retry contract is undocumented; three people are guessing at it.",
      severity: "Critical",
      affected: 3,
      status: "IN_REVIEW",
      raisedById: "u1",
      ownerId: "u6",
      raisedAt: day(-2),
    },
  });
  await prisma.comment.create({
    data: {
      authorId: "u6",
      blockerId: b1.id,
      body: "Chased the vendor, expecting docs Thursday.",
      createdAt: day(-1),
    },
  });
  await prisma.blocker.create({
    data: {
      title: "Staging deployment environment unstable",
      description: "Deploys fail intermittently on the migration step.",
      severity: "High",
      affected: 2,
      status: "OPEN",
      raisedById: "u3",
      ownerId: "u3",
      raisedAt: day(-3),
    },
  });
  await prisma.blocker.create({
    data: {
      title: "Design approval pending for analytics cards",
      description: "Frontend work is paused until the layout is signed off.",
      severity: "Medium",
      affected: 1,
      status: "OPEN",
      raisedById: "u2",
      raisedAt: day(-1),
    },
  });

  await prisma.leaveRequest.createMany({
    data: [
      {
        userId: "u1",
        leaveTypeId: leaveTypes.Casual.id,
        from: day(12),
        to: day(13),
        days: 2,
        reason: "Family function",
        status: "APPROVED",
        requestedAt: day(-6),
      },
      {
        userId: "u2",
        leaveTypeId: leaveTypes.Sick.id,
        from: day(1),
        to: day(1),
        days: 1,
        reason: "Fever, will work async if better",
        status: "PENDING",
        requestedAt: day(0),
      },
      {
        userId: "u3",
        leaveTypeId: leaveTypes.Earned.id,
        from: day(20),
        to: day(26),
        days: 5,
        reason: "Vacation",
        status: "PENDING",
        requestedAt: day(-2),
      },
      {
        userId: "u4",
        leaveTypeId: leaveTypes.Casual.id,
        from: day(-14),
        to: day(-14),
        days: 1,
        reason: "Personal",
        status: "REJECTED",
        requestedAt: day(-18),
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: "u1",
        kind: "work_update_reminder",
        title: "You haven't added today's work update",
        body: "Take a moment to record what you worked on today.",
        actionUrl: "/my-day",
        createdAt: hoursAgo(2),
      },
      {
        userId: "u1",
        kind: "weekly_summary",
        title: "Your weekly summary is ready",
        body: "Review, edit, and share what you worked on this week.",
        actionUrl: "/weekly-review",
        createdAt: hoursAgo(20),
      },
      {
        userId: "u1",
        kind: "manager_request",
        title: "Your manager requested an update",
        body: "Please add an update for LMS Integration.",
        actionUrl: "/my-day",
        createdAt: hoursAgo(22),
      },
      {
        userId: "u1",
        kind: "task_due_soon",
        title: "Your task is due tomorrow",
        body: "Your task “LMS integration” is due tomorrow.",
        actionUrl: "/tasks",
        createdAt: hoursAgo(26),
      },
      {
        userId: "u1",
        kind: "reminder",
        title: "Capture today's reflection",
        body: "Before you sign off, note what you accomplished today.",
        createdAt: hoursAgo(1),
      },
      {
        userId: "u1",
        kind: "blocker",
        title: "Blocker update",
        body: "Sarah is chasing the payment API docs — expected Thursday.",
        createdAt: hoursAgo(4),
      },
      {
        userId: "u1",
        kind: "leave",
        title: "Leave approved",
        body: "Your casual leave request for 2 days was approved.",
        actionUrl: "/leave",
        read: true,
        createdAt: hoursAgo(7),
      },
      {
        userId: "u1",
        kind: "goal",
        title: "Goal check-in",
        body: "Backend architecture goal is due in 12 days — you're at 82%.",
        read: true,
        createdAt: hoursAgo(9),
      },
      {
        userId: "u1",
        kind: "recognition",
        title: "Priya recognised you",
        body: "Problem Solver — for untangling the gateway timeout.",
        actionUrl: "/recognition",
        read: true,
        createdAt: hoursAgo(28),
      },
      {
        userId: "u6",
        kind: "manager_blocked",
        title: "Arun reported a blocked task",
        body: "“LMS Enrollment Integration” is blocked.",
        actionUrl: "/team/updates",
        createdAt: hoursAgo(3),
      },
      {
        userId: "u6",
        kind: "manager_missing",
        title: "Vikram hasn't submitted an update for 2 working days",
        body: "They may need a reminder — not a performance judgment.",
        actionUrl: "/team/updates",
        createdAt: hoursAgo(5),
      },
    ],
  });

  await prisma.idea.create({
    data: {
      authorId: "u1",
      title: "Auto-generate release notes from journals",
      description: "Use daily journal entries to draft release notes for each deploy.",
      category: "Automation",
      status: "UNDER_REVIEW",
      votes: 24,
    },
  });
  await prisma.idea.create({
    data: {
      authorId: "u3",
      title: "Rotating on-call handbook",
      description: "A living doc updated after every incident.",
      category: "Process",
      status: "PLANNED",
      votes: 18,
    },
  });
  await prisma.idea.create({
    data: {
      authorId: "u2",
      title: "Quiet hours for meetings",
      description: "No-meeting blocks 10am-12pm for deep work.",
      category: "Workplace",
      status: "IMPLEMENTED",
      votes: 41,
    },
  });
  await prisma.idea.create({
    data: {
      authorId: "u4",
      title: "Consolidate staging environments",
      description: "Two idle environments cost us ~$900/month.",
      category: "Cost saving",
      status: "NEW",
      votes: 9,
    },
  });

  await prisma.recognition.createMany({
    data: [
      {
        fromId: "u2",
        toId: "u1",
        badge: "Problem Solver",
        message: "Untangled the gateway timeout nobody could reproduce.",
        createdAt: hoursAgo(26),
      },
      {
        fromId: "u6",
        toId: "u4",
        badge: "Customer Impact",
        message: "Caught the refund rounding bug before release.",
        createdAt: hoursAgo(50),
      },
      {
        fromId: "u3",
        toId: "u2",
        badge: "Mentor",
        message: "Walked the team through accessible dialogs.",
        createdAt: hoursAgo(120),
      },
    ],
  });

  await prisma.integration.createMany({
    data: [
      { organizationId: org.id, name: "GitHub", description: "Pull commits, PRs and reviews into your journal.", category: "Code", connected: true },
      { organizationId: org.id, name: "GitLab", description: "Sync merge requests and pipeline activity.", category: "Code", connected: false },
      { organizationId: org.id, name: "Jira", description: "Link issues to tasks and goals.", category: "Project", connected: false },
      { organizationId: org.id, name: "Linear", description: "Import issues and cycle progress.", category: "Project", connected: true },
      { organizationId: org.id, name: "Slack", description: "Post stand-ups and receive reminders.", category: "Chat", connected: false },
      { organizationId: org.id, name: "Microsoft Teams", description: "Share summaries with your channel.", category: "Chat", connected: false },
      { organizationId: org.id, name: "Google Calendar", description: "See meetings alongside your plan.", category: "Calendar", connected: true },
    ],
  });

  await prisma.calendarEvent.createMany({
    data: [
      { userId: "u1", title: "Daily stand-up", date: day(0), time: "09:30", kind: "meeting" },
      { userId: "u1", title: "Payments sync with vendor", date: day(0), time: "15:00", kind: "meeting" },
      { userId: "u1", title: "1:1 with Sarah", date: day(1), time: "11:00", kind: "meeting" },
      { userId: "u1", title: "Finish integration testing", date: day(1), kind: "task" },
      { userId: "u1", title: "Redis deep dive", date: day(0), time: "16:30", kind: "learning" },
      { userId: "u1", title: "Casual leave", date: day(12), kind: "leave" },
      { userId: "u1", title: "Backend goal review", date: day(8), kind: "goal" },
    ],
  });

  await prisma.achievement.createMany({
    data: [
      { userId: "u1", title: "Payments v1 shipped", detail: "Led the gateway integration end to end.", at: "July 2026" },
      { userId: "u1", title: "API latency cut 62%", detail: "Caching and index work on invoice lookup.", at: "August 2026" },
      { userId: "u1", title: "Mentored two new joiners", detail: "Onboarding buddy for the platform team.", at: "June 2026" },
    ],
  });

  await prisma.knowledgeEntry.createMany({
    data: [
      { userId: "u3", topic: "Kubernetes", summary: "Runs our cluster upgrades and autoscaling policies.", tags: ["kubernetes", "infra"] },
      { userId: "u1", topic: "Payment integration", summary: "Built the payment service and gateway callbacks.", tags: ["payments", "api"] },
      { userId: "u1", topic: "Authentication system", summary: "Owns token rotation and session handling.", tags: ["auth", "security"] },
      { userId: "u3", topic: "Production error triage", summary: "Resolved the recurring deploy migration failure.", tags: ["incident", "postgres"] },
      { userId: "u2", topic: "Design system in React", summary: "Maintains shared component library and a11y patterns.", tags: ["react", "design system"] },
    ],
  });

  const team = await prisma.team.create({
    data: { organizationId: org.id, name: "Platform Engineering" },
  });
  await prisma.teamMember.createMany({
    data: ["u1", "u2", "u3", "u4", "u6"].map((userId) => ({ teamId: team.id, userId })),
  });

  await prisma.savedReviewPeriod.createMany({
    data: [
      {
        organizationId: org.id,
        createdById: "u6",
        name: "FY 2026 Performance Review",
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2027-03-31T00:00:00.000Z"),
      },
      {
        organizationId: org.id,
        createdById: "u6",
        name: "Mid-Year Review 2026",
        startDate: new Date("2026-04-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
      },
      {
        organizationId: org.id,
        createdById: "u0",
        name: "Probation Review",
        startDate: new Date("2026-06-01T00:00:00.000Z"),
        endDate: new Date("2026-08-31T00:00:00.000Z"),
      },
    ],
  });

  console.log("Seeded Acme Technologies.");
  console.log("  Admin:    admin@acmetech.io / workpulse");
  console.log("  HR:       hr@acmetech.io / workpulse");
  console.log("  Employee: arun@acmetech.io / workpulse");
  console.log("  Manager:  sarah@acmetech.io / workpulse");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
