import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Avatar,
} from '@mui/material';
import {
  AutoFixHigh,
  CheckCircle,
  Error,
  Warning,
  Info,
} from '@mui/icons-material';
import { useStore } from '../../../store';

const RecentActivityWidget: React.FC = () => {
  const { recentActivity } = useStore();

  // Mock data if no activity
  const activities = recentActivity.length > 0 ? recentActivity : [
    {
      id: '1',
      type: 'workflow_change',
      title: 'Workflow Optimized',
      description: 'Customer Onboarding Flow',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      severity: 'success',
      agentId: 'MCP Agent 1',
    },
    {
      id: '2',
      type: 'error',
      title: 'Agent Error',
      description: 'Multi-Agent System encountered an error',
      timestamp: new Date(Date.now() - 1000 * 60 * 15),
      severity: 'error',
    },
    {
      id: '3',
      type: 'suggestion',
      title: 'New Optimization',
      description: '5 suggestions for Data Pipeline',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      severity: 'info',
    },
  ];

  const getActivityIcon = (type: string, severity: string) => {
    switch (type) {
      case 'workflow_change':
        return <AutoFixHigh />;
      case 'error':
        return <Error />;
      case 'warning':
        return <Warning />;
      case 'suggestion':
        return <Info />;
      default:
        return <CheckCircle />;
    }
  };

  const getActivityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'success.main';
      case 'error':
        return 'error.main';
      case 'warning':
        return 'warning.main';
      default:
        return 'info.main';
    }
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Recent Activity
      </Typography>
      
      <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
        {activities.slice(0, 5).map((activity) => (
          <ListItem
            key={activity.id}
            sx={{
              px: 0,
              py: 1,
              borderBottom: 1,
              borderColor: 'divider',
              '&:last-child': { borderBottom: 0 },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: `${getActivityColor(activity.severity)}15`,
                }}
              >
                {React.cloneElement(getActivityIcon(activity.type, activity.severity), {
                  sx: { fontSize: 18, color: getActivityColor(activity.severity) },
                })}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="body2" fontWeight="medium">
                    {activity.title}
                  </Typography>
                  {activity.agentId && (
                    <Chip label={activity.agentId} size="small" variant="outlined" />
                  )}
                </Box>
              }
              secondary={
                <>
                  <Typography variant="caption" color="textSecondary">
                    {activity.description}
                  </Typography>
                  <Typography variant="caption" color="textSecondary" display="block">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </Typography>
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default RecentActivityWidget;