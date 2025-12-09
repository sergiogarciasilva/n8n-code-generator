import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Button,
  Avatar,
  AvatarGroup,
  Grid,
} from '@mui/material';
import {
  Search,
  FilterList,
  Refresh,
  AutoFixHigh,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
  Info,
  PlayArrow,
  Stop,
  Code,
  Timeline as TimelineIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { useSocket } from '../contexts/SocketContext';

interface ActivityItem {
  id: string;
  type: 'workflow_change' | 'agent_action' | 'optimization' | 'error' | 'system';
  title: string;
  description: string;
  timestamp: string;
  agentId?: string;
  workflowId?: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  metadata?: any;
}

const Activity: React.FC = () => {
  const { recentActivity } = useStore();
  const { emit, on, off } = useSocket();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchActivities();

    const handleNewActivity = (activity: ActivityItem) => {
      setActivities((prev) => [activity, ...prev].slice(0, 100));
    };

    on('activity:new', handleNewActivity);

    return () => {
      off('activity:new', handleNewActivity);
    };
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration
      const mockActivities: ActivityItem[] = [
        {
          id: '1',
          type: 'workflow_change',
          title: 'Workflow Optimized',
          description: 'Customer Onboarding Flow optimized by MCP Agent',
          timestamp: '2024-01-20T12:30:00Z',
          agentId: 'agent-1',
          workflowId: 'workflow-1',
          severity: 'success',
          metadata: { improvements: 3, performanceGain: '25%' },
        },
        {
          id: '2',
          type: 'agent_action',
          title: 'Agent Started',
          description: 'Telegram Bot Agent started processing workflows',
          timestamp: '2024-01-20T12:25:00Z',
          agentId: 'agent-2',
          severity: 'info',
        },
        {
          id: '3',
          type: 'error',
          title: 'Workflow Error',
          description: 'Data Processing Pipeline encountered an error',
          timestamp: '2024-01-20T12:20:00Z',
          workflowId: 'workflow-3',
          severity: 'error',
          metadata: { error: 'API timeout', retries: 3 },
        },
        {
          id: '4',
          type: 'optimization',
          title: 'Optimization Suggestion',
          description: '5 new optimization suggestions generated',
          timestamp: '2024-01-20T12:15:00Z',
          agentId: 'agent-1',
          severity: 'info',
        },
        {
          id: '5',
          type: 'system',
          title: 'System Update',
          description: 'Platform updated to version 1.2.0',
          timestamp: '2024-01-20T12:00:00Z',
          severity: 'info',
        },
      ];

      setActivities(mockActivities);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string, severity: string) => {
    switch (type) {
      case 'workflow_change':
        return <AutoFixHigh />;
      case 'agent_action':
        return severity === 'success' ? <PlayArrow /> : <Stop />;
      case 'optimization':
        return <Code />;
      case 'error':
        return <ErrorIcon />;
      case 'system':
        return <Info />;
      default:
        return <TimelineIcon />;
    }
  };

  const getActivityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'primary';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  const filteredActivities = activities.filter((activity) => {
    const matchesSearch = 
      activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || activity.type === filterType;
    return matchesSearch && matchesType;
  });

  const ActivityStats = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <CheckCircle color="success" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">
            {activities.filter(a => a.severity === 'success').length}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Successful Actions
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Warning color="warning" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">
            {activities.filter(a => a.severity === 'warning').length}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Warnings
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <ErrorIcon color="error" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">
            {activities.filter(a => a.severity === 'error').length}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Errors
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Info color="info" sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="h5" fontWeight="bold">
            {activities.filter(a => a.severity === 'info').length}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Information
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Activity Timeline
        </Typography>
        <Box display="flex" gap={2}>
          <TextField
            placeholder="Search activities..."
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
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Activity Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Activity Type"
            >
              <MenuItem value="all">All Activities</MenuItem>
              <MenuItem value="workflow_change">Workflow Changes</MenuItem>
              <MenuItem value="agent_action">Agent Actions</MenuItem>
              <MenuItem value="optimization">Optimizations</MenuItem>
              <MenuItem value="error">Errors</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={fetchActivities}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      <ActivityStats />

      <Card>
        <CardContent>
          <Timeline position="right">
            {filteredActivities.map((activity, index) => (
              <TimelineItem key={activity.id}>
                <TimelineOppositeContent
                  sx={{ m: 'auto 0' }}
                  align="right"
                  variant="body2"
                  color="text.secondary"
                >
                  {formatTimestamp(activity.timestamp)}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineConnector sx={{ bgcolor: 'grey.300' }} />
                  <TimelineDot color={getActivityColor(activity.severity)}>
                    {getActivityIcon(activity.type, activity.severity)}
                  </TimelineDot>
                  <TimelineConnector sx={{ bgcolor: 'grey.300' }} />
                </TimelineSeparator>
                <TimelineContent sx={{ py: '12px', px: 2 }}>
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Paper
                      elevation={3}
                      sx={{
                        p: 2,
                        '&:hover': {
                          boxShadow: 4,
                          transform: 'translateX(4px)',
                        },
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="h6" component="span">
                            {activity.title}
                          </Typography>
                          <Typography variant="body2" color="textSecondary" sx={{ mt: 0.5 }}>
                            {activity.description}
                          </Typography>
                          {activity.metadata && (
                            <Box mt={1} display="flex" gap={1}>
                              {Object.entries(activity.metadata).map(([key, value]) => (
                                <Chip
                                  key={key}
                                  label={`${key}: ${value}`}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                        <Box display="flex" gap={1}>
                          {activity.agentId && (
                            <Chip
                              label={`Agent: ${activity.agentId}`}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          )}
                          {activity.workflowId && (
                            <Chip
                              label={`Workflow: ${activity.workflowId}`}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  </motion.div>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>

          {filteredActivities.length === 0 && (
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minHeight={200}
            >
              <TimelineIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="textSecondary">
                No activities found
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Activity;