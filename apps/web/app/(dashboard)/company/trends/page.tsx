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
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Analytics as AnalyticsIcon,
  Psychology as PsychologyIcon,
  Timeline as TimelineIcon,
  Insights as InsightsIcon,
  ArrowBack as ArrowBackIcon,
  ExpandMore as ExpandMoreIcon,
  Lightbulb as LightbulbIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6B6B'];


const aiInsights = {
  patternAnalysis: [
    {
      pattern: "Peak ticket hours",
      insight: "Most tickets are created between 2-4 PM, suggesting users encounter issues during peak work hours",
      confidence: 0.92,
      recommendation: "Increase agent availability during 2-4 PM window"
    },
    {
      pattern: "Category correlation",
      insight: "Login issues spike 24 hours before billing cycles, indicating payment-related access problems",
      confidence: 0.87,
      recommendation: "Send proactive payment reminders 48 hours before billing"
    },
    {
      pattern: "Resolution time variance",
      insight: "Technical issues take 3x longer to resolve on Fridays, likely due to reduced technical staff",
      confidence: 0.84,
      recommendation: "Cross-train support agents on technical issues or adjust Friday staffing"
    }
  ],
  futureProjections: [
    {
      metric: "Ticket Volume",
      current: 245,
      projected: 289,
      change: "+18%",
      timeframe: "Next 30 days",
      reason: "Seasonal increase typical for this period"
    },
    {
      metric: "Resolution Time",
      current: "24h",
      projected: "21h",
      change: "-12%",
      timeframe: "Next 30 days",
      reason: "New knowledge base implementation expected to improve efficiency"
    },
    {
      metric: "Customer Satisfaction",
      current: "87%",
      projected: "91%",
      change: "+4%",
      timeframe: "Next 30 days",
      reason: "Improved response times and AI assistance"
    }
  ],
  riskPredictions: [
    {
      risk: "Agent Burnout",
      probability: 0.65,
      impact: "High",
      factors: ["Increasing ticket volume", "Overtime hours above average"],
      mitigation: "Consider hiring additional agents or implementing shift rotations"
    },
    {
      risk: "System Overload",
      probability: 0.23,
      impact: "Medium", 
      factors: ["Growing user base", "Legacy infrastructure"],
      mitigation: "Plan infrastructure upgrade within next quarter"
    }
  ]
};

