'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  LinearProgress,
  IconButton,
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { trpc } from '../../trpc/client';
import { useAuthStore } from '../../store/authStore';

interface UploadedFile {
  file: File;
  category: string;
  uploading: boolean;
  uploaded: boolean;
  error?: string;
}

export default function UploadKnowledgeBasePage() {
  const router = useRouter();
  const { user, setAuth } = useAuthStore();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const refreshTokenMutation = trpc.auth.refreshCompanyToken.useMutation();

  
  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'company') {
      router.push('/dashboard');
      return;
    }

    
    if (user.requiresKnowledgeBase === false) {
      router.push('/company');
      return;
    }
  }, [user, router]);  const uploadKnowledgeBaseMutation = trpc.companyDashboard.uploadKnowledgeBase.useMutation({
    onSuccess: async (data) => {
      setUploadedFiles(prev => prev.map(f => ({ ...f, uploading: false, uploaded: true })));
      
      
      if (data.shouldRefreshToken && user?.id) {
        try {
          const refreshResult = await refreshTokenMutation.mutateAsync({
            companyId: user.id
          });
          
          if (refreshResult.success) {
            setAuth(
              refreshResult.token,
              {
                ...refreshResult.user,
                role: refreshResult.user.role as 'customer' | 'agent' | 'company',
                picture: refreshResult.user.picture ?? undefined,
              }
            );
          }
        } catch (error) {
          console.error('Failed to refresh token:', error);
        }
        
        setTimeout(() => {
          router.push('/company');
        }, 2000);
      }
    },
    onError: (error) => {
      setError(error.message);
      setUploadedFiles(prev => prev.map(f => ({ ...f, uploading: false, error: error.message })));
    }
  });

  const handleFileUpload = useCallback((files: File[]) => {
    const validFiles = files.filter(file => {
      const isValidType = file.type === 'application/pdf' || 
                         file.type === 'text/plain' || 
                         file.name.endsWith('.md') || 
                         file.name.endsWith('.markdown');
      const isValidSize = file.size <= 10 * 1024 * 1024; 
      return isValidType && isValidSize;
    });

    const newFiles = validFiles.map(file => ({
      file,
      category: 'General Knowledge',
      uploading: false,
      uploaded: false
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  }, [handleFileUpload]);

  const uploadFiles = async () => {
    if (!user?.id || uploadedFiles.length === 0) return;

    for (const fileData of uploadedFiles) {
      if (!fileData.uploaded && !fileData.uploading) {
        setUploadedFiles(prev => prev.map(f => 
          f.file === fileData.file ? { ...f, uploading: true } : f
        ));

        try {
          
          const arrayBuffer = await fileData.file.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);

          await uploadKnowledgeBaseMutation.mutateAsync({
            companyId: user.id,
            category: fileData.category,
            fileData: {
              originalname: fileData.file.name,
              mimetype: fileData.file.type,
              buffer: buffer,
              size: fileData.file.size
            }
          });
        } catch (error) {
          console.error('Upload failed:', error);
        }
      }
    }
  };

  if (!user || user.role !== 'company') {
    return <CircularProgress />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 4,
            maxWidth: 600,
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Typography variant="h4" sx={{ mb: 2, textAlign: 'center', fontWeight: 700 }}>
            Complete Your Registration
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
            To activate your company account, please upload at least one knowledge base file. 
            This helps our AI provide better support to your customers.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Paper
            sx={{
              p: 3,
              border: `2px dashed ${isDragging ? 'primary.main' : 'grey.300'}`,
              borderRadius: 2,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.3s',
              backgroundColor: isDragging ? 'action.hover' : 'transparent',
              mb: 2
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.accept = '.pdf,.txt,.md,.markdown';
              input.onchange = (e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                handleFileUpload(files);
              };
              input.click();
            }}
          >
            <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>
              Drop files here or click to browse
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supported formats: PDF, TXT, Markdown (Max 10MB each)
            </Typography>
          </Paper>

          {uploadedFiles.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Files to upload:
              </Typography>
              {uploadedFiles.map((file, index) => (
                <Box
                  key={index}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    border: 1,
                    borderColor: 'grey.300',
                    borderRadius: 1,
                    mb: 1
                  }}
                >
                  <Typography variant="body2">{file.file.name}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {file.uploading && <CircularProgress size={16} />}
                    {file.uploaded && <CheckCircleIcon color="success" />}
                    {file.error && <Typography variant="caption" color="error">{file.error}</Typography>}
                    <IconButton
                      size="small"
                      onClick={() => {
                        setUploadedFiles(prev => prev.filter((_, i) => i !== index));
                      }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Box>
                </Box>
              ))}

              {uploadedFiles.length > 0 && !uploadedFiles.every(f => f.uploaded) && (
                <Button
                  fullWidth
                  variant="contained"
                  onClick={uploadFiles}
                  disabled={uploadKnowledgeBaseMutation.isPending}
                  sx={{
                    mt: 2,
                    py: 1.5,
                    background: 'linear-gradient(45deg, #7C3AED, #10B981)',
                  }}
                >
                  {uploadKnowledgeBaseMutation.isPending ? 'Uploading...' : 'Upload Files'}
                </Button>
              )}
            </Box>
          )}

          {uploadedFiles.some(f => f.uploaded) && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Knowledge base uploaded successfully! Redirecting to your dashboard...
            </Alert>
          )}
        </Paper>
      </Box>
    </motion.div>
  );
}
