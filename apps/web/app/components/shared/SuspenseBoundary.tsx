'use client';

import { Suspense } from 'react';
import { LoadingAnimation } from './LoadingAnimation';

interface SuspenseBoundaryProps {
  children: React.ReactNode;
  fullScreen?: boolean;
  message?: string;
}

export const SuspenseBoundary = ({
  children,
  fullScreen = false,
  message
}: SuspenseBoundaryProps) => {
  return (
    <Suspense fallback={<LoadingAnimation fullScreen={fullScreen} message={message} />}>
      {children}
    </Suspense>
  );
};