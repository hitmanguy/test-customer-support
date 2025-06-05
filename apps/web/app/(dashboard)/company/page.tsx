'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  LinearProgress,
  Alert,
  Chip,
  Avatar,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Paper,
  useTheme,
  alpha,
  Fade,
  Skeleton
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Upload as UploadIcon,
  Analytics as AnalyticsIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Support as SupportIcon,
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CloudUpload as CloudUploadIcon,
  Description as FileIcon,
  InsertChart as ChartIcon,
  Speed as SpeedIcon,
  Assessment as AssessmentIcon,
  Storage as StorageIcon,
  AutoAwesome as AIIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { trpc } from '@web/app/trpc/client';
import { useAuthStore } from '@web/app/store/authStore';

interface KnowledgeBaseFile {
  _id: string;
  companyId: string;
  filename: string;
  originalName: string;
  fileType: 'pdf' | 'txt' | 'md';
  fileSize: number;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  category: string;
  chunksCount: number;
  vectorIds: string[];
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  __v: number;
  lastProcessedAt?: string | null;
}

export default function CompanyDashboard() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuthStore();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBaseFile | null>(null);

  
  useEffect(() => {
    if (user && user.role !== 'company') {
      router.push('/');
    }
  }, [user, router]);

  
  const { data: overview, isLoading: overviewLoading } = trpc.companyDashboard.getDashboardOverview.useQuery({
    companyId: user?.id || ''
  }, {
    enabled: !!user?.id
  });

  
  const { data: kbData, isLoading: kbLoading, refetch: refetchKb } = trpc.companyDashboard.getKnowledgeBases.useQuery({
    companyId: user?.id || '',
    limit: 10,
    offset: 0
  }, {
    enabled: !!user?.id
  });

  
  const uploadKbMutation = trpc.companyDashboard.uploadKnowledgeBase.useMutation({
    onSuccess: () => {
      setSelectedFile(null);
      setUploading(false);
      refetchKb();
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      setUploading(false);
    }
  });

  const deleteKbMutation = trpc.companyDashboard.deleteKnowledgeBase.useMutation({
    onSuccess: () => {
      refetchKb();
      setAnchorEl(null);
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      
      const allowedTypes = ['application/pdf', 'text/plain', 'text/markdown'];
      const allowedExtensions = ['.pdf', '.txt', '.md', '.markdown'];
      
      const isValidType = allowedTypes.includes(file.type) || 
                         allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!isValidType) {
        alert('Please select a PDF, TXT, or Markdown file');
        return;
      }

      if (file.size > 10 * 1024 * 1024) { 
        alert('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) return;

    setUploading(true);
    
    
    const fileBuffer = await selectedFile.arrayBuffer();
    const fileData = {
      originalname: selectedFile.name,
      mimetype: selectedFile.type,
      buffer: Buffer.from(fileBuffer),
      size: selectedFile.size
    };

    uploadKbMutation.mutate({
      companyId: user.id,
      category: 'General Knowledge',
      fileData
    });
  };
  const handleDeleteKb = (kb: KnowledgeBaseFile) => {
    if (!user?.id) return;
    
    if (confirm(`Are you sure you want to delete "${kb.originalName || kb.filename}"? This action cannot be undone.`)) {
      deleteKbMutation.mutate({
        companyId: user.id,
        knowledgeBaseId: kb._id
      });
    }
  };

const handleMenuClick = (event: React.MouseEvent<HTMLElement>, kb: KnowledgeBaseFile) => {
  setAnchorEl(event.currentTarget);
  setSelectedKb(kb);
}
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedKb(null);
  };

  if (!user || user.role !== 'company') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Alert severity="error">Access denied. Company account required.</Alert>
      </Box>
    );
  }
  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
      p: 3 
    }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
        {}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Paper 
            elevation={0}
            sx={{ 
              p: 4, 
              mb: 4, 
              borderRadius: 3,
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'white',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                position: 'absolute',
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${alpha('#ffffff', 0.1)} 0%, ${alpha('#ffffff', 0.05)} 100%)`,
              }}
            />
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography variant="h3" fontWeight="bold" gutterBottom>
                Welcome back, {user?.name || 'Company'}!
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                Manage your knowledge base and monitor customer support analytics
              </Typography>
            </Box>
          </Paper>
        </motion.div>

        {}
        {overviewLoading ? (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 3 }} />
              </Grid>
            ))}
          </Grid>
        ) : overview && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                      color: 'white',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="h3" fontWeight="bold">
                          {overview.analytics.totalTickets}
                        </Typography>
                        <Avatar sx={{ bgcolor: alpha('#ffffff', 0.2), color: 'white' }}>
                          <SupportIcon />
                        </Avatar>
                      </Box>
                      <Typography variant="body1" sx={{ opacity: 0.9 }}>
                        Total Tickets
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        +12% from last month
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        position: 'absolute',
                        bottom: -30,
                        right: -30,
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: alpha('#ffffff', 0.1)
                      }}
                    />
                  </Paper>
                </motion.div>
              </Grid>

              {}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                      color: 'white',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="h3" fontWeight="bold">
                          {overview.analytics.resolvedTickets}
                        </Typography>
                        <Avatar sx={{ bgcolor: alpha('#ffffff', 0.2), color: 'white' }}>
                          <TrendingUpIcon />
                        </Avatar>
                      </Box>
                      <Typography variant="body1" sx={{ opacity: 0.9 }}>
                        Resolved Tickets
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {Math.round((overview.analytics.resolvedTickets / overview.analytics.totalTickets) * 100)}% success rate
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        position: 'absolute',
                        bottom: -30,
                        right: -30,
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: alpha('#ffffff', 0.1)
                      }}
                    />
                  </Paper>
                </motion.div>
              </Grid>

              {}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                      color: 'white',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="h3" fontWeight="bold">
                          {overview.analytics.totalCustomers}
                        </Typography>
                        <Avatar sx={{ bgcolor: alpha('#ffffff', 0.2), color: 'white' }}>
                          <PeopleIcon />
                        </Avatar>
                      </Box>
                      <Typography variant="body1" sx={{ opacity: 0.9 }}>
                        Active Customers
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        +8% growth this month
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        position: 'absolute',
                        bottom: -30,
                        right: -30,
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: alpha('#ffffff', 0.1)
                      }}
                    />
                  </Paper>
                </motion.div>
              </Grid>

              {}
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <motion.div
                  whileHover={{ scale: 1.03, y: -5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 3,
                      background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
                      color: 'white',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="h3" fontWeight="bold">
                          {overview.knowledgeBase.totalFiles}
                        </Typography>
                        <Avatar sx={{ bgcolor: alpha('#ffffff', 0.2), color: 'white' }}>
                          <FileIcon />
                        </Avatar>
                      </Box>
                      <Typography variant="body1" sx={{ opacity: 0.9 }}>
                        Knowledge Files
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {overview.knowledgeBase.totalVectors ?? 0} total vectors
                      </Typography>
                    </Box>
                    <Box 
                      sx={{ 
                        position: 'absolute',
                        bottom: -30,
                        right: -30,
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: alpha('#ffffff', 0.1)
                      }}
                    />
                  </Paper>
                </motion.div>
              </Grid>
            </Grid>
          </motion.div>
        )}

        {}
        <Grid container spacing={3}>
          {}
          <Grid size={{ xs: 12, lg: 8 }}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box
                  sx={{
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.8)} 0%, ${alpha(theme.palette.primary.dark, 0.9)} 100%)`,
                    color: 'white',
                    p: 3
                  }}
                >
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h5" fontWeight="bold" gutterBottom>
                        Knowledge Base Management
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        Upload and manage your knowledge base files
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      startIcon={<UploadIcon />}
                      component="label"
                      disabled={uploading}
                      sx={{
                        bgcolor: alpha('#ffffff', 0.2),
                        color: 'white',
                        '&:hover': {
                          bgcolor: alpha('#ffffff', 0.3)
                        }
                      }}
                    >
                      Upload File
                      <input
                        type="file"
                        hidden
                        accept=".pdf,.txt,.md,.markdown"
                        onChange={handleFileSelect}
                      />
                    </Button>
                  </Box>
                </Box>

                <CardContent sx={{ p: 3 }}>
                  {}
                  <AnimatePresence>
                    {selectedFile && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Paper 
                          elevation={0}
                          sx={{ 
                            mb: 3, 
                            p: 3, 
                            bgcolor: alpha(theme.palette.primary.main, 0.05),
                            borderRadius: 2,
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                          }}
                        >
                          <Box display="flex" alignItems="center" mb={2}>
                            <FileIcon sx={{ mr: 2, color: theme.palette.primary.main }} />
                            <Box>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {selectedFile.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </Typography>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={2}>
                            <Button
                              variant="contained"
                              onClick={handleUpload}
                              disabled={uploading}
                              startIcon={<CloudUploadIcon />}
                              sx={{ borderRadius: 2 }}
                            >
                              {uploading ? 'Processing...' : 'Upload & Process'}
                            </Button>
                            <Button
                              variant="outlined"
                              onClick={() => setSelectedFile(null)}
                              disabled={uploading}
                              sx={{ borderRadius: 2 }}
                            >
                              Cancel
                            </Button>
                          </Stack>
                          {uploading && (
                            <Box mt={2}>
                              <LinearProgress sx={{ borderRadius: 1 }} />
                              <Typography variant="caption" color="text.secondary" mt={1}>
                                Processing file and creating vector embeddings...
                              </Typography>
                            </Box>
                          )}
                        </Paper>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {}
                  <Box>
                    {kbLoading ? (
                      <Stack spacing={2}>
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
                        ))}
                      </Stack>
                    ) : kbData?.knowledgeBases.length === 0 ? (
                      <Paper 
                        elevation={0}
                        sx={{ 
                          p: 6, 
                          textAlign: 'center',
                          bgcolor: alpha(theme.palette.grey[500], 0.05),
                          borderRadius: 2
                        }}
                      >
                        <StorageIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          No Knowledge Base Files
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Upload your first PDF, TXT, or Markdown file to get started
                        </Typography>
                      </Paper>
                    ) : (
                      <Stack spacing={2}>
                        {kbData?.knowledgeBases.map((kb, index) => (
                          <motion.div
                            key={kb._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                          >
                            <Paper
                              elevation={0}
                              sx={{
                                p: 3,
                                borderRadius: 2,
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                                '&:hover': {
                                  boxShadow: theme.shadows[4],
                                  transform: 'translateY(-2px)',
                                  transition: 'all 0.2s ease-in-out'
                                }
                              }}
                            >
                              <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Box flex={1}>
                                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                                    {kb.originalName || kb.filename}
                                  </Typography>
                                  <Stack direction="row" spacing={1} mb={1}>
                                    <Chip
                                      label={kb.category}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                      sx={{ borderRadius: 2 }}
                                    />
                                    <Chip
                                      label={`${kb.chunksCount ?? 0} chunks`}
                                      size="small"
                                      color="info"
                                      variant="outlined"
                                      sx={{ borderRadius: 2 }}
                                    />
                                    <Chip
                                      label={kb.fileType.toUpperCase()}
                                      size="small"
                                      color="secondary"
                                      variant="outlined"
                                      sx={{ borderRadius: 2 }}
                                    />
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary">
                                    Uploaded: {new Date(kb.createdAt || kb.updatedAt).toLocaleDateString()}
                                  </Typography>
                                </Box>
                                <IconButton
                                  onClick={(e) => handleMenuClick(e, kb)}
                                  sx={{ 
                                    '&:hover': { 
                                      bgcolor: alpha(theme.palette.primary.main, 0.1) 
                                    }
                                  }}
                                >
                                  <MoreVertIcon />
                                </IconButton>
                              </Box>
                            </Paper>
                          </motion.div>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Paper>
            </motion.div>
          </Grid>

          {}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Stack spacing={3}>
              {}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.8)} 0%, ${alpha(theme.palette.secondary.dark, 0.9)} 100%)`,
                      color: 'white',
                      p: 3
                    }}
                  >
                    <Typography variant="h6" fontWeight="bold">
                      Quick Actions
                    </Typography>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <Stack spacing={2}>
                      <Button
                        variant="outlined"
                        startIcon={<AnalyticsIcon />}
                        onClick={() => router.push('/company/analytics')}
                        fullWidth
                        sx={{ 
                          py: 1.5, 
                          borderRadius: 2,
                          '&:hover': {
                            transform: 'translateX(4px)',
                            transition: 'transform 0.2s ease'
                          }
                        }}
                      >
                        View Analytics Dashboard
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<TimelineIcon />}
                        onClick={() => router.push('/company/trends')}
                        fullWidth
                        sx={{ 
                          py: 1.5, 
                          borderRadius: 2,
                          '&:hover': {
                            transform: 'translateX(4px)',
                            transition: 'transform 0.2s ease'
                          }
                        }}
                      >
                        AI Trend Analysis
                      </Button>
                    </Stack>
                  </CardContent>
                </Paper>
              </motion.div>

              {}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <Paper elevation={0} sx={{ borderRadius: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      Performance Overview
                    </Typography>
                    {overview && (
                      <Stack spacing={3}>
                        <Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">Resolution Rate</Typography>
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {Math.round((overview.analytics.resolvedTickets / overview.analytics.totalTickets) * 100)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={(overview.analytics.resolvedTickets / overview.analytics.totalTickets) * 100}
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              bgcolor: alpha(theme.palette.success.main, 0.1),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`
                              }
                            }}
                          />
                        </Box>
                        
                        <Box>
                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2">Avg. Resolution Time</Typography>
                            <Typography variant="body2" fontWeight="bold" color="info.main">
                              {overview.analytics.avgResolutionTime}h
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={75}
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              bgcolor: alpha(theme.palette.info.main, 0.1),
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 4,
                                background: `linear-gradient(90deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`
                              }
                            }}
                          />
                        </Box>

                        <Divider />

                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                            AI Insights
                          </Typography>
                          <Paper 
                            elevation={0}
                            sx={{ 
                              p: 2, 
                              bgcolor: alpha(theme.palette.primary.main, 0.05),
                              borderRadius: 2
                            }}
                          >
                            <Box display="flex" alignItems="center" mb={1}>
                              <AIIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                              <Typography variant="caption" fontWeight="bold">
                                Performance Trending Up
                              </Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              Your response time has improved by 15% this week. Keep up the great work!
                            </Typography>
                          </Paper>
                        </Box>
                      </Stack>
                    )}
                  </CardContent>
                </Paper>
              </motion.div>
            </Stack>
          </Grid>
        </Grid>

        {}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              borderRadius: 2,
              boxShadow: theme.shadows[8]
            }
          }}
        >
          <MenuItem onClick={handleMenuClose} sx={{ borderRadius: 1 }}>
            <ListItemIcon>
              <ViewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View Details</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedKb) handleDeleteKb(selectedKb);
              handleMenuClose();
            }}
            sx={{ color: 'error.main', borderRadius: 1 }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete File</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
