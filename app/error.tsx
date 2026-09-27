'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isStorageError = error.message?.includes('storage') ||
    error.message?.includes('JSON') ||
    error.message?.includes('parse');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Oops!</h1>
          <p className="text-muted-foreground">
            {isStorageError
              ? 'Something went wrong with your stored data.'
              : 'Something went wrong. Please try again.'}
          </p>
          {error.message && (
            <p className="text-sm text-muted-foreground/60 font-mono break-words">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {isStorageError && (
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                  reset();
                } catch (e) {
                  console.error('Failed to clear storage:', e);
                  reset();
                }
              }}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium hover:bg-destructive/90 transition-colors"
            >
              Reset Local Data
            </button>
          )}

          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>

          <Link
            href="/"
            className="px-4 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
