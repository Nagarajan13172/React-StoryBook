import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { TextField } from './TextField';

const meta = {
  title: 'Components/TextField',
  component: TextField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { label: 'Email address', onChange: fn() },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

/* State stories */

export const Default: Story = {
  args: { placeholder: 'you@example.com', type: 'email' },
};

export const WithHelpText: Story = {
  args: { helpText: "We'll only use this to send product updates." },
};

export const Required: Story = {
  args: { required: true },
};

export const WithError: Story = {
  args: { value: 'not-an-email', error: 'Please enter a valid email address.' },
};

export const Disabled: Story = {
  args: { value: 'you@example.com', disabled: true },
};

/* Interaction test — typing into the field fires onChange and updates the value. */
export const TypingFiresOnChange: Story = {
  args: { type: 'email', placeholder: 'you@example.com' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // getByLabelText proves the <label> is correctly associated with the input.
    const input = canvas.getByLabelText(/email address/i);

    await userEvent.type(input, 'user@example.com');

    await expect(input).toHaveValue('user@example.com');
    await expect(args.onChange).toHaveBeenCalled();
  },
};
