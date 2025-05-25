'use client';

import { Card, CardContent, CardMedia, Typography, Box, Button, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import { Business as BusinessIcon, Star as StarIcon } from '@mui/icons-material';

interface CompanyCardProps {
  company: {
    id: string;
    name: string;
    logo?: string;
    description?: string;
    rating?: number;
    category?: string;
    supportHours?: string;
  };
  onSelect: (companyId: string) => void;
  delay?: number;
}

export function CompanyCard({ company, onSelect, delay = 0 }: CompanyCardProps) {
  return (
    <Card
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        '&:hover': {
          transform: 'translateY(-4px)',
          transition: 'transform 0.2s ease-in-out',
          boxShadow: (theme) => theme.shadows[4],
        },
      }}
    >
      <Box sx={{ position: 'relative', pt: '56.25%' }}>
        {company.logo ? (
          <CardMedia
            component="img"
            image={company.logo}
            alt={company.name}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
            }}
          >
            <BusinessIcon sx={{ fontSize: 60, color: 'white' }} />
          </Box>
        )}
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            {company.name}
          </Typography>
          {company.rating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <StarIcon sx={{ color: 'warning.main' }} />
              <Typography variant="body2" color="text.secondary">
                {company.rating.toFixed(1)}
              </Typography>
            </Box>
          )}
          {company.category && (
            <Chip
              label={company.category}
              size="small"
              sx={{ mb: 1 }}
            />
          )}
        </Box>

        {company.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {company.description}
          </Typography>
        )}

        {company.supportHours && (
          <Typography variant="caption" color="text.secondary" display="block">
            Support Hours: {company.supportHours}
          </Typography>
        )}
      </CardContent>

      <Box sx={{ p: 2, pt: 0 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={() => onSelect(company.id)}
          sx={{
            background: 'linear-gradient(45deg, #7C3AED, #10B981)',
            '&:hover': {
              transform: 'scale(1.02)',
            },
          }}
        >
          Select Company
        </Button>
      </Box>
    </Card>
  );
}