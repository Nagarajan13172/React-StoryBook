import type { Meta, StoryObj } from '@storybook/react-vite';
// In Storybook 9 the test utilities live in `storybook/test`
// (previously the separate `@storybook/test` package).
import { expect, fn, userEvent, within } from 'storybook/test';

import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  // Center the component in the Canvas for a clean workshop view.
  parameters: { layout: 'centered' },
  // Generate an Autodocs page from the component's props + these stories.
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary'] },
    size: { control: 'inline-radio', options: ['small', 'medium', 'large'] },
  },
  // `fn()` creates a spy so the interaction tests below can assert that the
  // click handler fired, and so clicks show up in the Storybook Actions panel.
  args: { onClick: fn(), children: 'Button' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ---------------------------------------------------------------- *
 * State stories — visual variations rendered in the workshop.
 * Each is also run as a test by the Vitest addon and a11y-checked.
 * ---------------------------------------------------------------- */

export const Primary: Story = {
  args: { variant: 'primary', children: 'Add to cart' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Cancel' },
};

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true, children: 'Unavailable' },
};

export const Loading: Story = {
  args: { variant: 'primary', loading: true, children: 'Saving…' },
};

/* ---------------------------------------------------------------- *
 * Interaction tests — `play` functions that drive the component the
 * way a user would and assert on the outcome. These run headlessly in
 * real Chromium via the Vitest addon (`npm run test:stories`).
 * ---------------------------------------------------------------- */

/** Clicking an enabled button fires its onClick exactly once. */
export const ClicksFireOnClick: Story = {
  args: { variant: 'primary', children: 'Add to cart' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /add to cart/i });

    await expect(button).toBeEnabled();
    await userEvent.click(button);

    // The real assertion: the handler was invoked once by the click.
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

/** A loading button is inert: it is busy, disabled, and never fires onClick. */
export const LoadingIsInert: Story = {
  args: { variant: 'primary', loading: true, children: 'Saving…' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button', { name: /saving/i });

    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');

    // Force the click past the pointer-events guard to prove the disabled
    // button still does not invoke its handler.
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};
