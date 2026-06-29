import { Component, type ErrorInfo, type ReactNode } from 'react';

// Defence-in-depth for the dashboard. `normalizeAnalysis` already fills safe
// defaults so the happy UI renders with partial data, but this boundary catches
// anything the normalizer can't anticipate (wrong element types, a future schema
// rename, a bug in a child) and shows a readable message instead of unmounting
// the whole tree into a blank white page.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the real reason in the console for whoever is running the scan.
    console.error('Dashboard render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="wrap">
          <h1 className="title">Testing Coverage Dashboard</h1>
          <p role="alert" className="error-box">
            Couldn’t render <code>analysis.json</code>: {this.state.error.message}
            <br />
            The file may be from a different scanner version or hand-edited. Re-run{' '}
            <code>npm run dashboard</code> to regenerate it.
          </p>
        </main>
      );
    }
    return this.props.children;
  }
}
