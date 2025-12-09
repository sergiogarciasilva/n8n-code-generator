import React from 'react';
import { Box, Typography, Avatar, Chip, LinearProgress, Grid } from '@mui/material';
import { SmartToy, CheckCircle, Warning, Error, Schedule } from '@mui/icons-material';
import { useStore } from '../../../store';

const AgentStatusWidget: React.FC = () => {
  const { agents } = useStore();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle sx={{ fontSize: 16 }} />;
      case 'idle':
        return <Schedule sx={{ fontSize: 16 }} />;
      case 'error':
        return <Error sx={{ fontSize: 16 }} />;
      default:
        return <Warning sx={{ fontSize: 16 }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'idle':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // Mock data if no agents
  const displayAgents = agents.length > 0 ? agents : [
    { id: '1', name: 'MCP Agent 1', type: 'mcp', status: 'active', stats: { workflowsProcessed: 145 } },
    { id: '2', name: 'Telegram Agent', type: 'telegram', status: 'idle', stats: { workflowsProcessed: 89 } },
    { id: '3', name: 'Multi-Agent System', type: 'multi-agent', status: 'active', stats: { workflowsProcessed: 67 } },
  ];

  const activeCount = displayAgents.filter(a => a.status === 'active').length;
  const totalCount = displayAgents.length;

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Agent Status</Typography>
        <Chip
          label={`${activeCount}/${totalCount} Active`}
          color="primary"
          size="small"
        />
      </Box>

      <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
        <Grid container spacing={1}>
          {displayAgents.slice(0, 4).map((agent) => (
            <Grid item xs={12} key={agent.id}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'background.default',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: `${getStatusColor(agent.status)}.light`,
                  }}
                >
                  <SmartToy sx={{ fontSize: 20 }} />
                </Avatar>
                
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight="medium" noWrap>
                      {agent.name}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(agent.status)}
                      label={agent.status}
                      color={getStatusColor(agent.status) as any}
                      size="small"
                      sx={{ height: 20 }}
                    />
                  </Box>
                  <Typography variant="caption" color="textSecondary">
                    {agent.stats?.workflowsProcessed || 0} workflows processed
                  </Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      {totalCount > 4 && (
        <Typography
          variant="caption"
          color="primary"
          sx={{ mt: 1, cursor: 'pointer', textAlign: 'center' }}
        >
          +{totalCount - 4} more agents
        </Typography>
      )}
    </Box>
  );
};

export default AgentStatusWidget;