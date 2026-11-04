import { Component } from 'react';
import { ErrorState } from './StateView';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page-loader">
        <ErrorState message="An unexpected error occurred." onRetry={() => window.location.reload()} />
      </div>
    );
  }
}
