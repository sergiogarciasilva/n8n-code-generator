import React from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Grid,
  Paper,
  Chip,
} from '@mui/material';
import {
  Memory,
  Storage,
  Speed,
  Api,
  CheckCircle,
  Warning,
} from '@mui/icons-material';

const SystemHealthWidget: React.FC = () => {
  const healthMetrics = [
    { label: 'CPU Usage', value: 65, icon: <Speed />, status: 'healthy' },
    { label: 'Memory', value: 72, icon: <Memory />, status: 'warning' },
    { label: 'Storage', value: 45, icon: <Storage />, status: 'healthy' },
    { label: 'API Calls', value: 85, icon: <Api />, status: 'critical' },
  ];

  const getStatusColor = (value: number) => {
    if (value >= 80) return '#f44336';
    if (value >= 60) return '#ff9800';
    return '#4caf50';
  };

  const getStatus = (value: number) => {
    if (value >= 80) return 'critical';
    if (value >= 60) return 'warning';
    return 'healthy';
  };

  const overallHealth = Math.round(
    healthMetrics.reduce((acc, metric) => acc + metric.value, 0) / healthMetrics.length
  );

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">System Health</Typography>
        <Chip
          icon={overallHealth < 60 ? <CheckCircle /> : <Warning />}
          label={`${overallHealth}% Overall`}
          color={overallHealth < 60 ? 'success' : 'warning'}
          size="small"
        />
      </Box>

      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        {healthMetrics.map((metric) => (
          <Grid item xs={6} key={metric.label}>
            <Paper
              sx={{
                p: 2,
                height: '100%',
                bgcolor: 'background.default',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box sx={{ position: 'relative', display: 'inline-flex', mb: 1 }}>
                <CircularProgress
                  variant="determinate"
                  value={metric.value}
                  size={60}
                  thickness={5}
                  sx={{
                    color: getStatusColor(metric.value),
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round',
                    },
                  }}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {React.cloneElement(metric.icon, {
                    sx: { fontSize: 24, color: getStatusColor(metric.value) },
                  })}
                </Box>
              </Box>
              
              <Typography variant="caption" color="textSecondary">
                {metric.label}
              </Typography>
              <Typography variant="body2" fontWeight="bold">
                {metric.value}%
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default SystemHealthWidget;