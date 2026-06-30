import type { Meta, StoryObj } from '@storybook/react-vite';
import { INITIAL_VIEWPORTS } from 'storybook/viewport';
import { Login } from './Login';
import { withProviders } from '../test/decorators';

const meta = {
  title: 'Pages/Login',
  component: Login,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  // Login uses useAuth() + useNavigate(), so it needs both providers.
  decorators: [withProviders],
} satisfies Meta<typeof Login>;

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
