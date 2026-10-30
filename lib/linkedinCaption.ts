// The text of a LinkedIn post, without any network: a post's `linkedin` caption,
// a blank line and the post's URL, escaped for LinkedIn's "little" text format
// (`commentary`). A caption that cannot be posted whole is refused, never cut.

export const LINKEDIN_MAX = 3000;

// Reserved by the little text format: | { } @ [ ] ( ) < > # \ * _ ~
const RESERVED = new Set(Array.from("|{}@[]()<>\\*_~"));
const WORD = /[\p{L}\p{N}]/u;

/** Backslash-escapes the reserved characters; a `#` that starts a `#hashtag` stays live. */
export function escapeCommentary(text: string): string {
  const chars = Array.from(text);
  let out = "";
  chars.forEach((ch, i) => {
    if (ch === "#") {
      const prev = chars[i - 1];
      const next = chars[i + 1];
      const startsHashtag = next !== undefined && WORD.test(next) && !(prev !== undefined && WORD.test(prev));
      out += startsHashtag ? "#" : "\\#";
    } else {
      out += RESERVED.has(ch) ? `\\${ch}` : ch;
    }
  });
  return out;
}

/** The commentary to post. Throws for an empty caption or more than LINKEDIN_MAX characters. */
export function linkedinText(caption: string, url: string): string {
  const body = caption.trim();
  if (body === "") throw new Error("no LinkedIn caption");
  const raw = `${body}\n\n${url}`;
  if (raw.length > LINKEDIN_MAX) {
    throw new Error(`caption is ${raw.length} characters, LinkedIn allows ${LINKEDIN_MAX}`);
  }
  return escapeCommentary(raw);
}
