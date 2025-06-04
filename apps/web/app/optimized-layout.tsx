'use client';

import '../globals.css';
import { Suspense } from 'react';
import OptimizedProviders from './components/OptimizedProviders';
import LoadingState from './components/LoadingState';
import ErrorBoundary from './components/ErrorBoundary';

/**
 * Optimized layout component that uses our enhanced providers
 * and wraps children in Suspense and ErrorBoundary
 */
export default function OptimizedRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <OptimizedProviders>
          <ErrorBoundary>
            <Suspense fallback={<LoadingState message="Loading application..." fullScreen />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </OptimizedProviders>
      </body>
    </html>
  );
}
