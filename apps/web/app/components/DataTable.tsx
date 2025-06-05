'use client';

import React, { useMemo } from 'react';
import ErrorBoundary from './ErrorBoundary';
import LoadingState from './LoadingState';

interface DataTableProps<T> {
  data: T[];
  columns: {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
  }[];
  keyExtractor: (item: T) => string | number;
  emptyMessage?: string;
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
}


function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = 'No data available',
  isLoading = false,
  onRowClick,
}: DataTableProps<T>) {
  
  if (isLoading) {
    return <LoadingState message="Loading data..." />;
  }

  
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  
  const getCellValue = (item: T, accessor: keyof T | ((item: T) => React.ReactNode)): React.ReactNode => {
    if (typeof accessor === 'function') {
      return accessor(item);
    }
    const value = item[accessor];
    if (value === null || value === undefined) return '';
    
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return value.toString();
    }
    return value as React.ReactNode;
  };

  return (
    <ErrorBoundary>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item) => (
              <tr 
                key={keyExtractor(item)}
                className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((column, index) => (
                  <td
                    key={index}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 ${column.className || ''}`}
                  >
                    {getCellValue(item, column.accessor)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ErrorBoundary>
  );
}


export default React.memo(DataTable) as typeof DataTable;
