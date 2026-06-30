// platform/generators/security.mjs
// ---------------------------------------------------------------------------
// Emits a security test scaffold (jsdom `unit` project) when the scanner finds
// unsafe-content sinks (dangerouslySetInnerHTML, target="_blank" without
// noopener, eval, tokens in web storage). One it.todo() per detected sink, each
// naming the component + risk, plus a recommended XSS-escaping assertion.
//
//   generateSecurityTest(analysis) -> { filename, content } | { skipped }
// ---------------------------------------------------------------------------
import { GENERATED_MARKER } from '../../scripts/lib/stories.mjs';

export function generateSecurityTest(analysis) {
  const risky = (analysis.components ?? []).filter((c) => c.security?.length);
  if (!risky.length) return { skipped: 'no security sinks detected' };

  const todos = risky
    .flatMap((c) => c.security.map((s) => `  it.todo('${c.name}: ${s.kind} — ${s.message.replace(/'/g, '’')}');`))
    .join('\n');

  const content = `// ${GENERATED_MARKER} — security test scaffold.
// The scanner flagged unsafe-content sinks below. For each, assert the unsafe
// behaviour can't happen — e.g. an untrusted string renders as escaped text and
// injects no live <script>/<img>, external "_blank" links carry rel="noopener
// noreferrer", and dangerous href protocols are neutralized.
// You'll typically want:
//   import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

const XSS = '<img src=x onerror="alert(1)"><script>alert(2)</script>';

describe('security', () => {
  it('has an XSS payload fixture ready', () => {
    expect(XSS).toContain('onerror');
  });

${todos}

  // Example XSS-escaping assertion:
  //   const { container } = render(<YourComponent body={XSS} />);
  //   expect(screen.getByText(/onerror/)).toBeInTheDocument(); // shown as text
  //   expect(container.querySelector('script')).toBeNull();    // not executed
});
`;

  return { filename: 'src/security.scaffold.test.tsx', content };
}
