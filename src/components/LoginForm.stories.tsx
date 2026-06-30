import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { expect, fn, userEvent, within } from 'storybook/test';
import { LoginForm } from './LoginForm';

const meta = {
  title: 'Components/LoginForm',
  component: LoginForm,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { onSubmit: fn() },
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: { backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};

/** A valid email + password calls onSubmit with the credentials. */
export const ValidSubmit: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/email address/i), 'demo@example.com');
    await userEvent.type(canvas.getByLabelText(/password/i), 'password123');
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }));
    await expect(args.onSubmit).toHaveBeenCalledWith({
      email: 'demo@example.com',
      password: 'password123',
    });
  },
};

/** An invalid email surfaces an accessible error and never calls onSubmit. */
export const InvalidSubmit: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText(/email address/i), 'not-an-email');
    await userEvent.type(canvas.getByLabelText(/password/i), 'password123');
    await userEvent.click(canvas.getByRole('button', { name: /sign in/i }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(/valid email/i);
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};
