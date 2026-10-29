// Telegram Bot API calls and nothing else: no decisions, `fetch` injected so
// tests can fake it. Errors name the method and status only. The bot token is
// part of every URL, so it (and the file download URL) is never put in a message.

import type { Keyboard } from "./telegram.ts";

export type TelegramApi = {
  sendMessage(chatId: string, html: string, opts?: { keyboard?: Keyboard; forceReply?: boolean }): Promise<void>;
  answerCallback(id: string): Promise<void>;
  downloadFile(fileId: string): Promise<{ bytes: Uint8Array; filePath: string }>;
};

export function telegramApi(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  const redact = (s: string) => s.split(token).join("***");

  async function send(url: string, what: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(url, init);
    } catch {
      throw new Error(`${what} failed`); // the underlying error may quote the URL
    }
  }

  async function call<T>(method: string, body: object): Promise<T> {
    const res = await send(`https://api.telegram.org/bot${token}/${method}`, `Telegram ${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: T; error_code?: number; description?: string }
      | null;
    if (!res.ok || !json?.ok) {
      const detail = json?.description ? `: ${redact(json.description.split("\n")[0])}` : "";
      throw new Error(`Telegram ${method} → ${json?.error_code ?? res.status}${detail}`);
    }
    return json.result as T;
  }

  return {
    async sendMessage(chatId, html, opts = {}) {
      await call("sendMessage", {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(opts.keyboard
          ? { reply_markup: opts.keyboard }
          : opts.forceReply
            ? { reply_markup: { force_reply: true } }
            : {}),
      });
    },

    async answerCallback(id) {
      await call("answerCallbackQuery", { callback_query_id: id });
    },

    async downloadFile(fileId) {
      const { file_path: filePath } = await call<{ file_path: string }>("getFile", { file_id: fileId });
      const res = await send(`https://api.telegram.org/file/bot${token}/${filePath}`, "Telegram file download");
      if (!res.ok) throw new Error(`Telegram file download → ${res.status}`);
      return { bytes: new Uint8Array(await res.arrayBuffer()), filePath };
    },
  };
}
