import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { trpc } from '@web/app/trpc/client';

interface ServicePerformanceProps {
  height?: number | string;
}

const timeRanges = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 360, label: '6h' },
  { value: 720, label: '12h' },
  { value: 1440, label: '24h' },
];

const ServicePerformance: React.FC<ServicePerformanceProps> = ({ height = 300 }) => {
  const [timeRange, setTimeRange] = useState<number>(60);
  
  const performanceQuery = trpc.agent.getPythonServicePerformance.useQuery(
    { minutes: timeRange },
    {
      refetchInterval: 60000, 
      refetchOnWindowFocus: false,
    }
  );
  
  const handleTimeRangeChange = (_event: React.MouseEvent<HTMLElement>, newTimeRange: number | null) => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
    }
  };
  
  const handleRefresh = () => {
    performanceQuery.refetch();
  };
  
  
  const getResponseTimeElement = (time: number) => {
    let color = 'success.main';
    if (time > 1000) color = 'error.main';
    else if (time > 500) color = 'warning.main';
    
    return (
      <Typography component="span" sx={{ color }}>
        {time}ms
      </Typography>
    );
  };

  if (performanceQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <CircularProgress size={24} />
        <Typography variant="body2" sx={{ ml: 2 }}>Loading performance data...</Typography>
      </Box>
    );
  }

  const data = performanceQuery.data;
  const uptime = data?.stats.uptimePercentage || 0;
  const avgResponseTime = data?.stats.avgResponseTimeMs || 0;
  
  return (
    <Paper 
      sx={{ 
        p: 2,
        height,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SpeedIcon />
          Service Performance
        </Typography>
        <Button 
          size="small" 
          startIcon={<RefreshIcon />} 
          onClick={handleRefresh}
          disabled={performanceQuery.isRefetching}
        >
          Refresh
        </Button>
      </Box>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          value={timeRange}
          exclusive
          onChange={handleTimeRangeChange}
          size="small"
          aria-label="Time range"
        >
          {timeRanges.map(range => (
            <ToggleButton key={range.value} value={range.value} aria-label={range.label}>
              {range.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ScheduleIcon fontSize="inherit" />
          Last updated: {new Date(performanceQuery.dataUpdatedAt || Date.now()).toLocaleTimeString()}
        </Typography>
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 2, 
        mb: 2,
        p: 2,
        bgcolor: 'background.default',
        borderRadius: 1
      }}>
        <Box>
          <Typography variant="body2" color="text.secondary">Uptime</Typography>
          <Typography variant="h4" sx={{ fontWeight: 500, color: uptime >= 99 ? 'success.main' : uptime >= 90 ? 'warning.main' : 'error.main' }}>
            {uptime}%
          </Typography>
        </Box>
        
        <Box>
          <Typography variant="body2" color="text.secondary">Avg Response Time</Typography>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>
            {getResponseTimeElement(avgResponseTime)}
          </Typography>
        </Box>
        
        <Box>
          <Typography variant="body2" color="text.secondary">Health Checks</Typography>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>
            {data?.stats.total || 0}
          </Typography>
        </Box>
        
        <Box>
          <Typography variant="body2" color="text.secondary">Failures</Typography>
          <Typography variant="h4" sx={{ fontWeight: 500, color: data?.stats.unhealthy === 0 ? 'success.main' : 'error.main' }}>
            {data?.stats.unhealthy || 0}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Typography variant="subtitle2" gutterBottom>
          Recent Health Checks
        </Typography>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 1
        }}>
          {data?.metrics.slice().reverse().slice(0, 10).map((metric, index) => (
            <Box 
              key={index} 
              sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                p: 1,
                bgcolor: metric.status === 'healthy' ? 'success.light' : 'error.light',
                borderRadius: 1,
                opacity: 0.9,
              }}
            >
              <Typography variant="caption">
                {new Date(metric.timestamp).toLocaleTimeString()}
              </Typography>
              <Typography variant="caption">
                {metric.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
              </Typography>
              <Typography variant="caption">
                {metric.responseTimeMs}ms
              </Typography>
            </Box>
          ))}
          
          {(!data?.metrics || data.metrics.length === 0) && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No health check data available for the selected time range
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
};

export default ServicePerformance;
