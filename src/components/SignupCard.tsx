import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from './Button';
import { Card } from './Card';
import { TextField } from './TextField';

export interface SignupCardProps {
  /** Called with the email when a valid form is submitted. */
  onSubscribe?: (email: string) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A realistic newsletter sign-up form that composes Card + TextField + Button.
 *
 * Demonstrates a full interaction flow worth testing:
 *  - typing into a field,
 *  - client-side validation with an accessible error message,
 *  - a submit that surfaces a success state via an aria-live region.
 */
export function SignupCard({ onSubscribe }: SignupCardProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [subscribed, setSubscribed] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(undefined);
    setSubscribed(true);
    onSubscribe?.(email);
  }

  return (
    <Card
      title="Stay in the loop"
      description="Get product updates and testing tips. No spam, unsubscribe anytime."
    >
      {subscribed ? (
        <p role="status" className="ws-card__description">
          🎉 Thanks! We&apos;ve sent a confirmation to <strong>{email}</strong>.
        </p>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="ws-card__body">
            <TextField
              label="Email address"
              type="email"
              name="email"
              value={email}
              onChange={(v) => setEmail(v)}
              placeholder="you@example.com"
              error={error}
              required
            />
            <Button type="submit" variant="primary">
              Subscribe
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
