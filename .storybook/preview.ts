import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo'  - show a11y violations in the test UI only (does not fail tests)
      // 'error' - fail the test run (and CI) on a11y violations
      // 'off'   - skip a11y checks entirely
      // We enforce a11y so `test:stories` genuinely verifies every story is accessible.
      test: 'error'
    }
  },
};

export default preview;