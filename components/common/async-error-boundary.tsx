import { useState, useEffect, ReactNode } from 'react';
import { ErrorFallback } from './error-fallback';

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

export function AsyncErrorBoundary({ children, fallback }: AsyncErrorBoundaryProps) {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setError(new Error(event.reason));
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const retry = () => {
    setError(null);
  };

  if (error) {
    if (fallback) {
      return fallback(error, retry);
    }
    
    return <ErrorFallback error={error} resetError={retry} />;
  }

  return <>{children}</>;
}