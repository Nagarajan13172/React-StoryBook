import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './Button';
import { TextField } from './TextField';
import './LoginForm.css';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginFormProps {
  /**
   * Called with the credentials on a valid submit. May be async; if it rejects,
   * the rejection message is surfaced as an accessible form error (e.g. a failed
   * sign-in from the auth backend).
   */
  onSubmit?: (credentials: LoginCredentials) => void | Promise<unknown>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/**
 * Presentational sign-in form (no auth dependency — the page wires `onSubmit` to
 * `useAuth().login`). Validates client-side, disables while pending, and exposes
 * both validation and auth errors through a single `role="alert"` region.
 */
export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const errorId = useId();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await onSubmit?.({ email, password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="ws-login"
      onSubmit={handleSubmit}
      noValidate
      aria-describedby={error ? errorId : undefined}
    >
      <TextField
        label="Email address"
        type="email"
        name="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        required
      />
      <TextField
        label="Password"
        type="password"
        name="password"
        value={password}
        onChange={setPassword}
        required
      />
      {error && (
        <p id={errorId} role="alert" className="ws-login__error">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
