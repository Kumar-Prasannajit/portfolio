// Shared layout for the generated Open Graph images (app/**/opengraph-image.tsx).
// Colors mirror the dark theme tokens in app/globals.css. The site's fonts come
// from next/font/google, so there are no local font files to load here and the
// renderer's default font is used.

import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const BG = "#5c0a12";
const INK = "#ffffff";
const INK_DIM = "rgba(255, 255, 255, 0.7)";
const RED = "#ff6b6b";

type OgImageProps = {
  title: string;
  // Small line above the title (e.g. "Weekly").
  label?: string;
  // Line under the title, in the accent color (home image only).
  subtitle?: string;
  // Small text in the bottom-left corner.
  footer: string;
  // Small text in the bottom-right corner.
  corner?: string;
};

// Long titles get a smaller size so they stay within three lines.
function titleSize(title: string, base: number) {
  if (title.length > 80) return Math.round(base * 0.6);
  if (title.length > 48) return Math.round(base * 0.75);
  return base;
}

export function ogImage({ title, label, subtitle, footer, corner }: OgImageProps) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: BG,
          color: INK,
          borderLeft: `16px solid ${RED}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {label ? (
            <div
              style={{
                display: "flex",
                fontSize: 30,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: RED,
                marginBottom: 24,
              }}
            >
              {label}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: titleSize(title, subtitle ? 80 : 84),
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -2,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                display: "flex",
                fontSize: 52,
                color: RED,
                marginTop: 28,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: corner ? "space-between" : "flex-start",
            fontSize: 28,
            color: INK_DIM,
          }}
        >
          <div style={{ display: "flex" }}>{footer}</div>
          {corner ? <div style={{ display: "flex" }}>{corner}</div> : null}
        </div>
      </div>
    ),
    OG_SIZE
  );
}
