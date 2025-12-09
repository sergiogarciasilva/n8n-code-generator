import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const WorkflowPerformanceWidget: React.FC = () => {
  const data = [
    { time: '00:00', workflows: 12, optimizations: 8, errors: 2 },
    { time: '04:00', workflows: 25, optimizations: 20, errors: 3 },
    { time: '08:00', workflows: 45, optimizations: 38, errors: 4 },
    { time: '12:00', workflows: 68, optimizations: 55, errors: 5 },
    { time: '16:00', workflows: 82, optimizations: 71, errors: 6 },
    { time: '20:00', workflows: 95, optimizations: 85, errors: 7 },
    { time: '24:00', workflows: 105, optimizations: 92, errors: 8 },
  ];

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" gutterBottom>
        Workflow Performance
      </Typography>
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="workflows"
              stackId="1"
              stroke="#ff6d00"
              fill="#ff6d00"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="optimizations"
              stackId="1"
              stroke="#1976d2"
              fill="#1976d2"
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="errors"
              stackId="1"
              stroke="#f44336"
              fill="#f44336"
              fillOpacity={0.6}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

export default WorkflowPerformanceWidget;