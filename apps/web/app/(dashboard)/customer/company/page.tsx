'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Avatar,
  Chip,
  CircularProgress,
  ButtonGroup,
  Button,
  Grid
} from '@mui/material';
import {
  Search as SearchIcon,
  Star as StarIcon,
  VerifiedUser as VerifiedIcon,
  SmartToy as AIIcon,
  ConfirmationNumber as TicketIcon,
  FormatListBulleted as ListIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';
import { Company, CompanyStats } from '@web/app/types/types';

export default function CompanySelectionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');

  
  const { data: companiesData, isLoading: isLoadingCompanies } = trpc.utils.getAllCompanies.useQuery({
      verified: true,
      page: 1,
      limit: 50,
      sortBy: 'name',
      sortOrder: 'asc',
    })

  
  const companies = companiesData?.items || [];
  const companyStats = companies.map((company: Company) => {
    const { data: stats } = trpc.utils.getCompanyStats.useQuery({
        companyId: company._id,
      })
    return { company, stats: stats?.stats };
  });

  const filteredCompanies = companyStats.filter(
    ({ company }: { company: Company; stats: CompanyStats }) =>
      company.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = (companyId: string, action: 'chat' | 'ticket' | 'view') => {
    switch (action) {
      case 'chat':
        router.push(`/customer/chat/${companyId}`);
        break;
      case 'ticket':
        router.push(`/customer/tickets/create?company=${companyId}`);
        break;
      case 'view':
        router.push(`/customer/tickets?company=${companyId}`);
        break;
    }
  };

  return (
    <AnimatePresence mode="wait">
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        {}
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700,
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Welcome, {user?.name}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Choose a company and select how you'd like to get support
          </Typography>
        </Box>

        {/* Search Box */}
        <Box sx={{ mb: 4 }}>
          <TextField
            fullWidth
            placeholder="Search companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'primary.main' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                bgcolor: 'background.paper',
              }
            }}
          />
        </Box>

        {/* Companies Grid */}
        <Grid container spacing={3}>
          {isLoadingCompanies ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            filteredCompanies.map(
              (
                { company, stats }: { company: Company; stats: CompanyStats },
                index: number
              ) => (
              <Grid size = {{xs:12,sm:6,md:4}} key={company._id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      border: '1px solid',
                      borderColor: 'divider',
                      background: 'rgba(255, 255, 255, 0.05)',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.2s',
                      '&:hover': {
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      {/* Company Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                        <Avatar
                          src={company.picture}
                          alt={company.name}
                          sx={{ width: 48, height: 48 }}
                        >
                          {company.name[0]}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {company.name}
                            </Typography>
                            <VerifiedIcon 
                              sx={{ 
                                fontSize: 16, 
                                color: 'primary.main',
                              }} 
                            />
                          </Box>
                          {stats?.rating > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <StarIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
                              <Typography variant="body2" color="text.secondary">
                                {stats.rating.toFixed(1)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Company Stats */}
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                        <Chip
                          size="small"
                          label={`${stats?.agents.verified || 0} Agents`}
                          sx={{ bgcolor: 'rgba(124, 58, 237, 0.1)' }}
                        />
                        <Chip
                          size="small"
                          label={`${stats?.tickets.resolved || 0} Resolved`}
                          sx={{ bgcolor: 'rgba(16, 185, 129, 0.1)' }}
                        />
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          startIcon={<AIIcon />}
                          onClick={() => handleAction(company._id, 'chat')}
                          sx={{ 
                            borderColor: 'primary.main',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: 'rgba(124, 58, 237, 0.1)',
                            }
                          }}
                        >
                          AI Chat
                        </Button>
                        
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<TicketIcon />}
                            onClick={() => handleAction(company._id, 'ticket')}
                            sx={{ 
                              borderColor: 'primary.main',
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'rgba(16, 185, 129, 0.1)',
                              }
                            }}
                          >
                            Create Ticket
                          </Button>
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<ListIcon />}
                            onClick={() => handleAction(company._id, 'view')}
                            sx={{ 
                              borderColor: 'primary.main',
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: 'rgba(59, 130, 246, 0.1)',
                              }
                            }}
                          >
                            View Tickets
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))
          )}
        </Grid>

        {/* Empty State */}
        {!isLoadingCompanies && filteredCompanies.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Typography variant="h6">
              {search
                ? `No companies found matching "${search}"`
                : 'No companies available'}
            </Typography>
          </Box>
        )}
      </Box>
    </AnimatePresence>
  );
}