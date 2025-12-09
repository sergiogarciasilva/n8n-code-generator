import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Speed,
  CheckCircle,
  Timeline,
  DonutLarge,
  BarChart as BarChartIcon,
  ShowChart,
  SmartToy,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { useStore } from '../store';

const COLORS = ['#ff6d00', '#1976d2', '#4caf50', '#f44336', '#ff9800', '#9c27b0'];

const Metrics: React.FC = () => {
  const { metrics } = useStore();
  const [timeRange, setTimeRange] = useState('7d');
  const [viewType, setViewType] = useState('overview');

  // Mock data for different metrics
  const performanceData = [
    { date: '01/14', workflows: 145, optimizations: 98, errors: 12, successRate: 91.7 },
    { date: '01/15', workflows: 162, optimizations: 112, errors: 8, successRate: 93.8 },
    { date: '01/16', workflows: 178, optimizations: 134, errors: 15, successRate: 91.6 },
    { date: '01/17', workflows: 195, optimizations: 145, errors: 10, successRate: 94.9 },
    { date: '01/18', workflows: 188, optimizations: 158, errors: 6, successRate: 96.8 },
    { date: '01/19', workflows: 201, optimizations: 172, errors: 9, successRate: 95.5 },
    { date: '01/20', workflows: 215, optimizations: 189, errors: 11, successRate: 94.9 },
  ];

  const agentPerformance = [
    { agent: 'MCP Agent 1', workflows: 450, optimizations: 380, successRate: 92 },
    { agent: 'Telegram Agent', workflows: 320, optimizations: 285, successRate: 89 },
    { agent: 'Multi-Agent 1', workflows: 280, optimizations: 245, successRate: 87 },
    { agent: 'MCP Agent 2', workflows: 390, optimizations: 350, successRate: 90 },
  ];

  const workflowTypes = [
    { name: 'Data Processing', value: 35, optimized: 28 },
    { name: 'API Integration', value: 25, optimized: 22 },
    { name: 'Automation', value: 20, optimized: 18 },
    { name: 'Notification', value: 15, optimized: 12 },
    { name: 'Other', value: 5, optimized: 4 },
  ];

  const resourceUtilization = [
    { metric: 'CPU Usage', value: 65, target: 80 },
    { metric: 'Memory', value: 72, target: 85 },
    { metric: 'API Calls', value: 85, target: 90 },
    { metric: 'Queue Size', value: 45, target: 70 },
    { metric: 'Response Time', value: 78, target: 85 },
  ];

  const MetricCard = ({ title, value, change, icon, color, suffix = '' }: any) => (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {value}{suffix}
            </Typography>
            {change !== undefined && (
              <Box display="flex" alignItems="center" mt={1}>
                {change > 0 ? (
                  <TrendingUp color="success" fontSize="small" />
                ) : (
                  <TrendingDown color="error" fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color={change > 0 ? 'success.main' : 'error.main'}
                  ml={0.5}
                >
                  {Math.abs(change)}% from last period
                </Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${color}20`,
              color: color,
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Performance Metrics
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>
          <ToggleButtonGroup
            value={viewType}
            exclusive
            onChange={(e, value) => value && setViewType(value)}
            size="small"
          >
            <ToggleButton value="overview">
              <BarChartIcon />
            </ToggleButton>
            <ToggleButton value="trends">
              <ShowChart />
            </ToggleButton>
            <ToggleButton value="distribution">
              <DonutLarge />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <MetricCard
              title="Total Workflows"
              value="1,432"
              change={12.5}
              icon={<Timeline sx={{ fontSize: 32 }} />}
              color="#ff6d00"
            />
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <MetricCard
              title="Success Rate"
              value="94.2"
              suffix="%"
              change={3.1}
              icon={<CheckCircle sx={{ fontSize: 32 }} />}
              color="#4caf50"
            />
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <MetricCard
              title="Avg Response Time"
              value="1.8"
              suffix="s"
              change={-15.4}
              icon={<Speed sx={{ fontSize: 32 }} />}
              color="#1976d2"
            />
          </motion.div>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <MetricCard
              title="Active Agents"
              value="8"
              change={0}
              icon={<SmartToy sx={{ fontSize: 32 }} />}
              color="#9c27b0"
            />
          </motion.div>
        </Grid>
      </Grid>

      {viewType === 'overview' && (
        <>
          {/* Performance Trend */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Workflow Processing Trend
                  </Typography>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
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
                      <Line
                        type="monotone"
                        dataKey="successRate"
                        stroke="#4caf50"
                        strokeWidth={3}
                        dot={{ fill: '#4caf50' }}
                        yAxisId="right"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Resource Utilization */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Resource Utilization
                  </Typography>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={resourceUtilization}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar
                        name="Current"
                        dataKey="value"
                        stroke="#ff6d00"
                        fill="#ff6d00"
                        fillOpacity={0.6}
                      />
                      <Radar
                        name="Target"
                        dataKey="target"
                        stroke="#1976d2"
                        fill="#1976d2"
                        fillOpacity={0.3}
                      />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {viewType === 'trends' && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Agent Performance Comparison
                </Typography>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={agentPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="agent" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="workflows" fill="#ff6d00" />
                    <Bar dataKey="optimizations" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {viewType === 'distribution' && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Workflow Type Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={workflowTypes}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={(entry) => `${entry.name}: ${entry.value}%`}
                    >
                      {workflowTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Optimization Coverage
                </Typography>
                <Box sx={{ mt: 3 }}>
                  {workflowTypes.map((type, index) => (
                    <Box key={type.name} sx={{ mb: 3 }}>
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2">{type.name}</Typography>
                        <Typography variant="body2" fontWeight="bold">
                          {Math.round((type.optimized / type.value) * 100)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(type.optimized / type.value) * 100}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 5,
                            bgcolor: COLORS[index % COLORS.length],
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default Metrics;