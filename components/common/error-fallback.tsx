import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
  showRetry?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
}

export function ErrorFallback({
  error,
  resetError,
  title = "Something went wrong",
  description = "We encountered an unexpected error. Please try again.",
  showRetry = true,
  showBackButton = false,
  onBack,
}: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-4">
      <div className="text-center max-w-md">
        <div className="bg-red-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        
        <p className="text-gray-600 mb-6 text-sm">
          {description}
        </p>

        {process.env.NODE_ENV === 'development' && error && (
          <div className="bg-gray-100 p-3 rounded text-left mb-4">
            <p className="text-xs font-medium text-gray-800 mb-1">Debug Info:</p>
            <p className="text-xs text-gray-600 font-mono break-all">
              {error.message}
            </p>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {showBackButton && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Go Back
            </Button>
          )}
          
          {showRetry && resetError && (
            <Button size="sm" onClick={resetError}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}