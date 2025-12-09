import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Analytics as AnalyticsIcon,
  Download,
  Refresh,
  DateRange,
  ShowChart,
  BubbleChart,
  PieChart,
  BarChart,
  Timeline,
  Speed,
  Warning,
  CheckCircle,
  Error as ErrorIcon,
  AutoGraph,
  Psychology,
  Insights,
  SaveAlt,
  Share,
  Schedule,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Scatter,
  ScatterChart,
  ZAxis,
  ReferenceLine,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import GlassCard from '../components/ui/GlassCard';
import { designTokens } from '../theme/designTokens';
import { useStore } from '../store';
import { api } from '../services/api';

// Types
interface MetricData {
  timestamp: string;
  value: number;
  label?: string;
}

interface Prediction {
  timestamp: string;
  value: number;
  confidence: number;
  upperBound: number;
  lowerBound: number;
}

interface Anomaly {
  timestamp: string;
  value: number;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
  icon: React.ReactNode;
  color: string;
  sparkline: number[];
}

interface Report {
  id: string;
  name: string;
  metrics: string[];
  schedule?: string;
  format: 'pdf' | 'csv' | 'json';
  lastGenerated?: Date;
}

// Chart color palette
const CHART_COLORS = [
  designTokens.colors.glass.blue,
  designTokens.colors.glass.purple,
  designTokens.colors.glass.green,
  designTokens.colors.glass.orange,
  '#e91e63',
  '#00bcd4',
  '#ff5722',
  '#795548',
];

const Analytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [customDateRange, setCustomDateRange] = useState({
    start: subDays(new Date(), 7),
    end: new Date(),
  });
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'workflow_executions',
    'success_rate',
    'avg_response_time',
  ]);
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [loading, setLoading] = useState(true);
  const [metricsData, setMetricsData] = useState<Record<string, MetricData[]>>({});
  const [predictions, setPredictions] = useState<Record<string, Prediction[]>>({});
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [correlations, setCorrelations] = useState<any[]>([]);
  const [showPredictions, setShowPredictions] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const { user } = useStore();

  // Available metrics
  const availableMetrics = [
    { id: 'workflow_executions', name: 'Workflow Executions', unit: 'count' },
    { id: 'success_rate', name: 'Success Rate', unit: '%' },
    { id: 'avg_response_time', name: 'Avg Response Time', unit: 'ms' },
    { id: 'error_rate', name: 'Error Rate', unit: '%' },
    { id: 'api_calls', name: 'API Calls', unit: 'count' },
    { id: 'cost_per_execution', name: 'Cost per Execution', unit: '$' },
    { id: 'agent_efficiency', name: 'Agent Efficiency', unit: '%' },
    { id: 'optimization_savings', name: 'Optimization Savings', unit: '$' },
  ];

  // Fetch analytics data
  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange, selectedMetrics]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const timeRangeParams = getTimeRangeParams();

      // Fetch metrics data
      const metricsPromises = selectedMetrics.map(metric =>
        api.get(`/analytics/metrics/${metric}`, { params: timeRangeParams })
      );

      const metricsResponses = await Promise.all(metricsPromises);
      const newMetricsData: Record<string, MetricData[]> = {};

      selectedMetrics.forEach((metric, index) => {
        newMetricsData[metric] = metricsResponses[index].data;
      });

      setMetricsData(newMetricsData);

      // Fetch predictions
      if (showPredictions) {
        const predictionPromises = selectedMetrics.map(metric =>
          api.get(`/analytics/predictions/${metric}`)
        );
        const predictionResponses = await Promise.all(predictionPromises);
        const newPredictions: Record<string, Prediction[]> = {};

        selectedMetrics.forEach((metric, index) => {
          newPredictions[metric] = predictionResponses[index].data.predictions;
        });

        setPredictions(newPredictions);

        // Extract anomalies
        const allAnomalies = predictionResponses.flatMap(res => res.data.anomalies);
        setAnomalies(allAnomalies);
      }

      // Fetch correlations
      if (selectedMetrics.length > 1) {
        const correlationsRes = await api.post('/analytics/correlations', {
          metrics: selectedMetrics,
          ...timeRangeParams,
        });
        setCorrelations(correlationsRes.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRangeParams = () => {
    if (timeRange === 'custom') {
      return {
        start: startOfDay(customDateRange.start).toISOString(),
        end: endOfDay(customDateRange.end).toISOString(),
      };
    }

    const ranges: Record<string, number> = {
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };

    const days = ranges[timeRange] || 7;
    return {
      start: startOfDay(subDays(new Date(), days)).toISOString(),
      end: endOfDay(new Date()).toISOString(),
    };
  };

  // Calculate summary metrics
  const summaryMetrics: AnalyticsMetric[] = useMemo(() => {
    if (Object.keys(metricsData).length === 0) return [];

    return [
      {
        id: 'total_executions',
        name: 'Total Executions',
        value: metricsData.workflow_executions?.reduce((sum, d) => sum + d.value, 0) || 0,
        change: 12.5,
        trend: 'up',
        unit: '',
        icon: <ShowChart />,
        color: designTokens.colors.glass.blue,
        sparkline: metricsData.workflow_executions?.slice(-7).map(d => d.value) || [],
      },
      {
        id: 'avg_success_rate',
        name: 'Success Rate',
        value: metricsData.success_rate?.[metricsData.success_rate.length - 1]?.value || 0,
        change: 3.2,
        trend: 'up',
        unit: '%',
        icon: <CheckCircle />,
        color: designTokens.colors.glass.green,
        sparkline: metricsData.success_rate?.slice(-7).map(d => d.value) || [],
      },
      {
        id: 'avg_response',
        name: 'Avg Response Time',
        value: metricsData.avg_response_time?.[metricsData.avg_response_time.length - 1]?.value || 0,
        change: -8.7,
        trend: 'down',
        unit: 'ms',
        icon: <Speed />,
        color: designTokens.colors.glass.purple,
        sparkline: metricsData.avg_response_time?.slice(-7).map(d => d.value) || [],
      },
      {
        id: 'anomalies_detected',
        name: 'Anomalies Detected',
        value: anomalies.length,
        change: anomalies.filter(a => a.severity === 'high').length,
        trend: anomalies.length > 0 ? 'up' : 'stable',
        unit: '',
        icon: <Warning />,
        color: designTokens.colors.glass.orange,
        sparkline: [],
      },
    ];
  }, [metricsData, anomalies]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const timestamps = new Set<string>();
    Object.values(metricsData).forEach(data => {
      data.forEach(d => timestamps.add(d.timestamp));
    });

    return Array.from(timestamps)
      .sort()
      .map(timestamp => {
        const point: any = { timestamp, date: format(new Date(timestamp), 'MMM dd HH:mm') };

        selectedMetrics.forEach(metric => {
          const metricData = metricsData[metric];
          const value = metricData?.find(d => d.timestamp === timestamp)?.value || 0;
          point[metric] = value;

          // Add predictions
          if (showPredictions && predictions[metric]) {
            const prediction = predictions[metric].find(p => p.timestamp === timestamp);
            if (prediction) {
              point[`${metric}_predicted`] = prediction.value;
              point[`${metric}_upper`] = prediction.upperBound;
              point[`${metric}_lower`] = prediction.lowerBound;
            }
          }
        });

        return point;
      });
  }, [metricsData, predictions, selectedMetrics, showPredictions]);

  // Render main chart
  const renderChart = () => {
    const ChartComponent = {
      line: LineChart,
      area: AreaChart,
      bar: RechartsBarChart,
    }[chartType];

    const DataComponent = {
      line: Line,
      area: Area,
      bar: Bar,
    }[chartType];

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ChartComponent data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="date"
            stroke="rgba(255,255,255,0.5)"
            style={{ fontSize: 12 }}
          />
          <YAxis stroke="rgba(255,255,255,0.5)" style={{ fontSize: 12 }} />
          <RechartsTooltip
            contentStyle={{
              background: designTokens.glass.dark.background,
              border: designTokens.glass.dark.border,
              borderRadius: 8,
              backdropFilter: designTokens.glass.dark.backdrop,
            }}
          />
          <Legend />

          {selectedMetrics.map((metric, index) => (
            <React.Fragment key={metric}>
              <DataComponent
                type="monotone"
                dataKey={metric}
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                fill={CHART_COLORS[index % CHART_COLORS.length]}
                strokeWidth={2}
                name={availableMetrics.find(m => m.id === metric)?.name}
                {...(chartType === 'area' && { fillOpacity: 0.3 })}
              />

              {showPredictions && predictions[metric] && (
                <>
                  <Line
                    type="monotone"
                    dataKey={`${metric}_predicted`}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeDasharray="5 5"
                    strokeWidth={2}
                    name={`${availableMetrics.find(m => m.id === metric)?.name} (Predicted)`}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey={`${metric}_upper`}
                    stroke="none"
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    fillOpacity={0.1}
                  />
                  <Area
                    type="monotone"
                    dataKey={`${metric}_lower`}
                    stroke="none"
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                    fillOpacity={0.1}
                  />
                </>
              )}
            </React.Fragment>
          ))}

          {showAnomalies &&
            anomalies.map((anomaly, index) => (
              <ReferenceLine
                key={index}
                x={format(new Date(anomaly.timestamp), 'MMM dd HH:mm')}
                stroke={
                  anomaly.severity === 'high'
                    ? '#ff5252'
                    : anomaly.severity === 'medium'
                    ? '#ff9800'
                    : '#ffeb3b'
                }
                strokeDasharray="3 3"
                label={{
                  value: 'Anomaly',
                  position: 'top',
                  style: { fontSize: 10 },
                }}
              />
            ))}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  // Render correlation heatmap
  const renderCorrelationHeatmap = () => {
    if (correlations.length === 0) return null;

    return (
      <GlassCard variant="medium" rounded="xl" sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Metric Correlations
        </Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Grid container spacing={1} sx={{ minWidth: 400 }}>
            {correlations.map((corr, index) => (
              <Grid item key={index} xs={12}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    borderRadius: 1,
                    background: `linear-gradient(90deg, transparent, ${
                      corr.correlation > 0
                        ? designTokens.colors.glass.green
                        : designTokens.colors.glass.orange
                    })`,
                    backgroundSize: `${Math.abs(corr.correlation) * 100}% 100%`,
                    backgroundRepeat: 'no-repeat',
                  }}
                >
                  <Typography variant="body2">
                    {corr.metric1} ↔ {corr.metric2}
                  </Typography>
                  <Chip
                    label={`${(corr.correlation * 100).toFixed(1)}%`}
                    size="small"
                    color={corr.relationship === 'strong' ? 'primary' : 'default'}
                  />
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </GlassCard>
    );
  };

  // Render optimization recommendations
  const renderOptimizationRecommendations = () => {
    const recommendations = [
      {
        type: 'performance',
        priority: 'high',
        title: 'Enable Parallel Processing',
        description: 'Workflow "Customer Data Sync" can be optimized with parallel execution',
        improvement: '45% faster execution',
        icon: <Speed color="primary" />,
      },
      {
        type: 'cost',
        priority: 'medium',
        title: 'Implement API Caching',
        description: 'Cache frequently accessed API responses to reduce costs',
        improvement: '$120/month savings',
        icon: <SaveAlt color="success" />,
      },
      {
        type: 'reliability',
        priority: 'high',
        title: 'Add Retry Logic',
        description: '3 workflows have >5% error rate, add retry mechanisms',
        improvement: '90% error reduction',
        icon: <Refresh color="error" />,
      },
    ];

    return (
      <GlassCard variant="medium" rounded="xl" sx={{ p: 3, mt: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">
            AI-Powered Optimization Recommendations
          </Typography>
          <Chip
            icon={<Psychology />}
            label="ML Analysis"
            size="small"
            color="primary"
          />
        </Box>

        <Grid container spacing={2}>
          {recommendations.map((rec, index) => (
            <Grid item xs={12} key={index}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: designTokens.glass.light.background,
                    border: designTokens.glass.light.border,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                  }}
                >
                  {rec.icon}
                  <Box flex={1}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      {rec.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {rec.description}
                    </Typography>
                    <Chip
                      label={rec.improvement}
                      size="small"
                      color="success"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                  <Button size="small" variant="outlined">
                    Apply
                  </Button>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </GlassCard>
    );
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedReport) return;

    try {
      const response = await api.post('/analytics/reports/generate', {
        name: selectedReport.name,
        metrics: selectedReport.metrics,
        timeRange: getTimeRangeParams(),
        format: selectedReport.format,
        includeCharts: true,
        includePredictions: showPredictions,
      });

      // Download report
      const blob = new Blob([response.data], {
        type: selectedReport.format === 'pdf' 
          ? 'application/pdf' 
          : selectedReport.format === 'csv'
          ? 'text/csv'
          : 'application/json',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedReport.name}_${format(new Date(), 'yyyy-MM-dd')}.${selectedReport.format}`;
      a.click();
      window.URL.revokeObjectURL(url);

      setReportDialogOpen(false);
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Business Intelligence Analytics
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Advanced analytics and ML-powered insights for your workflows
          </Typography>
        </Box>

        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => setReportDialogOpen(true)}
          >
            Generate Report
          </Button>
          <IconButton onClick={fetchAnalyticsData} disabled={loading}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Controls */}
      <GlassCard variant="light" rounded="xl" sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
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
                <MenuItem value="custom">Custom Range</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {timeRange === 'custom' && (
            <>
              <Grid item xs={12} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={customDateRange.start}
                    onChange={(date) =>
                      setCustomDateRange((prev) => ({ ...prev, start: date! }))
                    }
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} md={3}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="End Date"
                    value={customDateRange.end}
                    onChange={(date) =>
                      setCustomDateRange((prev) => ({ ...prev, end: date! }))
                    }
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
            </>
          )}

          <Grid item xs={12} md={timeRange === 'custom' ? 3 : 6}>
            <Autocomplete
              multiple
              options={availableMetrics}
              getOptionLabel={(option) => option.name}
              value={availableMetrics.filter((m) => selectedMetrics.includes(m.id))}
              onChange={(_, newValue) => {
                setSelectedMetrics(newValue.map((v) => v.id));
              }}
              renderInput={(params) => (
                <TextField {...params} label="Metrics" size="small" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="outlined"
                    label={option.name}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => value && setChartType(value)}
              size="small"
              fullWidth
            >
              <ToggleButton value="line">
                <Timeline />
              </ToggleButton>
              <ToggleButton value="area">
                <ShowChart />
              </ToggleButton>
              <ToggleButton value="bar">
                <BarChart />
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        </Grid>

        <Box display="flex" gap={2} mt={2}>
          <Chip
            icon={<AutoGraph />}
            label="Show Predictions"
            color={showPredictions ? 'primary' : 'default'}
            onClick={() => setShowPredictions(!showPredictions)}
            clickable
          />
          <Chip
            icon={<Warning />}
            label="Show Anomalies"
            color={showAnomalies ? 'primary' : 'default'}
            onClick={() => setShowAnomalies(!showAnomalies)}
            clickable
          />
        </Box>
      </GlassCard>

      {/* Summary Metrics */}
      <Grid container spacing={3} mb={3}>
        {summaryMetrics.map((metric, index) => (
          <Grid item xs={12} sm={6} md={3} key={metric.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <GlassCard
                variant="medium"
                rounded="xl"
                hover
                sx={{
                  p: 3,
                  height: '100%',
                  borderTop: `3px solid ${metric.color}`,
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {metric.name}
                    </Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {metric.value.toLocaleString()}
                      {metric.unit && (
                        <Typography
                          component="span"
                          variant="h6"
                          color="text.secondary"
                          ml={0.5}
                        >
                          {metric.unit}
                        </Typography>
                      )}
                    </Typography>
                    <Box display="flex" alignItems="center" mt={1}>
                      {metric.trend === 'up' ? (
                        <TrendingUp color="success" fontSize="small" />
                      ) : metric.trend === 'down' ? (
                        <TrendingDown color="error" fontSize="small" />
                      ) : null}
                      <Typography
                        variant="body2"
                        color={metric.trend === 'up' ? 'success.main' : 'error.main'}
                        ml={0.5}
                      >
                        {metric.change > 0 ? '+' : ''}
                        {metric.change}%
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      color: metric.color,
                      opacity: 0.7,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {metric.icon}
                  </Box>
                </Box>

                {metric.sparkline.length > 0 && (
                  <Box mt={2} height={40}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metric.sparkline.map((v, i) => ({ value: v }))}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={metric.color}
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </GlassCard>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      {/* Main Chart */}
      <GlassCard variant="medium" rounded="xl" sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Metrics Timeline
        </Typography>
        {loading ? (
          <Skeleton variant="rectangular" height={400} />
        ) : (
          renderChart()
        )}
      </GlassCard>

      {/* Anomalies Alert */}
      {anomalies.length > 0 && showAnomalies && (
        <Alert
          severity="warning"
          icon={<Warning />}
          sx={{ mb: 3, background: designTokens.glass.light.background }}
        >
          <Typography variant="subtitle2" fontWeight="bold">
            {anomalies.length} Anomalies Detected
          </Typography>
          <Box mt={1}>
            {anomalies.slice(0, 3).map((anomaly, index) => (
              <Typography key={index} variant="body2">
                • {format(new Date(anomaly.timestamp), 'MMM dd HH:mm')} - {anomaly.reason}
              </Typography>
            ))}
          </Box>
        </Alert>
      )}

      {/* Additional Analytics */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          {renderCorrelationHeatmap()}
        </Grid>
        <Grid item xs={12} md={6}>
          {renderOptimizationRecommendations()}
        </Grid>
      </Grid>

      {/* Report Generation Dialog */}
      <Dialog
        open={reportDialogOpen}
        onClose={() => setReportDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Analytics Report</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Report Name"
            margin="normal"
            value={selectedReport?.name || ''}
            onChange={(e) =>
              setSelectedReport((prev) => ({ ...prev!, name: e.target.value }))
            }
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Format</InputLabel>
            <Select
              value={selectedReport?.format || 'pdf'}
              onChange={(e) =>
                setSelectedReport((prev) => ({
                  ...prev!,
                  format: e.target.value as any,
                }))
              }
              label="Format"
            >
              <MenuItem value="pdf">PDF</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
              <MenuItem value="json">JSON</MenuItem>
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ mt: 2 }}>
            The report will include all selected metrics for the current time range.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleGenerateReport}
            variant="contained"
            startIcon={<Download />}
          >
            Generate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Analytics;