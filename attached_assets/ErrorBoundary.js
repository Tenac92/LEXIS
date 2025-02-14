import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', 
        { className: 'min-h-screen flex items-center justify-center bg-gray-50' },
        React.createElement('div', 
          { className: 'text-center p-8 bg-white rounded-lg shadow-md' },
          [
            React.createElement('h2', 
              { className: 'text-2xl font-bold text-red-600 mb-4', key: 'title' }, 
              'Something went wrong'
            ),
            React.createElement('p', 
              { className: 'text-gray-600 mb-4', key: 'message' }, 
              this.state.error?.message
            ),
            React.createElement('button',
              { 
                onClick: () => window.location.reload(),
                className: 'bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600',
                key: 'button'
              },
              'Reload Page'
            )
          ]
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;