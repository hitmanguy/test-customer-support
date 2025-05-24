'use client';

import { Box, Container, Grid, Typography, useTheme, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';

const benefitsByRole = [
  {
    role: 'Customers',
    icon: <PersonIcon sx={{ fontSize: 50 }} />,
    color: '#7C3AED',
    benefits: [
      '24/7 Instant Support Access',
      'No More Waiting Queues',
      'Consistent Support Experience',
      'Multi-language Support',
      'Secure Chat History'
    ]
  },
  {
    role: 'Agents',
    icon: <SupportAgentIcon sx={{ fontSize: 50 }} />,
    color: '#10B981',
    benefits: [
      'AI-Powered Response Suggestions',
      'Automated Ticket Prioritization',
      'Quick Access to Knowledge Base',
      'Performance Analytics',
      'Reduced Repetitive Tasks'
    ]
  },
  {
    role: 'Companies',
    icon: <BusinessIcon sx={{ fontSize: 50 }} />,
    color: '#F59E0B',
    benefits: [
      'Reduced Operating Costs',
      'Increased Customer Satisfaction',
      'Scalable Support Operations',
      'Data-Driven Insights',
      'Improved Team Efficiency'
    ]
  }
];

type BenefitData = {
  role: string;
  icon: React.ReactNode;
  color: string;
  benefits: string[];
};

interface BenefitCardProps {
  data: BenefitData;
  index: number;
}

const BenefitCard: React.FC<BenefitCardProps> = ({ data, index }) => {
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
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          '& .benefit-icon': {
            transform: 'scale(1.1)',
          }
        }
      }}
    >
      <Box
        className="benefit-icon"
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 100,
          height: 100,
          borderRadius: '30px',
          background: `${data.color}20`,
          color: data.color,
          transition: 'transform 0.3s ease-in-out'
        }}
      >
        {data.icon}
      </Box>

      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700 }}>
        For {data.role}
      </Typography>

      {data.benefits.map((benefit, i) => (
        <Box
          key={i}
          component={motion.div}
          initial={{ x: -20, opacity: 0 }}
          animate={inView ? { x: 0, opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: index * 0.2 + i * 0.1 }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 2,
            '&:last-child': { mb: 0 }
          }}
        >
          <Box
            component="span"
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: data.color,
              mr: 2
            }}
          />
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            {benefit}
          </Typography>
        </Box>
      ))}

      {/* Background gradient */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '50%',
          height: '50%',
          background: `radial-gradient(circle, ${data.color}10 0%, transparent 70%)`,
          filter: 'blur(45px)',
          zIndex: 0,
          pointerEvents: 'none'
        }}
      />
    </Paper>
  );
};

export const BenefitsSection = () => {
  const theme = useTheme();
  const [ref, inView] = useInView({
    threshold: 0.2,
    triggerOnce: true
  });

  return (
    <Box
      sx={{
        py: 15,
        background: theme.palette.background.default
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
            Benefits for Everyone
          </Typography>
          <Typography
            variant="h5"
            sx={{
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto'
            }}
          >
            See how our AI-powered platform benefits all stakeholders
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {benefitsByRole.map((benefit, index) => (
            <Grid size = {{xs:12,md:4}}key={benefit.role}>
              <BenefitCard data={benefit} index={index} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};