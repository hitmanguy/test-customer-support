'use client';

import { Box, Container, Grid, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import SpeedIcon from '@mui/icons-material/Speed';

const features = [
  {
    icon: <SmartToyIcon sx={{ fontSize: 40 }} />,
    title: 'AI-Powered Responses',
    description: 'Instant, accurate responses powered by advanced AI for common queries, reducing wait times dramatically.'
  },
  {
    icon: <QueryStatsIcon sx={{ fontSize: 40 }} />,
    title: 'Smart Analytics',
    description: 'Deep insights into customer interactions, helping you understand and improve your support quality.'
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 40 }} />,
    title: 'Lightning Fast',
    description: 'Immediate response times with AI triage, ensuring no customer query goes unnoticed.'
  },
  {
    icon: <AutoAwesomeIcon sx={{ fontSize: 40 }} />,
    title: 'Self-Learning',
    description: 'Our AI continuously learns from interactions, becoming more effective over time.'
  }
];

type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

interface FeatureCardProps {
  feature: Feature;
  index: number;
}

const FeatureCard = ({ feature, index }: FeatureCardProps) => {
  const [ref, inView] = useInView({
    threshold: 0.2,
    triggerOnce: true
  });

  return (
    <Box
      component={motion.div}
      ref={ref}
      initial={{ y: 50, opacity: 0 }}
      animate={inView ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 0.8, delay: index * 0.2 }}
      sx={{
        p: 4,
        height: '100%',
        backgroundColor: 'background.paper',
        borderRadius: 4,
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transition: 'transform 0.3s ease-in-out',
        '&:hover': {
          transform: 'translateY(-10px)',
        }
      }}
    >
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 80,
          height: 80,
          borderRadius: '20px',
          background: 'linear-gradient(45deg, #7C3AED20, #10B98120)',
          color: 'primary.main'
        }}
      >
        {feature.icon}
      </Box>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
        {feature.title}
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary' }}>
        {feature.description}
      </Typography>
    </Box>
  );
};

export const FeatureSection = () => {
  const theme = useTheme();
  const [ref, inView] = useInView({
    threshold: 0.2,
    triggerOnce: true
  });

  return (
    <Box
      sx={{
        py: 15,
        background: `linear-gradient(0deg, 
          ${theme.palette.background.paper} 0%, 
          ${theme.palette.background.default} 100%)`,
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
            Features that Transform Support
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto'
            }}
          >
            Empower your support team with cutting-edge AI technology
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid size = {{xs:12,md:6}}key={feature.title}>
              <FeatureCard feature={feature} index={index} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};