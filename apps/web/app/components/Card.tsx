'use client';

import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  headerActions?: ReactNode;
  isLoading?: boolean;
  variant?: 'default' | 'outlined' | 'elevated';
  onClick?: () => void;
}


const Card: React.FC<CardProps> = ({
  title,
  children,
  className = '',
  headerActions,
  isLoading = false,
  variant = 'default',
  onClick,
}) => {
  
  const getCardStyles = () => {
    switch (variant) {
      case 'outlined':
        return 'border border-gray-200 dark:border-gray-700';
      case 'elevated':
        return 'shadow-lg';
      default:
        return 'shadow-sm';
    }
  };

  return (
    <ErrorBoundary>
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg overflow-hidden ${getCardStyles()} ${
          onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
        } ${className}`}
        onClick={onClick}
      >
        {title && (
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-medium text-gray-800 dark:text-gray-200">{title}</h3>
            {headerActions && <div>{headerActions}</div>}
          </div>
        )}
        <div className={`p-4 ${isLoading ? 'opacity-50' : ''}`}>
          {isLoading ? (
            <div className="flex justify-center items-center min-h-[100px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};


export default React.memo(Card);
