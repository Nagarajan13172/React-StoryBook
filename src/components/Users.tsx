import { useUsers } from '../api/useUsers';
import { UserList } from './UserList';

/**
 * Container component: wires the {@link useUsers} data hook to the
 * presentational {@link UserList}. Kept thin on purpose so the fetching logic
 * (hook) and the rendering logic (UserList) can be tested independently, and so
 * this component can be covered end-to-end with an MSW-backed integration test.
 */
export function Users() {
  const { users, loading, error } = useUsers();
  return (
    <section className="ws-users" aria-label="User directory">
      <h2 className="ws-users__title">Users</h2>
      <UserList users={users} loading={loading} error={error} />
    </section>
  );
}
