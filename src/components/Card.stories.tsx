import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from './Button';
import { Card } from './Card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Stay in the loop',
    description: 'Get product updates and testing tips. No spam, unsubscribe anytime.',
  },
};

export const WithBody: Story = {
  args: {
    title: 'Release notes',
    description: 'What shipped this week.',
    children: <p style={{ margin: 0 }}>Storybook 10 now supports Vite 8 browser-mode testing.</p>,
  },
};

export const WithFooterActions: Story = {
  args: {
    title: 'Delete project?',
    description: 'This action cannot be undone.',
    footer: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button variant="primary">Confirm</Button>
      </>
    ),
  },
};
