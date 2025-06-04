'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Card from './Card';
import DataTable from './DataTable';
import ErrorBoundary from './ErrorBoundary';
import LoadingState from './LoadingState';
import { trpc } from '../trpc/client';

interface PerformanceMetricsProps {
  agentId?: string;
  companyId: string;
  showDetailedView?: boolean;
}

/**
 * A component to display agent or company performance metrics
 * Uses our optimized React patterns with memoization and error boundaries
 */
const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({
  agentId,
  companyId,
  showDetailedView = false
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  
  // Calculate date range based on selected period
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (selectedPeriod) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }
    
    return { startDate, endDate };
  }, [selectedPeriod]);    // Fetch performance data using TRPC
  const { data, isLoading, isError, error, refetch } = trpc.agent.getAgentStats.useQuery({
    agentId: agentId || ''
  }, {
    enabled: !!agentId // Only run query if agentId is provided
  });
  
  // Handle period change
  const handlePeriodChange = useCallback((period: 'day' | 'week' | 'month') => {
    setSelectedPeriod(period);
  }, []);
    // Format data for metrics display
  const formattedMetrics = useMemo(() => {
    if (!data) return [];
    
    return [
      { 
        label: 'Average Response Time', 
        value: data.avgResponseTime ? `${data.avgResponseTime.toFixed(1)} mins` : 'N/A' 
      },
      { 
        label: 'Customer Satisfaction', 
        value: data.customerSatisfaction ? `${(data.customerSatisfaction * 100).toFixed(1)}%` : 'N/A' 
      },
      { 
        label: 'Open Tickets', 
        value: data.openTickets?.toString() || '0' 
      },
      { 
        label: 'Resolved Today', 
        value: data.resolvedToday?.toString() || '0' 
      }
    ];
  }, [data]);
    // Format ticket data for the data table (placeholder for now since tickets aren't in the response)
  const ticketData = useMemo(() => {
    // Since the API doesn't return ticket details, we'll show a placeholder
    return [];
  }, [data]);
  
  if (isError) {
    return (
      <div className="p-4 border rounded bg-red-50 text-red-800">
        <p>Error loading performance metrics: {error?.message}</p>
        <button 
          onClick={() => refetch()}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Period selector */}
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => handlePeriodChange('day')}
            className={`px-4 py-2 rounded ${selectedPeriod === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            24 Hours
          </button>
          <button
            onClick={() => handlePeriodChange('week')}
            className={`px-4 py-2 rounded ${selectedPeriod === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            7 Days
          </button>
          <button
            onClick={() => handlePeriodChange('month')}
            className={`px-4 py-2 rounded ${selectedPeriod === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
          >
            30 Days
          </button>
        </div>
        
        {/* Metrics summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {formattedMetrics.map((metric) => (
            <Card key={metric.label} className="bg-white">
              <div className="text-center">
                <h3 className="text-gray-500 text-sm font-medium">{metric.label}</h3>
                <p className="mt-1 text-3xl font-semibold text-gray-900">
                  {isLoading ? <LoadingState size="small" /> : metric.value}
                </p>
              </div>
            </Card>
          ))}
        </div>
        
        {/* Detailed tickets table (only if detailed view is enabled) */}
        {showDetailedView && (
          <Card title="Recent Tickets" isLoading={isLoading}>            <DataTable
              data={ticketData}
              columns={[
                { header: 'Ticket ID', accessor: (item: any) => item.id },
                { header: 'Customer', accessor: (item: any) => item.customerName },
                { header: 'Issue', accessor: (item: any) => item.title },
                { header: 'Status', accessor: (item: any) => (
                  <span className={`px-2 py-1 rounded text-xs ${
                    item.status === 'closed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {item.status}
                  </span>
                )},
                { header: 'Rating', accessor: (item: any) => item.rating },
                { header: 'Handling Time', accessor: (item: any) => item.handlingTime }
              ]}
              keyExtractor={(item: any) => item.id}
              emptyMessage="No tickets available for this time period"
            />
          </Card>
        )}
      </div>
    </ErrorBoundary>
  );
};

// Export memoized version for better performance
export default React.memo(PerformanceMetrics);
