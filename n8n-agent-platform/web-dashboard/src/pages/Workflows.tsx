import React, { useState, useEffect, Fragment } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Tooltip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Search,
  FilterList,
  Refresh,
  PlayArrow,
  AutoFixHigh,
  Info,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  TrendingUp,
  AccessTime,
  Code,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { useSocket } from '../contexts/SocketContext';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Workflow {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'error';
  lastRun: string;
  successRate: number;
  avgExecutionTime: number;
  optimizationScore: number;
  suggestions: number;
  tags: string[];
}

const Workflows: React.FC = () => {
  const { selectedWorkflow, setSelectedWorkflow } = useStore();
  const { emit, on, off } = useSocket();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [selectedWorkflowDetails, setSelectedWorkflowDetails] = useState<any>(null);

  useEffect(() => {
    fetchWorkflows();

    const handleWorkflowUpdate = (data: any) => {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === data.workflowId ? { ...w, ...data.updates } : w))
      );
    };

    on('workflow:update', handleWorkflowUpdate);

    return () => {
      off('workflow:update', handleWorkflowUpdate);
    };
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      // Get auth token
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('http://localhost:3456/api/v1/workflows', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workflows');
      }

      const data = await response.json();
      
      // Transform backend data to match frontend interface
      const transformedWorkflows: Workflow[] = data.workflows.map((w: any) => ({
        id: w.id,
        name: w.name,
        type: w.type || 'multi-agent',
        status: w.active ? 'active' : 'inactive',
        lastRun: w.last_execution_at || new Date().toISOString(),
        successRate: w.success_rate || 0,
        avgExecutionTime: w.avg_execution_time || 0,
        optimizationScore: w.optimization_score || 0,
        suggestions: w.optimization_suggestions?.length || 0,
        tags: w.tags || []
      }));
      
      setWorkflows(transformedWorkflows);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
      // Use mock data as fallback for development
      const mockWorkflows: Workflow[] = [
        {
          id: '1',
          name: 'Customer Onboarding Flow',
          type: 'mcp',
          status: 'active',
          lastRun: '2024-01-20T10:30:00Z',
          successRate: 95.5,
          avgExecutionTime: 2.3,
          optimizationScore: 82,
          suggestions: 3,
          tags: ['customer', 'onboarding', 'automation'],
        },
        {
          id: '2',
          name: 'Telegram Bot Handler',
          type: 'telegram',
          status: 'active',
          lastRun: '2024-01-20T11:15:00Z',
          successRate: 98.2,
          avgExecutionTime: 1.1,
          optimizationScore: 91,
          suggestions: 1,
          tags: ['telegram', 'bot', 'messaging'],
        },
        {
          id: '3',
          name: 'Data Processing Pipeline',
          type: 'multi-agent',
          status: 'error',
          lastRun: '2024-01-20T09:45:00Z',
          successRate: 76.3,
          avgExecutionTime: 5.7,
          optimizationScore: 65,
          suggestions: 7,
          tags: ['data', 'pipeline', 'processing'],
        },
      ];
      
      setWorkflows(mockWorkflows);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async (workflowId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`http://localhost:3456/api/v1/workflows/${workflowId}/optimize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to optimize workflow');
      }

      const result = await response.json();
      
      // Emit success event for real-time updates
      emit('workflow:optimized', { workflowId, result });
      
      // Refresh workflows to show updated optimization score
      await fetchWorkflows();
    } catch (error) {
      console.error('Failed to optimize workflow:', error);
      emit('workflow:error', { workflowId, error: error.message });
    }
  };

  const handleRunWorkflow = async (workflowId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`http://localhost:3456/api/v1/workflows/${workflowId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error('Failed to run workflow');
      }

      const result = await response.json();
      
      // Emit success event for real-time updates
      emit('workflow:executed', { workflowId, executionId: result.executionId });
      
      // Update workflow status
      setWorkflows(prev => prev.map(w => 
        w.id === workflowId ? { ...w, lastRun: new Date().toISOString() } : w
      ));
    } catch (error) {
      console.error('Failed to run workflow:', error);
      emit('workflow:error', { workflowId, error: error.message });
    }
  };

  const handleViewDetails = async (workflow: Workflow) => {
    setSelectedWorkflowDetails(workflow);
    setDetailsDialog(true);
    
    // Fetch additional details
    try {
      const token = localStorage.getItem('auth_token');
      
      // Fetch multiple endpoints in parallel for comprehensive details
      const [analysisResponse, anomaliesResponse, predictionsResponse] = await Promise.all([
        fetch(`http://localhost:3456/api/v1/workflows/${workflow.id}/analysis`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`http://localhost:3456/api/v1/workflows/${workflow.id}/anomalies`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`http://localhost:3456/api/v1/workflows/${workflow.id}/predict-failures`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      const analysis = analysisResponse.ok ? await analysisResponse.json() : null;
      const anomalies = anomaliesResponse.ok ? await anomaliesResponse.json() : null;
      const predictions = predictionsResponse.ok ? await predictionsResponse.json() : null;
      
      setSelectedWorkflowDetails({ 
        ...workflow, 
        analysis,
        anomalies: anomalies?.anomalies || [],
        predictions: predictions || {}
      });
    } catch (error) {
      console.error('Failed to fetch workflow details:', error);
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' | 'primary' | 'secondary' | 'info' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const getOptimizationColor = (score: number) => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  const filteredWorkflows = workflows.filter((workflow) => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || workflow.type === filterType;
    return matchesSearch && matchesType;
  });

  const WorkflowCard = ({ workflow }: { workflow: Workflow }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          height: '100%',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
          transition: 'all 0.3s ease',
          border: selectedWorkflow === workflow.id ? '2px solid' : 'none',
          borderColor: 'primary.main',
        }}
        onClick={() => setSelectedWorkflow(workflow.id)}
      >
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
            <Box>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                {workflow.name}
              </Typography>
              <Box display="flex" gap={1} mb={1}>
                <Chip
                  label={workflow.status}
                  color={getStatusColor(workflow.status)}
                  size="small"
                />
                <Chip
                  label={workflow.type.toUpperCase()}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>
            <Box display="flex" gap={0.5}>
              <Tooltip title="Run Workflow">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRunWorkflow(workflow.id);
                  }}
                >
                  <PlayArrow />
                </IconButton>
              </Tooltip>
              <Tooltip title="Optimize">
                <IconButton
                  size="small"
                  color="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOptimize(workflow.id);
                  }}
                >
                  <AutoFixHigh />
                </IconButton>
              </Tooltip>
              <Tooltip title="View Details">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(workflow);
                  }}
                >
                  <Info />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Success Rate
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h6" fontWeight="bold">
                    {workflow.successRate}%
                  </Typography>
                  {workflow.successRate >= 90 ? (
                    <CheckCircle color="success" fontSize="small" />
                  ) : workflow.successRate >= 70 ? (
                    <Warning color="warning" fontSize="small" />
                  ) : (
                    <ErrorIcon color="error" fontSize="small" />
                  )}
                </Box>
              </Box>
            </Grid>
            <Grid item xs={6}>
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Avg. Execution
                </Typography>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="h6" fontWeight="bold">
                    {workflow.avgExecutionTime}s
                  </Typography>
                  <AccessTime fontSize="small" color="action" />
                </Box>
              </Box>
            </Grid>
          </Grid>

          <Box mt={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="caption" color="textSecondary">
                Optimization Score
              </Typography>
              <Typography variant="caption" fontWeight="bold">
                {workflow.optimizationScore}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={workflow.optimizationScore}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'grey.200',
                '& .MuiLinearProgress-bar': {
                  bgcolor: getOptimizationColor(workflow.optimizationScore),
                  borderRadius: 4,
                },
              }}
            />
          </Box>

          {workflow.suggestions > 0 && (
            <Box mt={2} display="flex" alignItems="center" gap={1}>
              <TrendingUp color="info" fontSize="small" />
              <Typography variant="body2" color="info.main">
                {workflow.suggestions} optimization suggestions available
              </Typography>
            </Box>
          )}

          <Box mt={2} display="flex" gap={0.5} flexWrap="wrap">
            {workflow.tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );

  const WorkflowDetailsDialog = () => {
    if (!selectedWorkflowDetails) return null;

    const performanceData = [
      { date: 'Mon', executions: 45, errors: 2 },
      { date: 'Tue', executions: 52, errors: 1 },
      { date: 'Wed', executions: 48, errors: 3 },
      { date: 'Thu', executions: 61, errors: 0 },
      { date: 'Fri', executions: 55, errors: 2 },
      { date: 'Sat', executions: 38, errors: 1 },
      { date: 'Sun', executions: 42, errors: 0 },
    ];

    return (
      <Dialog
        open={detailsDialog}
        onClose={() => setDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{selectedWorkflowDetails.name}</Typography>
            <Chip
              label={selectedWorkflowDetails.status}
              color={getStatusColor(selectedWorkflowDetails.status)}
              size="small"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Performance Overview
            </Typography>
            <Paper sx={{ p: 2, mb: 3 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="executions" fill="#1976d2" />
                  <Bar dataKey="errors" fill="#f44336" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <Typography variant="subtitle2" gutterBottom>
              Optimization Suggestions
            </Typography>
            <List>
              {selectedWorkflowDetails.analysis?.suggestions ? (
                selectedWorkflowDetails.analysis.suggestions.map((suggestion: any, index: number) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {suggestion.type === 'performance' ? (
                          <AutoFixHigh color="primary" />
                        ) : suggestion.type === 'code' ? (
                          <Code color="secondary" />
                        ) : (
                          <TrendingUp color="info" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={suggestion.title}
                        secondary={suggestion.description}
                      />
                    </ListItem>
                    {index < selectedWorkflowDetails.analysis.suggestions.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              ) : (
                <>
                  <ListItem>
                    <ListItemIcon>
                      <AutoFixHigh color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Reduce API calls in loop"
                      secondary="Batch API requests to improve performance by 40%"
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <Code color="secondary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Optimize data transformation"
                      secondary="Use native array methods instead of lodash for 20% speed improvement"
                    />
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemIcon>
                      <TrendingUp color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Add error handling"
                      secondary="Implement retry logic for external API failures"
                    />
                  </ListItem>
                </>
              )}
            </List>

            {selectedWorkflowDetails.anomalies && selectedWorkflowDetails.anomalies.length > 0 && (
              <>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                  Detected Anomalies
                </Typography>
                <List>
                  {selectedWorkflowDetails.anomalies.map((anomaly: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <Warning color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={anomaly.type}
                        secondary={anomaly.description}
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {selectedWorkflowDetails.predictions && selectedWorkflowDetails.predictions.failureProbability && (
              <>
                <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                  Failure Predictions
                </Typography>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Failure probability in next 24h: 
                    <Typography component="span" variant="h6" color={
                      selectedWorkflowDetails.predictions.failureProbability > 0.5 ? 'error' : 'success'
                    }>
                      {' '}{(selectedWorkflowDetails.predictions.failureProbability * 100).toFixed(1)}%
                    </Typography>
                  </Typography>
                  {selectedWorkflowDetails.predictions.riskFactors && (
                    <Box mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        Risk factors: {selectedWorkflowDetails.predictions.riskFactors.join(', ')}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<AutoFixHigh />}
            onClick={() => {
              handleOptimize(selectedWorkflowDetails.id);
              setDetailsDialog(false);
            }}
          >
            Apply Optimizations
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <Box sx={{ width: '100%', mt: 4 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Workflows
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="mcp">MCP</MenuItem>
              <MenuItem value="telegram">Telegram</MenuItem>
              <MenuItem value="multi-agent">Multi-Agent</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={fetchWorkflows}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {filteredWorkflows.map((workflow) => (
          <Grid item xs={12} md={6} lg={4} key={workflow.id}>
            <WorkflowCard workflow={workflow} />
          </Grid>
        ))}
      </Grid>

      {filteredWorkflows.length === 0 && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight={400}
        >
          <Typography variant="h6" color="textSecondary">
            No workflows found
          </Typography>
        </Box>
      )}

      <WorkflowDetailsDialog />
    </Box>
  );
};

export default Workflows;