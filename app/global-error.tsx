'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Critical Error</h1>
              <p className="text-muted-foreground">
                A critical error occurred. The application needs to restart.
              </p>
              {error.message && (
                <p className="text-sm text-muted-foreground/60 font-mono break-words">
                  {error.message}
                </p>
              )}
            </div>

            <button
              onClick={() => reset()}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Restart Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
