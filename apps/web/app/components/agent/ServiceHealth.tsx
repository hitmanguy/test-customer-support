import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  CircularProgress,
  Tooltip
} from '@mui/material';
import { trpc } from '@web/app/trpc/client';

interface ServiceHealthProps {
  showDetails?: boolean;
}

const ServiceHealth: React.FC<ServiceHealthProps> = ({ showDetails = false }) => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  // Use the trpc hook to call the health check endpoint
  const healthCheck = trpc.agent.checkPythonServiceHealth.useQuery(
    undefined,
    {
      refetchInterval: 60000, // Check every minute
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
    }
  );

  // Update lastChecked whenever we get new data
  useEffect(() => {
    if (healthCheck.dataUpdatedAt) {
      setLastChecked(new Date(healthCheck.dataUpdatedAt));
    }
  }, [healthCheck.dataUpdatedAt]);

  // Format the last checked time
  const getLastCheckedText = () => {
    if (!lastChecked) return 'Never checked';
    
    const now = new Date();
    const diffMs = now.getTime() - lastChecked.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour} hours ago`;
  };

  if (healthCheck.isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <CircularProgress size={16} sx={{ mr: 1 }} />
        <Typography variant="body2">Checking service health...</Typography>
      </Box>
    );
  }

  const isHealthy = healthCheck.data?.status === 'healthy';

  return (
    <Paper sx={{ p: showDetails ? 2 : 1, mb: showDetails ? 2 : 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip title={isHealthy ? "AI Service is online and healthy" : "AI Service is offline"}>
            <Box
              component="span"
              sx={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: isHealthy ? '#4caf50' : '#f44336',
                display: 'inline-block',
                mr: 1,
                border: '1px solid',
                borderColor: isHealthy ? '#2e7d32' : '#d32f2f',
                boxShadow: `0 0 8px ${isHealthy ? 'rgba(76, 175, 80, 0.6)' : 'rgba(244, 67, 54, 0.6)'}`
              }}
            />
          </Tooltip>
          
          <Typography variant={showDetails ? "subtitle2" : "body2"} sx={{ fontWeight: showDetails ? 600 : 'normal' }}>
            {isHealthy ? "AI Service Online" : "AI Service Offline"}
          </Typography>
        </Box>
        
        {showDetails && (
          <Typography variant="caption" color="text.secondary">
            Last checked: {getLastCheckedText()}
          </Typography>
        )}
      </Box>
      
      {showDetails && healthCheck.data?.responseTimeMs && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
            <strong>Response Time:</strong>&nbsp;{healthCheck.data.responseTimeMs}ms
            {healthCheck.data.performance && (
              <Tooltip title={`Performance rating: ${healthCheck.data.performance}`}>
                <Box
                  component="span"
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    display: 'inline-block',
                    ml: 1,
                    bgcolor: 
                      healthCheck.data.performance === 'excellent' ? '#4caf50' :
                      healthCheck.data.performance === 'good' ? '#8bc34a' :
                      healthCheck.data.performance === 'fair' ? '#ff9800' :
                      '#f44336'
                  }}
                />
              </Tooltip>
            )}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default ServiceHealth;
