import { Button } from './components/Button';
import { Card } from './components/Card';
import { SignupCard } from './components/SignupCard';
import './App.css';

/**
 * Demo "website" for the component-testing workshop.
 * Everything you see here is built from the same components that are
 * developed and tested in Storybook (`npm run storybook` / `npm run test:stories`).
 */
function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Component Testing Workshop</h1>
        <p className="app__subtitle">
          Build components visually in Storybook, then run them as real-browser
          tests with Vitest — all from one reusable setup.
        </p>
      </header>

      <main className="app__main">
        <Card
          title="Button variants"
          description="Accessible buttons with primary/secondary styles, sizes, and states."
        >
          <div className="app__row">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button variant="primary" loading>
              Loading
            </Button>
          </div>
          <div className="app__row">
            <Button size="small">Small</Button>
            <Button size="medium">Medium</Button>
            <Button size="large">Large</Button>
          </div>
        </Card>

        <SignupCard onSubscribe={(email) => console.log('subscribed:', email)} />
      </main>

      <footer className="app__footer">
        <a href="https://storybook.js.org/docs/writing-tests" target="_blank" rel="noreferrer">
          Storybook testing docs ↗
        </a>
      </footer>
    </div>
  );
}

export default App;
