'use client';

import { Box, Typography, Button, Paper, Stack, Grid, Container, Card, CardContent, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import { Suspense } from 'react';
import { ClientGreeting } from './client-greeting';
import { RocketLaunch, Support, Android, QueryStats } from '@mui/icons-material';

const features = [
  {
    icon: <Android sx={{ fontSize: 40 }} />,
    title: "AI-Powered Support",
    description: "Get instant answers from our intelligent chatbot, trained on Burger King's extensive knowledge base."
  },
  {
    icon: <Support sx={{ fontSize: 40 }} />,
    title: "24/7 Assistance",
    description: "Connect with our support team anytime, anywhere. We're here to help you flame-grill your problems away."
  },
  {
    icon: <QueryStats sx={{ fontSize: 40 }} />,
    title: "Real-time Updates",
    description: "Track your support tickets and get instant notifications on their progress."
  }
];

export default function Home() {
  return (
    <Box>
      {/* Hero Section */}
      <Box
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        sx={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #ff9800 0%, #fff3e0 100%)',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size = {{xs:12,md:6}}>
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Typography variant="h2" fontWeight={700} color="primary.dark" gutterBottom>
                  Welcome to Burger King Support
                </Typography>
                <Typography variant="h5" color="text.secondary" paragraph>
                  AI-powered customer support that's flame-grilled to perfection
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
                  <Button
                    variant="contained"
                    color="warning"
                    size="large"
                    component={motion.button}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href="/login"
                    startIcon={<RocketLaunch />}
                  >
                    Get Started
                  </Button>
                  <Button
                    variant="outlined"
                    color="warning"
                    size="large"
                    href="/track-ticket"
                  >
                    Track Ticket
                  </Button>
                </Stack>
              </motion.div>
            </Grid>
            <Grid size = {{xs:12 ,md:6}}>
              <motion.img
                src="/burger-king-hero.png"
                alt="Burger King Support"
                style={{ width: '100%', maxWidth: 500 }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 }}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Container sx={{ py: 8 }}>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid size = {{ xs:12, md:4}} key={index}>
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
              >
                <Card
                  elevation={2}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: '0.3s',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: 6,
                    },
                  }}
                >
                  <CardContent>
                    <IconButton
                      sx={{
                        backgroundColor: 'warning.light',
                        mb: 2,
                        '&:hover': { backgroundColor: 'warning.main' },
                      }}
                    >
                      {feature.icon}
                    </IconButton>
                    <Typography variant="h5" component="h2" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}