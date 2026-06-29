import { useId } from 'react';
import './TextField.css';

export interface TextFieldProps {
  /** Visible, programmatically-associated label (required for accessibility). */
  label: string;
  /** Input type. */
  type?: 'text' | 'email' | 'password' | 'search';
  /** Controlled value. */
  value?: string;
  /** Change handler — receives the new string value. */
  onChange?: (value: string) => void;
  /** Placeholder text. */
  placeholder?: string;
  /** Optional helper text shown below the field. */
  helpText?: string;
  /** Error message. When set, the field is marked invalid and styled accordingly. */
  error?: string;
  /** Marks the field as required. */
  required?: boolean;
  /** Disables the field. */
  disabled?: boolean;
  /** Optional name for form submission. */
  name?: string;
}

/**
 * Accessible text input.
 *
 * The label is always rendered and linked to the input via `htmlFor`/`id`.
 * Help text and error messages are linked with `aria-describedby`, and the
 * invalid state is exposed through `aria-invalid` so assistive tech announces it.
 */
export function TextField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  helpText,
  error,
  required = false,
  disabled = false,
  name,
}: TextFieldProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, helpText ? helpId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`ws-field ${error ? 'ws-field--invalid' : ''}`}>
      <label className="ws-field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="ws-field__required" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      <input
        id={id}
        name={name}
        className="ws-field__input"
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange?.(e.target.value)}
      />
      {helpText && !error && (
        <p id={helpId} className="ws-field__help">
          {helpText}
        </p>
      )}
      {error && (
        <p id={errorId} className="ws-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
