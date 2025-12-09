import React from 'react';
import { Box, Typography, Grid, Paper, Chip } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { motion } from 'framer-motion';

const MetricsWidget: React.FC = () => {
  const metrics = [
    { label: 'Total Workflows', value: '1,234', change: 12, color: '#ff6d00' },
    { label: 'Success Rate', value: '94.2%', change: 3, color: '#4caf50' },
    { label: 'Avg Response', value: '1.8s', change: -15, color: '#1976d2' },
    { label: 'Active Agents', value: '8', change: 0, color: '#9c27b0' },
  ];

  return (
    <Box sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        Key Metrics
      </Typography>
      <Grid container spacing={2} sx={{ height: 'calc(100% - 40px)' }}>
        {metrics.map((metric, index) => (
          <Grid item xs={6} key={metric.label}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              style={{ height: '100%' }}
            >
              <Paper
                sx={{
                  p: 2,
                  height: '100%',
                  bgcolor: `${metric.color}10`,
                  border: `1px solid ${metric.color}30`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="caption" color="textSecondary">
                  {metric.label}
                </Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ color: metric.color }}>
                  {metric.value}
                </Typography>
                {metric.change !== 0 && (
                  <Box display="flex" alignItems="center" mt={1}>
                    {metric.change > 0 ? (
                      <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                    ) : (
                      <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                    )}
                    <Typography
                      variant="caption"
                      sx={{
                        color: metric.change > 0 ? 'success.main' : 'error.main',
                        ml: 0.5,
                      }}
                    >
                      {Math.abs(metric.change)}%
                    </Typography>
                  </Box>
                )}
              </Paper>
            </motion.div>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default MetricsWidget;