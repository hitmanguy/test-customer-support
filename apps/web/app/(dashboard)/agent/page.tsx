'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Button,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Timer as TimeIcon,
  CheckCircle as ResolvedIcon,
  PriorityHigh as UrgentIcon,
  SmartToy as AIIcon,
  Speed as SpeedIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import ServiceHealth from '@web/app/components/agent/ServiceHealth';


const statusConfig = {
  open: {
    color: '#10B981',
    icon: <TimeIcon />,
    label: 'Open',
    description: 'Awaiting response'
  },
  in_progress: {
    color: '#F59E0B',
    icon: <TimeIcon />,
    label: 'In Progress',
    description: 'Being processed'
  },
  closed: {
    color: '#6B7280',
    icon: <ResolvedIcon />,
    label: 'Resolved',
    description: 'Issue resolved'
  },
};

const sortOptions = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'priority_rate', label: 'Priority' },
];

const StatCard = ({ title, value, icon, trend, loading = false }: any) => (
  <Card
    elevation={0}
    sx={{
      height: '100%',
      border: '1px solid',
      borderColor: 'divider',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
    }}
  >
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
        <Typography color="text.secondary" variant="subtitle2">
          {title}
        </Typography>
        {icon}
      </Box>
      
      {loading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '40px' }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <>
          <Typography variant="h4" sx={{ mb: 1, fontWeight: 600 }}>
            {value}
          </Typography>
          {trend !== undefined && (
            <Typography
              variant="body2"
              sx={{
                color: trend > 0 ? '#10B981' : trend < 0 ? '#EF4444' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {trend > 0 ? '↑' : trend < 0 ? '↓' : ''}
              {trend !== 0 ? `${Math.abs(trend)}% from last week` : 'No change'}
            </Typography>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

export default function AgentDashboardPage() {
  const [filters, setFilters] = useState({
    status: '',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
  });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const router = useRouter();
  const { user } = useAuthStore();

  // Initialize statistics with empty values
  const [statsData, setStatsData] = useState({
    openTickets: 0,
    resolvedToday: 0,
    avgResponseTime: 0,
    customerSatisfaction: 0,
    openTicketsTrend: 0,
    resolvedTodayTrend: 0,
    avgResponseTimeTrend: 0,
    customerSatisfactionTrend: 0,
  });
  
  const { data: agentStats, isLoading: statsLoading } = trpc.agent.getAgentStats.useQuery(
    {
      agentId: user?.id as string
    },
    {
      enabled: !!user?.id, // Only run query when user.id exists
      refetchInterval: 60000, // Refetch every minute
    }
  );

  // Update statistics in real-time with actual API data
  useEffect(() => {
    if (agentStats?.success) {
      setStatsData({
        openTickets: agentStats.openTickets,
        resolvedToday: agentStats.resolvedToday,
        avgResponseTime: agentStats.avgResponseTime,
        customerSatisfaction: agentStats.customerSatisfaction,
        openTicketsTrend: agentStats.openTicketsTrend,
        resolvedTodayTrend: agentStats.resolvedTodayTrend,
        avgResponseTimeTrend: agentStats.avgResponseTimeTrend,
        customerSatisfactionTrend: agentStats.customerSatisfactionTrend,
      });
    }
  }, [agentStats]);
  
  // Fetch tickets assigned to the agent
  const {
    data: ticketData,
    isLoading: ticketsLoading,
    refetch: refetchTickets
  } = trpc.agent.getAgentTickets.useQuery(
    {
      agentId: user?.id as string,
      status: filters.status as 'open' | 'in_progress' | 'closed' | undefined,
      search: filters.search,
      page: filters.page,
      limit: 10,
      sortBy: filters.sortBy as 'createdAt' | 'updatedAt' | 'priority_rate',
      sortOrder: filters.sortOrder as 'asc' | 'desc',
    },
    {
      enabled: !!user?.id,
    }
  );

  const handleStatusFilter = (status: string) => {
    const newFilters = { ...filters, status, page: 1 };
    setFilters(newFilters);
    setAnchorEl(null);
  };
  const handleSort = (sortBy: string) => {
    const newSortOrder = sortBy === filters.sortBy && filters.sortOrder === 'desc' ? 'asc' : 'desc';
    const newFilters = { ...filters, sortBy, sortOrder: newSortOrder, page: 1 };
    setFilters(newFilters);
    setSortAnchorEl(null);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const search = e.target.value;
    const newFilters = { ...filters, search, page: 1 };
    setFilters(newFilters);
  };

  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    const newFilters = { ...filters, page: value };
    setFilters(newFilters);
  };

  const handleTicketClick = (ticketId: string) => {
    router.push(`/agent/tickets/${ticketId}`);
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  };

  return (
    <Box>
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Agent Dashboard
        </Typography>
        <Typography color="text.secondary">
          Welcome back, {user?.name || 'Agent'}. Here's an overview of your support activities.
        </Typography>
      </Box>      {/* Statistics Section */}      <Grid container spacing={3} sx={{ mb: 6 }}>
        <Grid size = {{xs:12,sm:6,md:3}}>
          <StatCard
            title="Open Tickets"
            value={statsLoading ? '...' : statsData?.openTickets || 0}
            trend={statsData?.openTicketsTrend}
            loading={statsLoading}
            icon={<TimeIcon sx={{ color: '#10B981', fontSize: 28 }} />}
          />
        </Grid>
        <Grid size = {{xs:12,sm:6,md:3}}>
          <StatCard
            title="Resolved Today"
            value={statsLoading ? '...' : statsData?.resolvedToday || 0}
            trend={statsData?.resolvedTodayTrend}
            loading={statsLoading}
            icon={<ResolvedIcon sx={{ color: '#7C3AED', fontSize: 28 }} />}
          />
        </Grid>
        <Grid size = {{xs:12,sm:6,md:3}}>
          <StatCard
            title="Avg Response Time"
            value={statsLoading ? '...' : formatTime(statsData?.avgResponseTime || 0)}
            trend={statsData?.avgResponseTimeTrend}
            loading={statsLoading}
            icon={<SpeedIcon sx={{ color: '#F59E0B', fontSize: 28 }} />}
          />
        </Grid>
        <Grid size = {{xs:12,sm:6,md:3}}>
          <StatCard
            title="Customer Satisfaction"
            value={statsLoading ? '...' : `${statsData?.customerSatisfaction || 0}%`}
            trend={statsData?.customerSatisfactionTrend}
            loading={statsLoading}
            icon={<StarIcon sx={{ color: '#EF4444', fontSize: 28 }} />}
          />      </Grid>
      </Grid>      {/* Service Health Section - Simplified */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
            AI Service Status
            <ServiceHealth showDetails={false} />
          </Typography>
        </Box>
      </Box>

      {/* Active Tickets Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Active Tickets
        </Typography>
      </Box>

      {/* Tickets List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Filter and Search Section */}
        <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <TextField
            placeholder="Search tickets..."
            variant="outlined"
            size="small"
            value={filters.search}
            onChange={handleSearch}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            size="small"
          >
            {filters.status ? statusConfig[filters.status as keyof typeof statusConfig].label : 'All Status'}
          </Button>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={() => handleStatusFilter('')}>All Status</MenuItem>
            <MenuItem onClick={() => handleStatusFilter('open')}>Open</MenuItem>
            <MenuItem onClick={() => handleStatusFilter('in_progress')}>In Progress</MenuItem>
            <MenuItem onClick={() => handleStatusFilter('closed')}>Resolved</MenuItem>
          </Menu>          <Button
            variant="outlined"
            startIcon={<SortIcon />}
            onClick={(e) => setSortAnchorEl(e.currentTarget)}
            size="small"
          >
            Sort By
          </Button>
          <Menu
            anchorEl={sortAnchorEl}
            open={Boolean(sortAnchorEl)}
            onClose={() => setSortAnchorEl(null)}
          >            {sortOptions.map((option) => (
              <MenuItem
                key={option.value}
                onClick={() => handleSort(option.value)}
                selected={filters.sortBy === option.value}
              >
                {option.label}
              </MenuItem>
            ))}
          </Menu>
        </Box>

        {/* Tickets List */}
        {ticketsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : ticketData?.tickets && ticketData.tickets.length > 0 ? (
          <>
            <Box sx={{ mb: 4 }}>
              <AnimatePresence>
                {ticketData.tickets.map((ticket: any, index: number) => (
                  <motion.div
                    key={ticket._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        mb: 2,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: 'primary.main',
                          transform: 'translateY(-2px)',
                          boxShadow: 1,
                        },
                      }}
                      onClick={() => handleTicketClick(ticket._id)}
                    >                      <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {ticket.aiTicket && ticket.aiTicket.priority_rate > 0.7 && (
                              <UrgentIcon
                                sx={{ color: '#EF4444', mr: 1, fontSize: 20 }}
                              />
                            )}
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                                {ticket.title}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {ticket.content}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Chip
                              size="small"
                              label={statusConfig[ticket.status as keyof typeof statusConfig].label}
                              sx={{
                                bgcolor: `${statusConfig[ticket.status as keyof typeof statusConfig].color}20`,
                                color: statusConfig[ticket.status as keyof typeof statusConfig].color,
                                fontWeight: 500,
                              }}
                            />
                          </Box>
                        </Grid>                        <Grid size={{ xs: 6, sm: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {typeof ticket.customerId === 'object' && ticket.customerId && (
                              <Typography variant="body2">
                                {ticket.customerId.name}
                              </Typography>
                            )}
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 6, sm: 2 }}>
                          <Typography variant="caption" color="text.secondary" align="right" sx={{ display: 'block' }}>
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </Typography>
                          {ticket.aiTicket && (
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 0.5 }}>
                              <AIIcon sx={{ fontSize: 14, mr: 0.5, color: 'primary.main' }} />
                              <Typography variant="caption" color="primary">
                                AI Assisted
                              </Typography>
                            </Box>
                          )}
                        </Grid>
                      </Grid>
                    </Paper>
                  </motion.div>
                ))}
              </AnimatePresence>
            </Box>
            {/* Pagination */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={ticketData.pagination.pages}
                page={filters.page}
                onChange={handlePageChange}
                color="primary"
              />
            </Box>
          </>
        ) : (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6">No tickets found</Typography>
            <Typography variant="body2" color="text.secondary">
              {filters.search || filters.status
                ? 'Try changing your filters'
                : 'You have no active tickets at the moment'}
            </Typography>
          </Paper>
        )}      </motion.div>
    </Box>
  );
}
