'use client';

import { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Divider,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Lightbulb as LightbulbIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Support as SupportIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function CompanyAnalytics() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [timeRange, setTimeRange] = useState('30d');

  
  const { data: analytics, isLoading } = trpc.companyDashboard.getCompanyAnalytics.useQuery({
    companyId: user?.id || ''
  }, {
    enabled: !!user?.id
  });

  const { data: trends } = trpc.companyDashboard.getTrendAnalysis.useQuery({
    companyId: user?.id || '',
    timeRange: timeRange as '7d' | '30d' | '90d' | '1y'
  }, {
    enabled: !!user?.id
  });

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <LinearProgress sx={{ width: '50%' }} />
      </Box>
    );
  }

  if (!analytics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Alert severity="error">Failed to load analytics data</Alert>
      </Box>
    );
  }

  const getRiskColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => router.back()}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Analytics Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Comprehensive insights into your customer support performance
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
              <MenuItem value="1y">Last year</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size = {{xs:12,sm:6,md:3}}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {analytics.overview.totalTickets}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Tickets
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <SupportIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size = {{xs:12,sm:6,md:3}}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      {Math.round((analytics.overview.resolvedTickets / analytics.overview.totalTickets) * 100)}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Resolution Rate
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CheckCircleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size = {{xs:12,sm:6,md:3}}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="info.main">
                      {analytics.overview.avgResolutionTime}h
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Avg Resolution Time
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <ScheduleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        <Grid size = {{xs:12,sm:6,md:3}}>
          <motion.div whileHover={{ scale: 1.02 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" fontWeight="bold" color="warning.main">
                      {analytics.overview.customerSatisfaction}%
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Customer Satisfaction
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <PeopleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {}
        <Grid size = {{xs:12,md:4}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Ticket Volume Trend
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics.trends.ticketVolume}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {}
        <Grid size = {{xs:12,md:4}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Ticket Categories
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.trends.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ category, percentage }) => `${category}: ${percentage}%`}
                  >
                    {analytics.trends.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {}
        <Grid size = {{xs:12,md:4}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Common Problems
              </Typography>
              <List dense>
                {analytics.insights.commonProblems.map((problem, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Avatar sx={{ 
                        bgcolor: problem.impact === 'High' ? 'error.main' : 
                                problem.impact === 'Medium' ? 'warning.main' : 'info.main',
                        width: 24, 
                        height: 24 
                      }}>
                        <Typography variant="caption" fontWeight="bold">
                          {problem.frequency}
                        </Typography>
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={problem.problem}
                      secondary={`Impact: ${problem.impact}`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {}
        <Grid size = {{xs:12,md:4}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Recommendations
              </Typography>
              <List dense>
                {analytics.insights.futureRecommendations.map((rec, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <LightbulbIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={rec.recommendation}
                      secondary={
                        <Box>
                          <Chip
                            label={rec.priority}
                            size="small"
                            color={getPriorityColor(rec.priority) as any}
                            sx={{ mr: 1, mt: 0.5 }}
                          />
                          <Typography variant="caption" display="block">
                            {rec.expectedImpact}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {}
        <Grid size = {{xs:12,md:4}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Risk Factors
              </Typography>
              {analytics.insights.riskFactors.length === 0 ? (
                <Box display="flex" alignItems="center" justifyContent="center" py={4}>
                  <CheckCircleIcon color="success" sx={{ mr: 1 }} />
                  <Typography color="success.main">No risk factors detected</Typography>
                </Box>
              ) : (
                <List dense>
                  {analytics.insights.riskFactors.map((risk, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <WarningIcon color={getRiskColor(risk.severity) as any} />
                      </ListItemIcon>
                      <ListItemText
                        primary={risk.factor}
                        secondary={
                          <Box>
                            <Chip
                              label={risk.severity}
                              size="small"
                              color={getRiskColor(risk.severity) as any}
                              sx={{ mr: 1, mt: 0.5 }}
                            />
                            <Typography variant="caption" display="block">
                              {risk.description}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {}
      <Grid container spacing={3}>
        {}
        <Grid size = {{xs:12,md:6}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Resolution Time Trend
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={analytics.trends.resolutionTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="avgTime" stroke="#8884d8" name="Avg Time (hours)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {}
        <Grid size = {{xs:12,md:6}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Channel Performance
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analytics.performance.channelPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tickets" fill="#8884d8" name="Tickets" />
                  <Bar dataKey="satisfaction" fill="#82ca9d" name="Satisfaction %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
