import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { expect, within } from 'storybook/test';
import { Comment } from './Comment';

const meta = {
  title: 'Components/Comment',
  component: Comment,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  args: { author: 'Jordan', body: 'Great write-up — thanks for sharing!' },
} satisfies Meta<typeof Comment>;

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

/** An XSS payload renders as inert, escaped text — no script/element is injected. */
export const XssPayloadIsEscaped: Story = {
  args: {
    author: 'mallory',
    body: '<img src=x onerror="alert(1)"> <script>alert(2)</script>',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The payload appears verbatim as text…
    await expect(canvas.getByText(/onerror/)).toBeInTheDocument();
    // …and was NOT parsed into live DOM nodes.
    await expect(canvasElement.querySelector('script')).toBeNull();
    await expect(canvasElement.querySelector('img')).toBeNull();
  },
};
