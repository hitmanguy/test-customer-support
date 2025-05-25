'use client';

import { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  TextField,
  InputAdornment,
  Card,
  CardContent,
  Avatar,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Chat as ChatIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@web/app/store/authStore';
import { trpc } from '@web/app/trpc/client';
import { useQuery } from '@tanstack/react-query';
import type { Company } from '@web/app/types/types';

export default function ChatListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');

  // Fetch verified companies
  const { data: companiesData, isLoading } = trpc.utils.getAllCompanies.useQuery({
      verified: true,
      page: 1,
      limit: 50,
      sortBy: 'name',
      sortOrder: 'asc',
    });

  // Get latest chats for each company
  const companies = companiesData?.items || [];
  const companyChats = companies.map((company:Company) => {
    const { data: chatData } = trpc.chat.getLatestCompanyChat.useQuery({
        customerId: user?.id || '',
        companyId: company._id,
      });
    return { company, latestChat: chatData?.chat };
  });

  const filteredCompanies = companyChats.filter(
    ({ company }: { company: Company; latestChat: any }) =>
      company.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleChatSelect = async (companyId: string) => {
    router.push(`/customer/chat/${companyId}`);
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
            AI Support Chat
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Get instant help from our AI assistants
          </Typography>
        </Box>

        {/* Search */}
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
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : (
            filteredCompanies.map(
              ({ company, latestChat }: { company: Company; latestChat: any }, index: number) => (
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
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
                        <Avatar
                          src={company.picture}
                          alt={company.name}
                          sx={{ width: 56, height: 56 }}
                        >
                          {company.name[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {company.name}
                          </Typography>
                          {latestChat && (
                            <Typography variant="caption" color="text.secondary">
                              Last chat: {new Date(latestChat.updatedAt).toLocaleDateString()}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<BotIcon />}
                        onClick={() => handleChatSelect(company._id)}
                        sx={{
                          py: 1.5,
                          background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                          '&:hover': {
                            background: 'linear-gradient(45deg, #6D28D9, #059669)',
                          },
                        }}
                      >
                        {latestChat ? 'Continue Chat' : 'Start Chat'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))
          )}
        </Grid>

        {/* Empty State */}
        {!isLoading && filteredCompanies.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <ChatIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
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