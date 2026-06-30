import type { ReactNode } from 'react';
import './Card.css';

export interface CardProps {
  /** Card heading. Rendered as an <h2> so a card sits correctly under a page <h1>. */
  title?: string;
  /** Optional short description shown under the title. */
  description?: string;
  /** Main card content. */
  children?: ReactNode;
  /** Optional footer area (e.g. actions). */
  footer?: ReactNode;
}

/**
 * Simple content container with an optional heading, body, and footer.
 * Renders a semantic <section> with a heading so it forms a proper landmark.
 */
export function Card({ title, description, children, footer }: CardProps) {
  return (
    <section className="ws-card">
      {title && <h2 className="ws-card__title">{title}</h2>}
      {description && <p className="ws-card__description">{description}</p>}
      {children && <div className="ws-card__body">{children}</div>}
      {footer && <div className="ws-card__footer">{footer}</div>}
    </section>
  );
}
