// Renders a JSON-LD <script>. "\\u003c" is escaped so a string containing "</script>"
// can't break out of the tag (see the Next.js JSON-LD guide).
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\u003c"),
      }}
    />
  );
}
