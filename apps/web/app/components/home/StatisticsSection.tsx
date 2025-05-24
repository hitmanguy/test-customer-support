'use client';

import { Box, Container, Typography, Paper, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SavingsIcon from '@mui/icons-material/Savings';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';

const statistics = [
  {
    icon: <AccessTimeIcon sx={{ fontSize: 40 }} />,
    value: '60%',
    label: 'Faster Response Time',
    description: 'Average reduction in customer wait times'
  },
  {
    icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
    value: '85%',
    label: 'First Contact Resolution',
    description: 'Issues resolved in the first interaction'
  },
  {
    icon: <SavingsIcon sx={{ fontSize: 40 }} />,
    value: '40%',
    label: 'Cost Reduction',
    description: 'Decrease in support operational costs'
  },
  {
    icon: <EmojiEmotionsIcon sx={{ fontSize: 40 }} />,
    value: '24/7',
    label: 'Always Available',
    description: 'Round-the-clock automated support'
  }
];

type StatCardProps = {
  data: {
    icon: React.ReactNode;
    value: string;
    label: string;
    description: string;
  };
  index: number;
};

const StatCard: React.FC<StatCardProps> = ({ data, index }) => {
  const [ref, inView] = useInView({
    threshold: 0.2,
    triggerOnce: true
  });

  return (
    <Paper
      component={motion.div}
      ref={ref}
      initial={{ y: 50, opacity: 0 }}
      animate={inView ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 0.8, delay: index * 0.2 }}
      elevation={0}
      sx={{
        p: 4,
        height: '100%',
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 4,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        '&:hover': {
          transform: 'translateY(-8px)',
          transition: 'transform 0.3s ease-in-out',
          '& .stat-icon': {
            transform: 'scale(1.2)',
            color: 'primary.main'
          }
        }
      }}
    >
      <Box
        className="stat-icon"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          color: 'text.secondary',
          transition: 'all 0.3s ease-in-out'
        }}
      >
        {data.icon}
      </Box>

      <Typography
        variant="h3"
        component={motion.h3}
        initial={{ scale: 0 }}
        animate={inView ? { scale: 1 } : {}}
        transition={{ delay: index * 0.3 }}
        sx={{
          mb: 1,
          fontWeight: 700,
          background: 'linear-gradient(45deg, #7C3AED, #10B981)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {data.value}
      </Typography>

      <Typography
        variant="h6"
        sx={{ mb: 2, fontWeight: 600 }}
      >
        {data.label}
      </Typography>

      <Typography
        variant="body2"
        sx={{ color: 'text.secondary' }}
      >
        {data.description}
      </Typography>
    </Paper>
  );
};

export const StatisticsSection = () => {
  const theme = useTheme();
  const [ref, inView] = useInView({
    threshold: 0.2,
    triggerOnce: true
  });

  return (
    <Box
      sx={{
        py: 15,
        background: `linear-gradient(180deg, 
          ${theme.palette.background.default} 0%, 
          ${theme.palette.background.paper} 100%)`
      }}
    >
      <Container maxWidth="lg">
        <Box
          component={motion.div}
          ref={ref}
          initial={{ y: 50, opacity: 0 }}
          animate={inView ? { y: 0, opacity: 1 } : {}}
          sx={{ textAlign: 'center', mb: 8 }}
        >
          <Typography
            variant="h2"
            sx={{
              mb: 2,
              fontWeight: 800,
              background: 'linear-gradient(45deg, #7C3AED, #10B981)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            AI-Powered Impact
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto'
            }}
          >
            Transform your customer support with cutting-edge AI technology
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              lg: 'repeat(4, 1fr)'
            },
            gap: 4
          }}
        >
          {statistics.map((stat, index) => (
            <StatCard
              key={stat.label}
              data={stat}
              index={index}
            />
          ))}
        </Box>
      </Container>
    </Box>
  );
};