import { Box } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { HydrateClient } from './trpc/server';
import { SuspenseBoundary } from './components/shared/SuspenseBoundary';
import { Header } from './components/shared/Header';
import ThemeRegistry from './components/shared/ThemeRegistry';

// Custom components for sections
import { HeroSection } from './components/home/HeroSection';
import { FeatureSection } from './components/home/FeatureSection';
import { BenefitsSection } from './components/home/BenefitsSection';
import { StatisticsSection } from './components/home/StatisticsSection';
import { CTASection } from './components/home/CTASection';

export default function Home() {
  return (
    <HydrateClient>
      <ThemeRegistry>
        <ErrorBoundary fallback={<div>Something went wrong</div>}>          <SuspenseBoundary fullScreen message="Loading amazing things...">
            <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
              <Header />
              <HeroSection />
              <FeatureSection />
              <BenefitsSection />
              <StatisticsSection />
              <CTASection />
            </Box>
          </SuspenseBoundary>
        </ErrorBoundary>
      </ThemeRegistry>
    </HydrateClient>
  );
}