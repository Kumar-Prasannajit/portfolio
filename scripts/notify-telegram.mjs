// Sends the Telegram review bot's own messages. Run by
// .github/workflows/telegram-notify.yml, which passes the event as a file and
// the tokens as env vars; prints one log line.
//
//   node scripts/notify-telegram.mjs deployment | reminders | log-issue <n> | edit-failed
//
// Env: GITHUB_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, and GITHUB_EVENT_PATH
// for `deployment` and `edit-failed`. LINKEDIN_POST_SECRET is optional: when set,
// `deployment` asks the site to post the live draft to LinkedIn and `reminders`
// also checks the LinkedIn token; without it the bot behaves as before.
// Nothing here prints a token.

import fs from "node:fs";
import { assertNode } from "./nodeVersion.mjs";

assertNode();

const USAGE = "usage: node scripts/notify-telegram.mjs <deployment | reminders | log-issue <n> | edit-failed>";
const [command, arg] = process.argv.slice(2);

// Ends with process.exitCode, never process.exit(): on Windows, Node 24 can
// crash in process.exit() shortly after importing a .ts module.
async function main() {
  const known = ["deployment", "reminders", "log-issue", "edit-failed"];
  if (!known.includes(command) || (command === "log-issue" && !/^\d+$/.test(arg ?? ""))) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const missing = ["GITHUB_TOKEN", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.log(`missing env: ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  // Dynamic imports, so an old Node gets assertNode's message rather than a
  // failure to load the .ts modules.
  const { githubRepo } = await import("../lib/githubWrite.ts");
  const { telegramApi } = await import("../lib/telegramApi.ts");
  const notify = await import("../lib/telegramNotify.ts");
  const { linkedinClient } = await import("../lib/linkedinClient.ts");

  const deps = {
    gh: githubRepo(process.env.GITHUB_TOKEN),
    tg: telegramApi(process.env.TELEGRAM_BOT_TOKEN),
    chatId: process.env.TELEGRAM_CHAT_ID,
    now: new Date(),
    linkedin: process.env.LINKEDIN_POST_SECRET ? linkedinClient(process.env.LINKEDIN_POST_SECRET) : undefined,
  };
  const event = () => JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));

  let line;
  if (command === "deployment") {
    const { deployment = {}, deployment_status: status = {} } = event();
    line = await notify.notifyDeployment(
      {
        environment: status.environment ?? deployment.environment ?? "",
        state: status.state ?? "",
        sha: deployment.sha ?? "",
        environmentUrl: status.environment_url || null,
        targetUrl: status.target_url || null,
      },
      deps,
    );
  } else if (command === "reminders") {
    line = await notify.notifyReminders(deps);
  } else if (command === "log-issue") {
    line = await notify.notifyLogIssue(Number(arg), deps);
  } else {
    const { issue, comment } = event();
    line = await notify.notifyEditFailed(issue.number, comment.body, deps);
  }
  console.log(line);
}

main().catch((err) => {
  console.log(`notify failed: ${String(err?.message ?? err).split("\n")[0]}`);
  process.exitCode = 1;
});
