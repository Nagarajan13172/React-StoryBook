import type { ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  /** Visual style of the button. */
  variant?: ButtonVariant;
  /** Relative size of the button. */
  size?: ButtonSize;
  /** Visible label / content of the button. */
  children: ReactNode;
  /** Disables the button and prevents click handlers from firing. */
  disabled?: boolean;
  /**
   * Shows a spinner, sets `aria-busy`, and disables interaction.
   * Use while an async action triggered by the button is in flight.
   */
  loading?: boolean;
  /** Click handler. In stories this is spied on with `fn()`. */
  onClick?: () => void;
  /** Native button type. Defaults to "button" so it never submits a form by accident. */
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Accessible button.
 *
 * Renders a real <button> element so it is keyboard-focusable and exposes the
 * correct role/name to assistive tech out of the box. The loading spinner is
 * `aria-hidden` and the busy state is communicated via `aria-busy` instead.
 */
export function Button({
  variant = 'primary',
  size = 'medium',
  children,
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      className={`ws-button ws-button--${variant} ws-button--${size}`}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading && <span className="ws-button__spinner" aria-hidden="true" />}
      <span className="ws-button__label">{children}</span>
    </button>
  );
}
