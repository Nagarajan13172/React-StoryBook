import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { LoginForm } from '../components/LoginForm';
import { useAuth } from '../auth/AuthContext';

/**
 * Login page. Wires the presentational <LoginForm> to `useAuth().login`, then
 * sends the user on to wherever the guard bounced them from (or the dashboard).
 */
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  return (
    <main className="app__main">
      <Card title="Sign in" description="Demo: demo@example.com / password123">
        <LoginForm
          onSubmit={async ({ email, password }) => {
            await login(email, password);
            navigate(from, { replace: true });
          }}
        />
      </Card>
    </main>
  );
}
