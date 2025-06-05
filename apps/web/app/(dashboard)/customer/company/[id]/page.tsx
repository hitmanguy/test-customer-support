'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  Avatar,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  SmartToy as AIIcon,
  ConfirmationNumber as TicketIcon,
  AccessTime as TimeIcon,
  Star as StarIcon,
  VerifiedUser as VerifiedIcon,
  FormatListBulleted as ListIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { Company, CompanyStats, Ticket } from '@web/app/types/types';

const statusConfig = {
  open: { color: '#10B981', icon: <TimeIcon />, label: 'Open' },
  in_progress: { color: '#F59E0B', icon: <TimeIcon />, label: 'In Progress' },
  closed: { color: '#6B7280', icon: <TimeIcon />, label: 'Resolved' },
};

export default function CompanyDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();

  const companyId = params.id as string;

  
  const { data: companyData, isLoading: isCompanyLoading } = trpc.utils.getCompany.useQuery({ companyId })

  
  const { data: statsData } = trpc.utils.getCompanyStats.useQuery({ companyId })

  
  const { data: ticketsData } = trpc.ticket.getTicketsByQuery.useQuery({
      customerId: user?.id || '',
      companyId,
      limit: 5,
      page: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    })

  const company = companyData?.company as Company;
  const stats = statsData?.stats as CompanyStats;
  const tickets = ticketsData?.tickets as Ticket[];

  if (isCompanyLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!company) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error">Company not found</Typography>
        <Button 
          variant="outlined" 
          onClick={() => router.push('/customer/company')}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 4,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <Avatar
            src={company.picture}
            alt={company.name}
            sx={{ width: 80, height: 80 }}
          >
            {company.name[0]}
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {company.name}
              </Typography>
              <VerifiedIcon sx={{ color: 'primary.main' }} />
            </Box>
            
            {stats?.rating > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StarIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6">
                  {stats.rating.toFixed(1)}
                </Typography>
                <Typography color="text.secondary">
                  • {stats.agents.verified} Support Agents
                </Typography>
              </Box>
            )}

            <Grid container spacing={2} sx={{ mt: 3 }}>
              <Grid size = {{xs:12,sm:6}}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<AIIcon />}
                  onClick={() => router.push(`/customer/chat?company=${companyId}`)}
                  sx={{
                    py: 2,
                    background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #6D28D9, #059669)',
                    },
                  }}
                >
                  Talk to AI Assistant
                </Button>
              </Grid>
              <Grid size = {{xs:12,sm:6}}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="large"
                  startIcon={<TicketIcon />}
                  onClick={() => router.push(`/customer/tickets/create?company=${companyId}`)}
                  sx={{ py: 2 }}
                >
                  Create Support Ticket
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Paper>

      {}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size = {{xs:12,sm:4}}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'rgba(124, 58, 237, 0.05)',
              border: '1px solid',
              borderColor: 'primary.main',
            }}
          >
            <Typography color="text.secondary">Total Tickets</Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {stats?.tickets.total || 0}
            </Typography>
          </Paper>
        </Grid>
        <Grid size = {{xs:12,sm:4}}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid',
              borderColor: '#10B981',
            }}
          >
            <Typography color="text.secondary">Resolved Tickets</Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {stats?.tickets.resolved || 0}
            </Typography>
          </Paper>
        </Grid>
        <Grid size = {{xs:12,sm:4}}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid',
              borderColor: '#F59E0B',
            }}
          >
            <Typography color="text.secondary">Active Tickets</Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {stats?.tickets.open || 0}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h6">Recent Tickets</Typography>
          <Button
            startIcon={<ListIcon />}
            onClick={() => router.push(`/customer/tickets?company=${companyId}`)}
          >
            View All
          </Button>
        </Box>

        {tickets && tickets.length > 0 ? (
          <Grid container spacing={2}>
            {tickets.map((ticket) => (
              <Grid size = {{xs:12}} key={ticket._id}>
                <Paper
                  elevation={0}
                  onClick={() => router.push(`/customer/tickets/${ticket._id}`)}
                  sx={{
                    p: 2,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateX(8px)',
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle2">{ticket.title}</Typography>
                      <Chip
                        size="small"
                        label={statusConfig[ticket.status].label}
                        sx={{
                          mt: 1,
                          bgcolor: `${statusConfig[ticket.status].color}15`,
                          color: statusConfig[ticket.status].color,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <Typography>No tickets yet</Typography>
            <Button
              variant="outlined"
              startIcon={<TicketIcon />}
              onClick={() => router.push(`/customer/tickets/create?company=${companyId}`)}
              sx={{ mt: 2 }}
            >
              Create Your First Ticket
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}