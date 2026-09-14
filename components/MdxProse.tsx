import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes } from "react";
import Link from "next/link";
import styles from "./MdxProse.module.css";

// Maps MDX's default HTML output (h1, p, code, ...) onto the site's own
// typography instead of the browser's unstyled defaults — see the
// "Using custom styles and components" pattern in the Next.js MDX guide.
// Passed directly to <MDXRemote components={...}>; no root
// mdx-components.tsx file is needed since this project renders MDX via
// next-mdx-remote/rsc rather than @next/mdx's file-based convention.
export function mdxComponents(): MDXComponents {
  return {
    h1: (props) => <h1 className={styles.h1} {...props} />,
    h2: (props) => <h2 className={styles.h2} {...props} />,
    h3: (props) => <h3 className={styles.h3} {...props} />,
    p: (props) => <p className={styles.p} {...props} />,
    strong: (props) => <strong className={styles.strong} {...props} />,
    ul: (props) => <ul className={styles.ul} {...props} />,
    ol: (props) => <ol className={styles.ol} {...props} />,
    li: (props) => <li className={styles.li} {...props} />,
    blockquote: (props) => <blockquote className={styles.blockquote} {...props} />,
    hr: () => <hr className={styles.hr} />,
    code: (props) => <code className={styles.code} {...props} />,
    pre: (props) => <pre className={styles.pre} {...props} />,
    a: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
      if (href && (href.startsWith("/") || href.startsWith("#"))) {
        return (
          <Link href={href} className={styles.link}>
            {children}
          </Link>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener" className={styles.link} {...props}>
          {children}
        </a>
      );
    },
  };
}

export { styles as mdxProseStyles };
