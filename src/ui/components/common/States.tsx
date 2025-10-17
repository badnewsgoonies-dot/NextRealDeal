import React from 'react';

export function Loading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-text-secondary">{message}</div>
    </div>
  );
}

export function Empty({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="text-4xl mb-2">📭</div>
        <div className="text-text-secondary">{message}</div>
      </div>
    </div>
  );
}

export function Error({ message = 'Something went wrong', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="text-4xl mb-2">❌</div>
        <div className="text-danger mb-4">{message}</div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}