import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Tooltip,
  LinearProgress,
  Avatar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  PlayArrow,
  Stop,
  Settings,
  Schedule,
  SmartToy,
  Telegram,
  Hub,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store';
import { useSocket } from '../contexts/SocketContext';
import { Agent } from '@n8n-agent-platform/shared';

const Agents: React.FC = () => {
  const { agents, setAgents } = useStore();
  const { emit, on, off } = useSocket();
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchAgents();

    // Listen for agent updates
    const handleAgentUpdate = (data: any) => {
      setAgents(data.agents);
    };

    on('agents:update', handleAgentUpdate);

    return () => {
      off('agents:update', handleAgentUpdate);
    };
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3456/api/agents');
      const data = await response.json();
      setAgents(data);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAgent = (agentId: string) => {
    emit('agent:start', { agentId });
  };

  const handleStopAgent = (agentId: string) => {
    emit('agent:stop', { agentId });
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (window.confirm('Are you sure you want to delete this agent?')) {
      try {
        await fetch(`http://localhost:3456/api/agents/${agentId}`, {
          method: 'DELETE',
        });
        fetchAgents();
      } catch (error) {
        console.error('Failed to delete agent:', error);
      }
    }
  };

  const handleCreateAgent = () => {
    setSelectedAgent(null);
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleSaveAgent = async (agentData: any) => {
    try {
      const url = editMode
        ? `http://localhost:3456/api/agents/${selectedAgent?.id}`
        : 'http://localhost:3456/api/agents';
      
      const method = editMode ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });
      
      setDialogOpen(false);
      fetchAgents();
    } catch (error) {
      console.error('Failed to save agent:', error);
    }
  };

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'mcp':
        return <SmartToy />;
      case 'telegram':
        return <Telegram />;
      case 'multi-agent':
        return <Hub />;
      default:
        return <SmartToy />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'idle':
        return 'warning';
      case 'processing':
        return 'info';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const AgentCard = ({ agent }: { agent: Agent }) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
          transition: 'all 0.3s ease',
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 48,
                  height: 48,
                }}
              >
                {getAgentIcon(agent.type)}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  {agent.name}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {agent.type.toUpperCase()} Agent
                </Typography>
              </Box>
            </Box>
            <Chip
              label={agent.status}
              color={getStatusColor(agent.status)}
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          </Box>

          <Box mb={2}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Configuration
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                icon={<Schedule />}
                label={`Schedule: ${agent.config.schedule || 'Manual'}`}
                size="small"
                variant="outlined"
              />
              {agent.config.autoFix && (
                <Chip
                  label="Auto-fix enabled"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>

          <Box>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Performance
            </Typography>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="caption">Workflows Processed</Typography>
              <Typography variant="caption" fontWeight="bold">
                {agent.stats?.workflowsProcessed || 0}
              </Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="caption">Optimizations Applied</Typography>
              <Typography variant="caption" fontWeight="bold">
                {agent.stats?.optimizationsApplied || 0}
              </Typography>
            </Box>
            <Box display="flex" justifyContent="space-between">
              <Typography variant="caption">Success Rate</Typography>
              <Typography variant="caption" fontWeight="bold">
                {agent.stats?.successRate || 0}%
              </Typography>
            </Box>
          </Box>
        </CardContent>

        <CardActions sx={{ p: 2, pt: 0 }}>
          <Box display="flex" gap={1} width="100%">
            {agent.status === 'idle' ? (
              <Tooltip title="Start Agent">
                <IconButton
                  color="success"
                  onClick={() => handleStartAgent(agent.id)}
                  size="small"
                >
                  <PlayArrow />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Stop Agent">
                <IconButton
                  color="error"
                  onClick={() => handleStopAgent(agent.id)}
                  size="small"
                >
                  <Stop />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Edit Agent">
              <IconButton
                color="primary"
                onClick={() => handleEditAgent(agent)}
                size="small"
              >
                <Edit />
              </IconButton>
            </Tooltip>
            <Tooltip title="Agent Settings">
              <IconButton size="small">
                <Settings />
              </IconButton>
            </Tooltip>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Delete Agent">
              <IconButton
                color="error"
                onClick={() => handleDeleteAgent(agent.id)}
                size="small"
              >
                <Delete />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
      </Card>
    </motion.div>
  );

  const AgentDialog = () => {
    const [formData, setFormData] = useState({
      name: selectedAgent?.name || '',
      type: selectedAgent?.type || 'mcp',
      config: {
        schedule: selectedAgent?.config.schedule || '*/30 * * * *',
        maxConcurrentWorkflows: selectedAgent?.config.maxConcurrentWorkflows || 5,
        autoFix: selectedAgent?.config.autoFix || false,
        notifyOnError: selectedAgent?.config.notifyOnError || true,
      },
    });

    const handleChange = (field: string, value: any) => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        setFormData({
          ...formData,
          [parent]: {
            ...formData.config,
            [child]: value,
          },
        });
      } else {
        setFormData({ ...formData, [field]: value });
      }
    };

    return (
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editMode ? 'Edit Agent' : 'Create New Agent'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Agent Name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              fullWidth
              required
            />
            
            <FormControl fullWidth>
              <InputLabel>Agent Type</InputLabel>
              <Select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                label="Agent Type"
              >
                <MenuItem value="mcp">MCP Agent</MenuItem>
                <MenuItem value="telegram">Telegram Agent</MenuItem>
                <MenuItem value="multi-agent">Multi-Agent System</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Schedule (Cron Expression)"
              value={formData.config.schedule}
              onChange={(e) => handleChange('config.schedule', e.target.value)}
              fullWidth
              helperText="e.g., */30 * * * * (every 30 minutes)"
            />

            <TextField
              label="Max Concurrent Workflows"
              type="number"
              value={formData.config.maxConcurrentWorkflows}
              onChange={(e) => handleChange('config.maxConcurrentWorkflows', parseInt(e.target.value))}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.config.autoFix}
                  onChange={(e) => handleChange('config.autoFix', e.target.checked)}
                />
              }
              label="Enable Auto-fix"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={formData.config.notifyOnError}
                  onChange={(e) => handleChange('config.notifyOnError', e.target.checked)}
                />
              }
              label="Notify on Error"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={() => handleSaveAgent(formData)} variant="contained">
            {editMode ? 'Update' : 'Create'}
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
          Agents
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateAgent}
          sx={{
            background: 'linear-gradient(45deg, #ff6d00 30%, #ff9800 90%)',
            boxShadow: '0 3px 5px 2px rgba(255, 105, 0, .3)',
          }}
        >
          Create Agent
        </Button>
      </Box>

      <Grid container spacing={3}>
        <AnimatePresence>
          {agents.map((agent) => (
            <Grid item xs={12} sm={6} md={4} key={agent.id}>
              <AgentCard agent={agent} />
            </Grid>
          ))}
        </AnimatePresence>
      </Grid>

      {agents.length === 0 && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight={400}
        >
          <SmartToy sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="textSecondary" mb={2}>
            No agents created yet
          </Typography>
          <Button variant="contained" startIcon={<Add />} onClick={handleCreateAgent}>
            Create Your First Agent
          </Button>
        </Box>
      )}

      <AgentDialog />
    </Box>
  );
};

export default Agents;