import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useAuth } from '../auth/AuthContext';

/**
 * Protected dashboard. Reachable only through the <ProtectedRoute> guard, so it
 * can assume a signed-in user; it greets them and offers a sign-out.
 */
export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <main className="app__main">
      <Card
        title="Dashboard"
        description="This page is behind the auth guard."
        footer={
          <Button variant="secondary" onClick={logout}>
            Sign out
          </Button>
        }
      >
        <p>
          Welcome back, <strong>{user?.name ?? 'guest'}</strong>.
        </p>
      </Card>
    </main>
  );
}
