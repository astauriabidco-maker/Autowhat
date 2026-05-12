import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WhatsPoint render error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <section
          style={{
            width: 'min(100%, 520px)',
            padding: '28px',
            border: '1px solid #dbe4f0',
            borderRadius: '12px',
            background: '#ffffff',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
          }}
        >
          <p style={{ margin: '0 0 8px', color: '#2563eb', fontWeight: 700 }}>
            WhatsPoint
          </p>
          <h1 style={{ margin: '0 0 12px', fontSize: '28px', lineHeight: 1.15 }}>
            La page n'a pas pu se charger.
          </h1>
          <p style={{ margin: '0 0 22px', color: '#475569', lineHeight: 1.6 }}>
            Une ancienne version ou un cache navigateur peut encore bloquer l'application.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: '8px',
              padding: '12px 16px',
              background: '#2563eb',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Recharger
          </button>
        </section>
      </main>
    );
  }
}
