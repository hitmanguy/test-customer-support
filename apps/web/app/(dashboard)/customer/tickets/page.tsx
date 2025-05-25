'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Paper,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Pagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  AccessTime as TimeIcon,
  ConfirmationNumber as TicketIcon,
  CheckCircle as SolvedIcon,
  Timer as PendingIcon,
  Add as AddIcon,
  Sort as SortIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { Ticket } from '@web/app/types/types';

const statusConfig = {
  open: { 
    color: '#10B981', 
    icon: <PendingIcon />, 
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
    icon: <SolvedIcon />, 
    label: 'Resolved',
    description: 'Issue resolved'
  },
};

const sortOptions = [
  { value: 'createdAt', label: 'Date Created' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'priority_rate', label: 'Priority' },
];

export default function TicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterAnchor, setFilterAnchor] = useState<null | HTMLElement>(null);
  const [sortAnchor, setSortAnchor] = useState<null | HTMLElement>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'priority_rate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const companyId = searchParams.get('company');

  // Fetch tickets with filters
  const { data: ticketsData, isLoading } = trpc.ticket.getTicketsByQuery.useQuery({
      customerId: user?.id || '',
      companyId: companyId || undefined,
      status: selectedStatus as 'open' | 'in_progress' | 'closed' | undefined,
      page,
      limit: 10,
      sortBy,
      sortOrder,
    })

  const tickets = ticketsData?.tickets || [];
  const totalPages = Math.ceil((ticketsData?.pagination.total || 0) / 10);

  const handleStatusSelect = (status: string | null) => {
    setSelectedStatus(status);
    setFilterAnchor(null);
    setPage(1);
  };

  const handleSortSelect = (sort: string) => {
    if (sortBy === sort) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(sort as 'createdAt' | 'updatedAt' | 'priority_rate');
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
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
              Support Tickets
            </Typography>
            <Typography color="text.secondary">
              {ticketsData?.pagination.total || 0} total tickets
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/customer/tickets/create')}
            sx={{
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              '&:hover': {
                background: 'linear-gradient(45deg, #6D28D9, #059669)',
              },
            }}
          >
            New Ticket
          </Button>
        </Box>

        {/* Filters */}
        <Box sx={{ mb: 4, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'primary.main' }} />
                </InputAdornment>
              ),
            }}
          />

          <Button
            startIcon={<FilterIcon />}
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            variant={selectedStatus ? 'contained' : 'outlined'}
            color={selectedStatus ? 'primary' : 'inherit'}
          >
            {selectedStatus ? statusConfig[selectedStatus as keyof typeof statusConfig].label : 'Filter'}
          </Button>

          <Button
            startIcon={<SortIcon />}
            onClick={(e) => setSortAnchor(e.currentTarget)}
            variant="outlined"
          >
            Sort
          </Button>
        </Box>

        {/* Filter Menu */}
        <Menu
          anchorEl={filterAnchor}
          open={Boolean(filterAnchor)}
          onClose={() => setFilterAnchor(null)}
        >
          <MenuItem onClick={() => handleStatusSelect(null)}>
            <Typography>All Tickets</Typography>
          </MenuItem>
          {Object.entries(statusConfig).map(([status, config]) => (
            <MenuItem
              key={status}
              onClick={() => handleStatusSelect(status)}
              selected={selectedStatus === status}
            >
              {config.icon}
              <Typography sx={{ ml: 1 }}>{config.label}</Typography>
            </MenuItem>
          ))}
        </Menu>

        {/* Sort Menu */}
        <Menu
          anchorEl={sortAnchor}
          open={Boolean(sortAnchor)}
          onClose={() => setSortAnchor(null)}
        >
          {sortOptions.map((option) => (
            <MenuItem
              key={option.value}
              onClick={() => handleSortSelect(option.value)}
              selected={sortBy === option.value}
            >
              <Typography>{option.label}</Typography>
            </MenuItem>
          ))}
        </Menu>

        {/* Tickets List */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : tickets.length > 0 ? (
          <Grid container spacing={2}>
            {tickets.map((ticket, index) => (
              <Grid size = {{xs:12}}key={ticket._id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Paper
                    elevation={0}
                    onClick={() => router.push(`/customer/tickets/${ticket._id}`)}
                    sx={{
                      p: 3,
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6">{ticket.title}</Typography>
                      <Chip
                        icon={statusConfig[ticket.status as keyof typeof statusConfig].icon}
                        label={statusConfig[ticket.status as keyof typeof statusConfig].label}
                        size="small"
                        sx={{
                          bgcolor: `${statusConfig[ticket.status as keyof typeof statusConfig].color}15`,
                          color: statusConfig[ticket.status as keyof typeof statusConfig].color,
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                    <Typography 
                      variant="body2" 
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {ticket.content}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                      <Typography variant="caption" color="text.secondary">
                        Created {new Date(ticket.createdAt).toLocaleDateString()}
                      </Typography>
                      {ticket.utilTicket?.customer_review_rating && (
                        <Chip
                          size="small"
                          label={`${ticket.utilTicket.customer_review_rating}/5`}
                          sx={{ bgcolor: 'rgba(245, 158, 11, 0.1)' }}
                        />
                      )}
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <TicketIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              No tickets found
            </Typography>
            <Typography variant="body2" sx={{ mb: 3 }}>
              {search
                ? `No tickets matching "${search}"`
                : selectedStatus
                ? `No ${statusConfig[selectedStatus as keyof typeof statusConfig].label.toLowerCase()} tickets`
                : 'Create your first support ticket'}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => router.push('/customer/tickets/create')}
            >
              Create Ticket
            </Button>
          </Box>
        )}

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
    </AnimatePresence>
  );
}