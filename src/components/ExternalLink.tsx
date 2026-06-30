import type { ReactNode } from 'react';

export interface ExternalLinkProps {
  /** Destination URL. Dangerous protocols are neutralized (see below). */
  href: string;
  /** Link text/content. */
  children: ReactNode;
  /** Open in a new tab. Defaults to true. */
  newTab?: boolean;
}

// Allow only protocols that can't execute script. `javascript:` and `data:`
// URLs (the classic anchor-XSS vectors) fall through to a safe no-op href.
const SAFE_PROTOCOL = /^(https?:|mailto:|\/|#)/i;

/**
 * A link to untrusted/external destinations, hardened by default.
 *
 * SECURITY:
 *  - blocks dangerous `href` protocols (`javascript:`, `data:`) — the anchor
 *    falls back to "#" rather than executing script on click;
 *  - when opening a new tab, always sets `rel="noopener noreferrer"` so the
 *    opened page can't reach back through `window.opener` (reverse tabnabbing).
 */
export function ExternalLink({ href, children, newTab = true }: ExternalLinkProps) {
  const safeHref = SAFE_PROTOCOL.test(href.trim()) ? href : '#';
  const tabProps = newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <a className="ws-external-link" href={safeHref} {...tabProps}>
      {children}
    </a>
  );
}
