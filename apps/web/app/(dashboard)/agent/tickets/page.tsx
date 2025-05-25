'use client';

import { useState } from 'react';
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
  MenuItem,
  Menu,
  IconButton,
  Avatar,
  Pagination,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  Timer as TimeIcon,
  CheckCircle as ResolvedIcon,
  PriorityHigh as UrgentIcon,
  SmartToy as AIIcon,
  Person as CustomerIcon,
  AutoAwesome as SuggestIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

const statusConfig = {
  open: {
    color: '#10B981',
    icon: <TimeIcon />,
    label: 'Open',
  },
  in_progress: {
    color: '#F59E0B',
    icon: <TimeIcon />,
    label: 'In Progress',
  },
  closed: {
    color: '#6B7280',
    icon: <ResolvedIcon />,
    label: 'Resolved',
  },
};

const priorityConfig = {
  low: {
    color: '#6B7280',
    label: 'Low',
  },
  medium: {
    color: '#F59E0B',
    label: 'Medium',
  },
  high: {
    color: '#EF4444',
    label: 'High',
  },
};

const sortOptions = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'priority_rate', label: 'Priority' },
];

// Helper functions for priority
const getPriorityLabel = (ticket: any): string => {
  if (ticket.aiTicket && ticket.aiTicket.priority_rate >= 0.7) {
    return priorityConfig.high.label;
  } else if (ticket.aiTicket && ticket.aiTicket.priority_rate >= 0.4) {
    return priorityConfig.medium.label;
  } else {
    return priorityConfig.low.label;
  }
};

const getPriorityColor = (ticket: any): string => {
  if (ticket.aiTicket && ticket.aiTicket.priority_rate >= 0.7) {
    return priorityConfig.high.color;
  } else if (ticket.aiTicket && ticket.aiTicket.priority_rate >= 0.4) {
    return priorityConfig.medium.color;
  } else {
    return priorityConfig.low.color;
  }
};

