'use client';

import { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Paper,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Circle as StatusIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingAnimation } from '@web/app/components/shared/LoadingAnimation';
import { useAuthStore } from '@web/app/store/authStore';
import { useTRPC } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';

interface Ticket {
  id: string;
  title: string;
  content: string;
  status: 'open' | 'in_progress' | 'closed';
  attachment?: string;
  sender_role: 'customer' | 'bot';
  solution?: string;
  solution_attachment?: string;
  createdAt: string;
  updatedAt: string;
  chat?: {
    lastMessage?: string;
  };
}

const statusConfig = {
  open: { color: '#10B981', label: 'Open' },
  in_progress: { color: '#F59E0B', label: 'In Progress' },
  closed: { color: '#6B7280', label: 'Closed' },
};

export default function TicketsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get('company');
  const trpc = useTRPC();
  const { user } = useAuthStore();
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { data: ticketsData, isLoading } = useQuery(
    trpc.ticket.getTicketsByQuery.queryOptions({
      customerId: user?.id || '',
      companyId: companyId || '',
      status: statusFilter as any || undefined,
      page: 1,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })
  );

  const tickets = ticketsData?.tickets || [];

  const filteredTickets = tickets.filter(ticket =>
    ticket.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTicket = () => {
    router.push(`/customer/tickets/create?company=${companyId}`);
  };

  if (!companyId) {
    router.push('/customer');
    return null;
  }

  if (isLoading) {
    return <LoadingAnimation message="Loading your tickets..." />;
  }

  return (
    <AnimatePresence mode="wait">
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        {/* Header Section */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 4,
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            My Tickets
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateTicket}
            sx={{
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              '&:hover': {
                transform: 'scale(1.02)',
              },
            }}
          >
            Create Ticket
          </Button>
        </Box>

        {/* Search and Filter Section */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search tickets..."
              size="small"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'primary.main' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1 }}
            />
            <IconButton 
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ 
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <FilterIcon />
            </IconButton>
          </Box>
        </Paper>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={() => {
            setStatusFilter(null);
            setAnchorEl(null);
          }}>
            All Tickets
          </MenuItem>
          {Object.entries(statusConfig).map(([status, config]) => (
            <MenuItem
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setAnchorEl(null);
              }}
            >
              <StatusIcon sx={{ mr: 1, color: config.color }} />
              {config.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Tickets Grid */}
        <Grid container spacing={2}>
          {filteredTickets.map((ticket: Ticket, index: number) => (
            <Grid size = {{xs:12}} key={ticket.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Paper
                  elevation={0}
                  onClick={() => router.push(`/customer/tickets/${ticket.id}`)}
                  sx={{
                    p: 3,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid',
                    borderColor: 'divider',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      transform: 'translateX(8px)',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {ticket.title}
                      </Typography>
                      <Chip
                        icon={<StatusIcon sx={{ color: `${statusConfig[ticket.status].color} !important` }} />}
                        label={statusConfig[ticket.status].label}
                        size="small"
                        sx={{
                          bgcolor: `${statusConfig[ticket.status].color}15`,
                          color: statusConfig[ticket.status].color,
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 2,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {ticket.content}
                  </Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Empty State */}
        {filteredTickets.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              {search
                ? `No tickets found matching "${search}"`
                : 'No tickets yet'}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateTicket}
            >
              Create Your First Ticket
            </Button>
          </Box>
        )}
      </Box>
    </AnimatePresence>
  );
}