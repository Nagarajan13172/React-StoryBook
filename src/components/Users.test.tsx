import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';

import { Users } from './Users';
import { server } from '../test/msw/server';

describe('Users (MSW integration)', () => {
  it('shows a loading status, then renders the fetched users', async () => {
    // The default handler in src/test/msw/handlers.ts returns the fixture.
    render(<Users />);

    // The loading status is rendered synchronously on first paint.
    expect(screen.getByRole('status')).toHaveTextContent(/loading users/i);

    // Wait for the loading indicator to disappear once the fetch resolves.
    await waitForElementToBeRemoved(() => screen.queryByRole('status'));

    // The list (and its items) should now be on screen.
    const list = screen.getByRole('list', { name: /users/i });
    expect(list).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders an accessible alert when the request fails', async () => {
    // Override the default handler for this test only; resetHandlers() in
    // afterEach (src/test/setup.ts) restores the success handler afterwards.
    server.use(
      http.get('/api/users', () => {
        return new HttpResponse(null, { status: 500 });
      }),
    );

    render(<Users />);

    // The error live region appears after the failed request resolves.
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/status 500/i);

    // No list is rendered in the error state.
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