export default function TicketsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedStatus, setSelectedStatus] = useState<'open' | 'in_progress' | 'closed' | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'priority_rate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [sortAnchor, setSortAnchor] = useState<null | HTMLElement>(null);

  // Fetch tickets assigned to the agent
  const { data: ticketsData, isLoading } = trpc.agent.getAgentTickets.useQuery({
      agentId: user?.id || '',
      status: selectedStatus,
      search: search || undefined,
      page,
      limit: 10,
      sortBy,
      sortOrder,
    })

  // Apply client-side filtering for priority since API doesn't support it directly
  const tickets = ticketsData?.success && ticketsData?.tickets 
    ? ticketsData.tickets.filter(ticket => {
        // Filter by priority if selected
        if (selectedPriority === 'high') {
          return ticket.aiTicket && ticket.aiTicket.priority_rate >= 0.7;
        } else if (selectedPriority === 'medium') {
          return ticket.aiTicket && ticket.aiTicket.priority_rate >= 0.4 && ticket.aiTicket.priority_rate < 0.7;
        } else if (selectedPriority === 'low') {
          return !ticket.aiTicket || ticket.aiTicket.priority_rate < 0.4;
        }
        return true;
      })
    : [];
  const totalPages = ticketsData?.success ? ticketsData?.pagination.pages || 1 : 1;

  const handleStatusSelect = (status: 'open' | 'in_progress' | 'closed' | undefined) => {
    setSelectedStatus(status);
    setPage(1);
    setFilterAnchor(null);
  };

  const handlePrioritySelect = (priority: string | null) => {
    setSelectedPriority(priority);
    setPage(1);
    setFilterAnchor(null); // Close filter menu after selection
  };

  const handleSortSelect = (value: 'createdAt' | 'updatedAt' | 'priority_rate') => {
    if (sortBy === value) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(value);
      setSortOrder('desc');
    }
    setSortAnchor(null);
    setPage(1);
  };

  return (
    <AnimatePresence mode="wait">
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        {/* Header */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Ticket Management
          </Typography>
          <Typography color="text.secondary">
            View and manage customer support tickets
          </Typography>
        </Box>

        {/* Filters Section */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 300px', minWidth: 0 }}>
              <TextField
                fullWidth
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'primary.main' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ flex: '1 1 250px', minWidth: 0 }}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={selectedPriority || ''}
                  label="Priority"
                  onChange={(e) => handlePrioritySelect(e.target.value)}
                >
                  <MenuItem value="">All Priorities</MenuItem>
                  {Object.entries(priorityConfig).map(([value, config]) => (
                    <MenuItem key={value} value={value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            bgcolor: config.color,
                          }}
                        />
                        {config.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: '1 1 300px', display: 'flex', gap: 2 }}>
              <Button
                fullWidth
                startIcon={<FilterIcon />}
                onClick={(e) => setFilterAnchor(e.currentTarget)}
                variant={selectedStatus ? 'contained' : 'outlined'}
                color={selectedStatus ? 'primary' : 'inherit'}
              >
                {selectedStatus ? statusConfig[selectedStatus as keyof typeof statusConfig].label : 'Status Filter'}
              </Button>

              <Button
                fullWidth
                startIcon={<SortIcon />}
                onClick={(e) => setSortAnchor(e.currentTarget)}
                variant="outlined"
              >
                Sort
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Filter Menus */}
        <Menu
          anchorEl={filterAnchor}
          open={Boolean(filterAnchor)}
          onClose={() => setFilterAnchor(null)}
        >
          <MenuItem onClick={() => handleStatusSelect(undefined)}>
            All Statuses
          </MenuItem>
          {Object.entries(statusConfig).map(([status, config]) => (
            <MenuItem
              key={status}
              onClick={() => handleStatusSelect(status as 'open' | 'in_progress' | 'closed')}
              selected={selectedStatus === status}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {config.icon}
                {config.label}
              </Box>
            </MenuItem>
          ))}
        </Menu>

        <Menu
          anchorEl={sortAnchor}
          open={Boolean(sortAnchor)}
          onClose={() => setSortAnchor(null)}
        >
          {sortOptions.map((option) => (
            <MenuItem
              key={option.value}
              onClick={() => handleSortSelect(option.value as 'createdAt' | 'updatedAt' | 'priority_rate')}
              selected={sortBy === option.value}
            >
              {option.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Tickets List */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : tickets.length > 0 ? (
            <Box>
              {tickets.map((ticket: any, index: number) => (
                <Paper
                  key={ticket._id}
                  elevation={0}
                  component={motion.div}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => router.push(`/agent/tickets/${ticket._id}`)}
                  sx={{
                    p: 3,
                    mb: 2,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateX(8px)',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Grid container spacing={2}>
                    <Grid size = {{xs:12,md:8}}>
                      <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
                        <Avatar
                          src={ticket.customer?.image}
                          sx={{
                            bgcolor: 'primary.main',
                            width: 40,
                            height: 40,
                          }}
                        >
                          <CustomerIcon />
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ mb: 1 }}>
                            {ticket.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {ticket.content.slice(0, 120)}...
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              icon={statusConfig[ticket.status as keyof typeof statusConfig].icon}
                              label={statusConfig[ticket.status as keyof typeof statusConfig].label}
                              sx={{
                                bgcolor: `${statusConfig[ticket.status as keyof typeof statusConfig].color}20`,
                                color: statusConfig[ticket.status as keyof typeof statusConfig].color,
                              }}
                            />
                            <Chip
                              size="small"
                              label={getPriorityLabel(ticket)}
                              sx={{
                                bgcolor: `${getPriorityColor(ticket)}20`,
                                color: getPriorityColor(ticket),
                              }}
                            />
                            {ticket.aiSuggestion && (
                              <Chip
                                size="small"
                                icon={<SuggestIcon />}
                                label="AI Suggestion"
                                sx={{ bgcolor: 'primary.main', color: 'white' }}
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </Grid>
                    <Grid size = {{xs:12,md:4}}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', height: '100%', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary">
                          Updated {new Date(ticket.updatedAt).toLocaleDateString()}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                          <Typography variant="body2">
                            Customer: {ticket.customer?.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Company: {ticket.company?.name}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, newPage) => setPage(newPage)}
                    color="primary"
                  />
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                No tickets found
              </Typography>
              <Typography variant="body2">
                {search
                  ? `No tickets matching "${search}"`
                  : selectedStatus
                  ? `No ${statusConfig[selectedStatus as keyof typeof statusConfig].label.toLowerCase()} tickets`
                  : 'No tickets assigned to you'}
              </Typography>
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </AnimatePresence>
  );
}