export default function TrendsAnalysis() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('tickets');

  
  const { data: trends, isLoading } = trpc.companyDashboard.getTrendAnalysis.useQuery({
    companyId: user?.id || '',
    timeRange: timeRange as '7d' | '30d' | '90d' | '1y'
  }, {
    enabled: !!user?.id
  });

  const { data: analytics } = trpc.companyDashboard.getCompanyAnalytics.useQuery({
    companyId: user?.id || ''
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

  if (!trends || !analytics) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Alert severity="error">Failed to load trends data</Alert>
      </Box>
    );
  }

  const getChangeColor = (change: string) => {
    if (change.startsWith('+')) return 'success.main';
    if (change.startsWith('-')) return 'error.main';
    return 'text.primary';
  };

  const getProbabilityColor = (probability: number) => {
    if (probability > 0.7) return 'error';
    if (probability > 0.4) return 'warning';
    return 'success';
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1600, mx: 'auto' }}>
      {}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => router.back()}>
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Trends & AI Analysis
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            Deep insights into patterns, trends, and future predictions for your support system
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
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
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Metric Focus</InputLabel>
            <Select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              label="Metric Focus"
            >
              <MenuItem value="tickets">Tickets</MenuItem>
              <MenuItem value="resolution">Resolution Time</MenuItem>
              <MenuItem value="satisfaction">Satisfaction</MenuItem>
              <MenuItem value="categories">Categories</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Box>

      {}
      <Card sx={{ mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <PsychologyIcon sx={{ fontSize: 40 }} />
            <Box>
              <Typography variant="h5" fontWeight="bold">
                AI-Powered Insights
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Advanced pattern recognition and predictive analytics
              </Typography>
            </Box>
          </Box>
          <Grid container spacing={3}>
            <Grid size = {{xs:12,md:4}}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight="bold">
                  {aiInsights.patternAnalysis.length}
                </Typography>
                <Typography variant="body2">Patterns Detected</Typography>
              </Box>
            </Grid>
            <Grid size = {{xs:12,md:4}}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight="bold">
                  {aiInsights.futureProjections.length}
                </Typography>
                <Typography variant="body2">Future Projections</Typography>
              </Box>
            </Grid>
            <Grid size = {{xs:12,md:4}}>
              <Box textAlign="center">
                <Typography variant="h3" fontWeight="bold">
                  {aiInsights.riskPredictions.length}
                </Typography>
                <Typography variant="body2">Risk Predictions</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {}
        <Grid size = {{xs:12,lg:8}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Ticket Volume & Resolution Trends
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={trends.trends.ticketVolume}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="count" fill="#8884d8" stroke="#8884d8" fillOpacity={0.6} name="Ticket Count" />
                  <Line yAxisId="right" type="monotone" dataKey="avgResolution" stroke="#ff7300" strokeWidth={3} name="Avg Resolution (hours)" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {}
        <Grid size = {{xs:12,lg:4}}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Category Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={trends.trends.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="count"
                    label={({ category, percentage }) => `${percentage}%`}
                  >
                    {trends.trends.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props) => [`${value} tickets`, props.payload.category]} />
                </PieChart>
              </ResponsiveContainer>
              <Box mt={2}>
                {trends.trends.categoryDistribution.map((category, index) => (
                  <Box key={category.category} display="flex" alignItems="center" mb={1}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        backgroundColor: COLORS[index % COLORS.length],
                        borderRadius: '50%',
                        mr: 1
                      }}
                    />
                    <Typography variant="body2">
                      {category.category}: {category.count} tickets
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            <InsightsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            AI Pattern Analysis
          </Typography>
          <Grid container spacing={3}>
            {aiInsights.patternAnalysis.map((pattern, index) => (
              <Grid size = {{xs:12,md:4}} key={index}>
                <motion.div whileHover={{ scale: 1.02 }}>
                  <Paper sx={{ p: 3, height: '100%', border: '1px solid', borderColor: 'primary.light' }}>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary" gutterBottom>
                      {pattern.pattern}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {pattern.insight}
                    </Typography>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                      <Chip
                        label={`${Math.round(pattern.confidence * 100)}% confidence`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="caption">
                        <strong>Recommendation:</strong> {pattern.recommendation}
                      </Typography>
                    </Alert>
                  </Paper>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Future Projections
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Metric</strong></TableCell>
                  <TableCell><strong>Current</strong></TableCell>
                  <TableCell><strong>Projected</strong></TableCell>
                  <TableCell><strong>Change</strong></TableCell>
                  <TableCell><strong>Timeframe</strong></TableCell>
                  <TableCell><strong>Reasoning</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aiInsights.futureProjections.map((projection, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography fontWeight="bold">{projection.metric}</Typography>
                    </TableCell>
                    <TableCell>{projection.current}</TableCell>
                    <TableCell>{projection.projected}</TableCell>
                    <TableCell>
                      <Chip
                        label={projection.change}
                        size="small"
                        color={projection.change.startsWith('+') ? 'success' : 'error'}
                        icon={projection.change.startsWith('+') ? <TrendingUpIcon /> : <TrendingDownIcon />}
                      />
                    </TableCell>
                    <TableCell>{projection.timeframe}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {projection.reason}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Risk Predictions & Mitigation
          </Typography>
          {aiInsights.riskPredictions.map((risk, index) => (
            <Accordion key={index} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box display="flex" alignItems="center" gap={2} width="100%">
                  <Chip
                    label={`${Math.round(risk.probability * 100)}% risk`}
                    size="small"
                    color={getProbabilityColor(risk.probability)}
                  />
                  <Typography variant="subtitle1" fontWeight="bold">
                    {risk.risk}
                  </Typography>
                  <Chip
                    label={risk.impact}
                    size="small"
                    color={risk.impact === 'High' ? 'error' : 'warning'}
                    sx={{ ml: 'auto' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={3}>
                  <Grid size = {{xs:12,md:6}}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Risk Factors:
                    </Typography>
                    <List dense>
                      {risk.factors.map((factor, factorIndex) => (
                        <ListItem key={factorIndex}>
                          <ListItemIcon>
                            <WarningIcon fontSize="small" color="warning" />
                          </ListItemIcon>
                          <ListItemText primary={factor} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                  <Grid size = {{xs:12,md:6}}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Mitigation Strategy:
                    </Typography>
                    <Alert severity="info">
                      <Typography variant="body2">
                        {risk.mitigation}
                      </Typography>
                    </Alert>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
}
