import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';

import { Users } from './Users';

// `Users` is a container that fetches GET /api/users. In the workshop we stub
// `fetch` via a decorator so the story renders realistic data without a backend.
// The same endpoint is mocked with MSW in the unit test (see Users.test.tsx),
// which is the canonical, assertion-backed coverage for this container.
const mockUsers = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com' },
];

const realFetch = globalThis.fetch;

// Stubs `fetch` for the duration of the story and RESTORES it on unmount, so the
// stub never leaks into other stories/tests sharing the same browser worker.
function StubbedFetch({ children }: { children: React.ReactNode }) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(mockUsers), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;
  useEffect(() => () => {
    globalThis.fetch = realFetch;
  }, []);
  return <>{children}</>;
}

const meta = {
  title: 'Components/Users',
  component: Users,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <StubbedFetch>
        <Story />
      </StubbedFetch>
    ),
  ],
} satisfies Meta<typeof Users>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: {
    backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } },
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};
