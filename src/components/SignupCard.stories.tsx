import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { SignupCard } from './SignupCard';

const meta = {
  title: 'Components/SignupCard',
  component: SignupCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { onSubscribe: fn() },
} satisfies Meta<typeof SignupCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * Happy path — a full user flow: type a valid email, submit, and assert that
 * the success state appears and the callback fired with the right value.
 */
export const SubmitsValidEmail: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/email address/i), 'ada@example.com');
    await userEvent.click(canvas.getByRole('button', { name: /subscribe/i }));

    // Callback fired with the typed email...
    await expect(args.onSubscribe).toHaveBeenCalledWith('ada@example.com');
    // ...and the success status message is shown.
    await expect(await canvas.findByRole('status')).toHaveTextContent(/thanks/i);
  },
};

/**
 * Validation path — submitting an invalid email shows an accessible error and
 * does NOT call onSubscribe.
 */
export const ShowsValidationError: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(canvas.getByLabelText(/email address/i), 'nope');
    await userEvent.click(canvas.getByRole('button', { name: /subscribe/i }));

    const error = await canvas.findByRole('alert');
    await expect(error).toHaveTextContent(/valid email/i);
    await expect(args.onSubscribe).not.toHaveBeenCalled();
  },
};
