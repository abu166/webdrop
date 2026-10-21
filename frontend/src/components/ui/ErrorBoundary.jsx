import React from "react";
export default class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main className="error-screen">
        <h1>Something interrupted this session.</h1>
        <p>{this.state.error.message}</p>
        <button className="primary-button" onClick={() => location.reload()}>
          Start again
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
