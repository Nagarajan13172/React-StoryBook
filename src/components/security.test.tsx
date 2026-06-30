import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Comment } from './Comment';
import { ExternalLink } from './ExternalLink';

describe('Comment — XSS-safe rendering', () => {
  it('escapes an HTML/script payload instead of executing it', () => {
    const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
    const { container } = render(<Comment author="mallory" body={payload} />);

    // The payload is shown verbatim as text…
    expect(screen.getByText(/onerror/)).toBeInTheDocument();
    // …and was never parsed into live DOM nodes.
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('ExternalLink — hardened anchor', () => {
  it('sets rel="noopener noreferrer" when opening a new tab', () => {
    render(<ExternalLink href="https://example.com">docs</ExternalLink>);
    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('neutralizes a javascript: URL', () => {
    render(<ExternalLink href="javascript:alert(1)">click me</ExternalLink>);
    expect(screen.getByRole('link', { name: 'click me' })).toHaveAttribute('href', '#');
  });

  it('neutralizes a data: URL', () => {
    render(<ExternalLink href="data:text/html,<script>alert(1)</script>">x</ExternalLink>);
    expect(screen.getByRole('link', { name: 'x' })).toHaveAttribute('href', '#');
  });

  it('keeps a safe http(s) URL intact and omits target when not opening a new tab', () => {
    render(
      <ExternalLink href="https://example.com/docs" newTab={false}>
        same tab
      </ExternalLink>
    );
    const link = screen.getByRole('link', { name: 'same tab' });
    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).not.toHaveAttribute('target');
  });
});
