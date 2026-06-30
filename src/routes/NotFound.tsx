import { Link } from 'react-router-dom';

/** Catch-all 404 page (the router's `path: '*'` route). */
export function NotFound() {
  return (
    <main className="app__main">
      <section className="app__header">
        <h1 className="app__title">404 — Page not found</h1>
        <p className="app__subtitle">
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <p>
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
