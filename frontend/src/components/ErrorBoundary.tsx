'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          background: 'rgba(239, 68, 68, 0.1)', 
          borderRadius: '12px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          margin: '20px',
          color: 'white',
          backdropFilter: 'blur(20px)'
        }}>
          <h2 style={{ color: '#FCA5A5' }}>Something went wrong.</h2>
          <p style={{ opacity: 0.8, marginBottom: '20px' }}>
            {this.state.error?.message || 'A system error occurred. Please try refreshing or contact support.'}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '10px 20px',
              background: 'var(--purple-main)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
