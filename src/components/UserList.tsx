import type { User } from '../api/useUsers';

export interface UserListProps {
  /** Users to display. */
  users: User[];
  /** When true, shows a loading indicator instead of the list. */
  loading?: boolean;
  /** When set, shows an error message instead of the list. */
  error?: string;
}

/**
 * Presentational list of users — no data fetching of its own.
 *
 * Accessibility:
 * - the loading state uses `role="status"` (a polite live region) so screen
 *   readers announce progress;
 * - the error state uses `role="alert"` (an assertive live region) so failures
 *   are announced immediately.
 */
export function UserList({ users, loading = false, error }: UserListProps) {
  if (loading) {
    return (
      <p role="status" className="ws-userlist__status">
        Loading users…
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="ws-userlist__error">
        {error}
      </p>
    );
  }

  if (users.length === 0) {
    return <p className="ws-userlist__empty">No users found.</p>;
  }

  return (
    <ul className="ws-userlist" aria-label="Users">
      {users.map((user) => (
        <li key={user.id} className="ws-userlist__item">
          <span className="ws-userlist__name">{user.name}</span>{' '}
          <span className="ws-userlist__email">{user.email}</span>
        </li>
      ))}
    </ul>
  );
}
