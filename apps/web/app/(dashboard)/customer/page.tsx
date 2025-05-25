'use client';

import { useState } from 'react';
import {
  Box,
  Grid,
  TextField,
  InputAdornment,
  Typography,
  Alert,
  Paper,
} from '@mui/material';
import { Search as SearchIcon, Business as BusinessIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingAnimation } from '@web/app/components/shared/LoadingAnimation';
import { useAuthStore } from '@web/app/store/authStore';
import { useTRPC } from '@web/app/trpc/client';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

interface Company {
  id: string;
  name: string;
  picture?: string;
  verified: boolean;
  email: string;
}

export default function CompanySelectionPage() {
  const router = useRouter();
    const trpc = useTRPC();
  const { setSelectedCompany, user } = useAuthStore();
  const [search, setSearch] = useState('');

  const { data: companiesData, isLoading, error } = useQuery(trpc.utils.getAllCompanies.queryOptions({
    page: 1,
    limit: 50,
    verified: true,
    sortBy: 'name',
    sortOrder: 'asc'
  })
);

  const companies = companiesData?.items || [];
  
  const filteredCompanies = companies.filter((company: Company) => 
    company.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompany(companyId);
    router.push(`/customer/tickets?company=${companyId}`);
  };

  if (isLoading) {
    return <LoadingAnimation message="Loading companies..." />;
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error.message || 'Failed to load companies'}
      </Alert>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        {/* Welcome Section */}
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
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Find the company you need support from
          </Typography>
        </Box>

        {/* Search Bar */}
        <Paper
          elevation={0}
          sx={{
            p: 0.5,
            mb: 4,
            maxWidth: 600,
            mx: 'auto',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <TextField
            fullWidth
            placeholder="Search companies by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'primary.main' }} />
                </InputAdornment>
              ),
              sx: {
                '& fieldset': { border: 'none' },
                fontSize: '1.1rem',
              }
            }}
          />
        </Paper>

        {/* Companies Grid */}
        <Grid container spacing={3}>
          {filteredCompanies.map((company: Company, index: number) => (
            <Grid size={{xs:12,sm:6,md:4}} key={company.id}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Paper
                  elevation={0}
                  onClick={() => handleCompanySelect(company.id)}
                  sx={{
                    p: 3,
                    height: '100%',
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '1px solid',
                    borderColor: 'divider',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: (theme) => `0 4px 20px ${theme.palette.primary.main}25`,
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {company.picture ? (
                      <Box
                        component="img"
                        src={company.picture}
                        alt={company.name}
                        sx={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: 2,
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'linear-gradient(45deg, #7C3AED20, #10B98120)',
                        }}
                      >
                        <BusinessIcon sx={{ color: 'primary.main' }} />
                      </Box>
                    )}
                    <Box sx={{ ml: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {company.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {company.email}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Empty State */}
        {filteredCompanies.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            <BusinessIcon 
              sx={{ 
                fontSize: 48, 
                mb: 2, 
                opacity: 0.5,
                color: 'primary.main' 
              }} 
            />
            <Typography variant="h6">
              No companies found matching "{search}"
            </Typography>
          </Box>
        )}
      </Box>
    </AnimatePresence>
  );
}