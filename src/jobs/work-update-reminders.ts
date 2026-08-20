import { runScheduledWorkUpdateJobs } from "../services/team-updates.service.js";

const INTERVAL_MS = 15 * 60 * 1000;

export function startWorkUpdateReminderJob() {
  const tick = async () => {
    try {
      await runScheduledWorkUpdateJobs();
    } catch (err) {
      console.error("[work-update-reminders]", err instanceof Error ? err.message : err);
    }
  };
  const start = setTimeout(() => {
    void tick();
    setInterval(() => void tick(), INTERVAL_MS);
  }, 45_000);
  return start;
}
