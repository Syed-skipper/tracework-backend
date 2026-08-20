import { createApp } from "./app.js";
import { env } from "./config/env.config.js";
import { startWorkUpdateReminderJob } from "./jobs/work-update-reminders.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(`Tracework API listening on http://localhost:${env.port}`);
  startWorkUpdateReminderJob();
});
