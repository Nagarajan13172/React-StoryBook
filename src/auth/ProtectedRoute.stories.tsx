import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { ProtectedRoute } from './ProtectedRoute';
import { withAuthedProviders } from '../test/decorators';

const LONG =
  'A long block of protected content used to verify the guard renders arbitrary children without constraining their layout across multiple lines of text';

const meta = {
  title: 'Auth/ProtectedRoute',
  component: ProtectedRoute,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  // Pre-authenticated so the guard renders its children (rather than redirecting).
  decorators: [withAuthedProviders],
  args: { children: 'Protected content' },
} satisfies Meta<typeof ProtectedRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No explicit children → the guard renders the nested-route <Outlet/> (empty here). */
export const Empty: Story = { args: { children: undefined } };

export const Dark: Story = {
  globals: { backgrounds: { value: 'dark' } },
  parameters: { backgrounds: { options: { dark: { name: 'Dark', value: '#1a1a1a' } } } },
};

export const Mobile: Story = {
  globals: { viewport: { value: 'iphone6', isRotated: false } },
  parameters: { viewport: { options: INITIAL_VIEWPORTS } },
};

export const Long: Story = { args: { children: LONG } };
