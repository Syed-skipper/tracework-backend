import { env } from "../config/env.config.js";
import { prisma } from "../utils/prisma.js";

export interface OutboundEmail {
  to: string;
  toUserId?: string;
  organizationId?: string;
  subject: string;
  body: string;
}

function htmlFromText(body: string) {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return `<p style="font-family:sans-serif;line-height:1.5;color:#111">${escaped}</p>`;
}

/** In-app email pipeline: log always; send via Resend when configured. Never logs API keys. */
export async function sendEmail(msg: OutboundEmail) {
  const row = await prisma.emailLog.create({
    data: {
      organizationId: msg.organizationId ?? null,
      toEmail: msg.to,
      toUserId: msg.toUserId ?? null,
      subject: msg.subject,
      body: msg.body,
      status: "queued",
    },
  });

  try {
    if (env.resendApiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env.emailFrom,
          to: [msg.to],
          subject: msg.subject,
          text: msg.body,
          html: htmlFromText(msg.body),
        }),
      });
      if (!res.ok) {
        await prisma.emailLog.update({
          where: { id: row.id },
          data: { status: "failed", error: `provider_${res.status}` },
        });
        return { id: row.id, status: "failed" as const };
      }
      await prisma.emailLog.update({
        where: { id: row.id },
        data: { status: "sent", sentAt: new Date() },
      });
      return { id: row.id, status: "sent" as const };
    }

    if (env.isDev) {
      console.log(`[email:dev] to=${msg.to} subject=${msg.subject}`);
    }
    await prisma.emailLog.update({
      where: { id: row.id },
      data: { status: env.isDev ? "logged" : "queued" },
    });
    return { id: row.id, status: "queued" as const };
  } catch {
    await prisma.emailLog.update({
      where: { id: row.id },
      data: { status: "failed", error: "send_failed" },
    });
    return { id: row.id, status: "failed" as const };
  }
}

export function dailyReminderEmail(name: string, appUrl: string) {
  return {
    subject: "Tracework - Please add today's work update",
    body: `Hi ${name.split(" ")[0]},

You haven't added today's work update yet.

Take a moment to record what you worked on today.

Add today's update: ${appUrl}/my-day

Thanks,
Tracework`,
  };
}

export function managerRequestEmail(name: string, managerName: string, message: string, appUrl: string) {
  return {
    subject: "Tracework - Your manager requested an update",
    body: `Hi ${name.split(" ")[0]},

${managerName} requested an update:

${message}

Update now: ${appUrl}/my-day

Thanks,
Tracework`,
  };
}

export function taskAssignedEmail(name: string, title: string, appUrl: string) {
  return {
    subject: "Tracework - A task was assigned to you",
    body: `Hi ${name.split(" ")[0]},

You have been assigned a new task: ${title}

Open tasks: ${appUrl}/tasks

Thanks,
Tracework`,
  };
}

export function taskDueEmail(name: string, title: string, when: string, appUrl: string) {
  return {
    subject: `Tracework - Task ${when}: ${title}`,
    body: `Hi ${name.split(" ")[0]},

Your task "${title}" is ${when}.

Open tasks: ${appUrl}/tasks

Thanks,
Tracework`,
  };
}

export function weeklySummaryEmail(name: string, appUrl: string) {
  return {
    subject: "Tracework - Your weekly work summary is ready",
    body: `Hi ${name.split(" ")[0]},

Your weekly work summary is ready to review, edit, and share.

Open weekly summary: ${appUrl}/reviews?type=weekly

Thanks,
Tracework`,
  };
}
