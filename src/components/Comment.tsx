import './Comment.css';

export interface CommentProps {
  /** Display name of the comment author. */
  author: string;
  /** Untrusted, user-submitted comment text. */
  body: string;
}

/**
 * Renders an untrusted user comment safely.
 *
 * SECURITY: `body` is attacker-controllable. It is rendered as a React text
 * child, so React escapes it for us — we deliberately do NOT use
 * `dangerouslySetInnerHTML`, which would open an XSS hole. The security test
 * proves a `<script>`/`<img onerror>` payload comes out as inert text.
 */
export function Comment({ author, body }: CommentProps) {
  return (
    <article className="ws-comment">
      <p className="ws-comment__author">{author}</p>
      <p className="ws-comment__body">{body}</p>
    </article>
  );
}
