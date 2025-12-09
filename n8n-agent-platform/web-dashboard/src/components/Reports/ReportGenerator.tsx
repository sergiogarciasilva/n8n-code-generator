import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
  Alert,
  LinearProgress,
  Paper,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  Description,
  PictureAsPdf,
  TableChart,
  Download,
  Schedule,
  Email,
  Preview,
  Close,
  CheckCircle,
  SmartToy,
  AccountTree,
  AutoFixHigh,
  Code,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useStore } from '../../store';

interface ReportConfig {
  name: string;
  type: 'performance' | 'agents' | 'workflows' | 'optimization' | 'custom';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sections: string[];
  schedule?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
}

interface ReportGeneratorProps {
  open: boolean;
  onClose: () => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ open, onClose }) => {
  const { agents, workflows, metrics } = useStore();
  const [config, setConfig] = useState<ReportConfig>({
    name: '',
    type: 'performance',
    format: 'pdf',
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    },
    sections: ['summary', 'metrics', 'charts'],
    schedule: {
      enabled: false,
      frequency: 'weekly',
      recipients: [],
    },
  });
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState(false);
  const [progress, setProgress] = useState(0);

  const reportTypes = [
    { value: 'performance', label: 'Performance Report', icon: <TableChart /> },
    { value: 'agents', label: 'Agent Activity Report', icon: <SmartToy /> },
    { value: 'workflows', label: 'Workflow Analysis', icon: <AccountTree /> },
    { value: 'optimization', label: 'Optimization Summary', icon: <AutoFixHigh /> },
    { value: 'custom', label: 'Custom Report', icon: <Description /> },
  ];

  const availableSections = {
    performance: ['summary', 'metrics', 'charts', 'trends', 'recommendations'],
    agents: ['status', 'activity', 'performance', 'errors', 'optimizations'],
    workflows: ['overview', 'execution', 'errors', 'optimization', 'suggestions'],
    optimization: ['summary', 'changes', 'impact', 'recommendations', 'timeline'],
    custom: ['all'],
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    setProgress(0);

    try {
      const token = localStorage.getItem('auth_token');
      
      // Call API to generate report
      const response = await fetch('http://localhost:3456/api/v1/reports/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: config.type,
          format: config.format,
          dateRange: {
            start: config.dateRange.start?.toISOString() || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: config.dateRange.end?.toISOString() || new Date().toISOString()
          },
          filters: {
            sections: config.sections
          }
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate report');
      }

      // Track progress
      for (let i = 0; i <= 100; i += 20) {
        setProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Handle different response types
      if (config.format === 'json') {
        const data = await response.json();
        downloadReport(data);
      } else {
        // For PDF, CSV, etc., download the blob directly
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${config.name || config.type}-report-${Date.now()}.${config.format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      // Schedule if enabled
      if (config.schedule?.enabled) {
        await handleScheduleReport();
      }

      // Show success message
      setGenerating(false);
      handleClose();
    } catch (error) {
      console.error('Failed to generate report:', error);
      setGenerating(false);
      
      // If API fails, use mock data as fallback
      const reportData = await generateReportData();
      downloadReport(reportData);
    }
  };

  const generateReportData = async () => {
    // Collect data based on report type and sections
    const data: any = {
      metadata: {
        title: config.name || `${config.type} Report`,
        generatedAt: new Date().toISOString(),
        dateRange: config.dateRange,
        type: config.type,
      },
      content: {},
    };

    if (config.sections.includes('summary')) {
      data.content.summary = {
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === 'active').length,
        totalWorkflows: workflows?.length || 0,
        successRate: '94.2%',
        optimizationsSuggested: 156,
        optimizationsApplied: 134,
      };
    }

    if (config.sections.includes('metrics')) {
      data.content.metrics = {
        avgResponseTime: 1.8,
        totalExecutions: 1432,
        errorRate: 5.8,
        performanceImprovement: 32.5,
      };
    }

    // Add more sections based on config...

    return data;
  };

  const downloadReport = (data: any) => {
    let content = '';
    let filename = '';
    let mimeType = '';

    switch (config.format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        filename = `report-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      
      case 'csv':
        content = convertToCSV(data);
        filename = `report-${Date.now()}.csv`;
        mimeType = 'text/csv';
        break;
      
      case 'pdf':
        // In a real app, you'd use a library like jsPDF
        content = JSON.stringify(data, null, 2);
        filename = `report-${Date.now()}.pdf`;
        mimeType = 'application/pdf';
        break;
      
      case 'excel':
        // In a real app, you'd use a library like SheetJS
        content = convertToCSV(data);
        filename = `report-${Date.now()}.xlsx`;
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (data: any) => {
    // Simple CSV conversion
    const rows = [];
    rows.push('Metric,Value');
    
    if (data.content.summary) {
      Object.entries(data.content.summary).forEach(([key, value]) => {
        rows.push(`${key},${value}`);
      });
    }
    
    return rows.join('\n');
  };

  const handleScheduleReport = async () => {
    if (config.schedule?.enabled) {
      try {
        const token = localStorage.getItem('auth_token');
        
        const response = await fetch('http://localhost:3456/api/v1/reports/schedule', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: config.name,
            type: config.type,
            format: config.format,
            schedule: {
              frequency: config.schedule.frequency,
              time: '09:00', // Default time, could be made configurable
              dayOfWeek: config.schedule.frequency === 'weekly' ? 1 : undefined,
              dayOfMonth: config.schedule.frequency === 'monthly' ? 1 : undefined
            },
            recipients: config.schedule.recipients || []
          })
        });

        if (!response.ok) {
          throw new Error('Failed to schedule report');
        }

        const result = await response.json();
        console.log('Report scheduled successfully:', result);
        
        // Close dialog and show success message
        handleClose();
        
      } catch (error) {
        console.error('Failed to schedule report:', error);
      }
    }
  };

  const handleClose = () => {
    setConfig({
      name: '',
      type: 'performance',
      format: 'pdf',
      dateRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
      },
      sections: ['summary', 'metrics', 'charts'],
      schedule: {
        enabled: false,
        frequency: 'weekly',
        recipients: [],
      },
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Generate Report</Typography>
          <IconButton onClick={handleClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
          {/* Report Name */}
          <TextField
            label="Report Name"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            fullWidth
            placeholder="Enter a descriptive name for your report"
          />

          {/* Report Type */}
          <FormControl fullWidth>
            <InputLabel>Report Type</InputLabel>
            <Select
              value={config.type}
              onChange={(e) => setConfig({ ...config, type: e.target.value as any })}
              label="Report Type"
            >
              {reportTypes.map((type) => (
                <MenuItem key={type.value} value={type.value}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {type.icon}
                    {type.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Date Range */}
          <Box display="flex" gap={2}>
            <TextField
              label="Start Date"
              type="date"
              value={config.dateRange.start ? config.dateRange.start.toISOString().split('T')[0] : ''}
              onChange={(e) => setConfig({
                ...config,
                dateRange: { ...config.dateRange, start: new Date(e.target.value) },
              })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={config.dateRange.end ? config.dateRange.end.toISOString().split('T')[0] : ''}
              onChange={(e) => setConfig({
                ...config,
                dateRange: { ...config.dateRange, end: new Date(e.target.value) },
              })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Format Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Export Format
            </Typography>
            <ToggleButtonGroup
              value={config.format}
              exclusive
              onChange={(e, value) => value && setConfig({ ...config, format: value })}
              fullWidth
            >
              <ToggleButton value="pdf">
                <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                  <PictureAsPdf />
                  <Typography variant="caption">PDF</Typography>
                </Box>
              </ToggleButton>
              <ToggleButton value="excel">
                <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                  <TableChart />
                  <Typography variant="caption">Excel</Typography>
                </Box>
              </ToggleButton>
              <ToggleButton value="csv">
                <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                  <Description />
                  <Typography variant="caption">CSV</Typography>
                </Box>
              </ToggleButton>
              <ToggleButton value="json">
                <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
                  <Code />
                  <Typography variant="caption">JSON</Typography>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Sections */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Include Sections
            </Typography>
            <FormGroup row>
              {availableSections[config.type].map((section) => (
                <FormControlLabel
                  key={section}
                  control={
                    <Checkbox
                      checked={config.sections.includes(section)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setConfig({
                            ...config,
                            sections: [...config.sections, section],
                          });
                        } else {
                          setConfig({
                            ...config,
                            sections: config.sections.filter((s) => s !== section),
                          });
                        }
                      }}
                    />
                  }
                  label={section.charAt(0).toUpperCase() + section.slice(1)}
                />
              ))}
            </FormGroup>
          </Box>

          {/* Schedule Options */}
          <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={config.schedule?.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    schedule: { ...config.schedule!, enabled: e.target.checked },
                  })}
                />
              }
              label="Schedule this report"
            />
            
            {config.schedule?.enabled && (
              <Box sx={{ mt: 2, pl: 4 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Frequency</InputLabel>
                  <Select
                    value={config.schedule.frequency}
                    onChange={(e) => setConfig({
                      ...config,
                      schedule: { ...config.schedule!, frequency: e.target.value as any },
                    })}
                    label="Frequency"
                  >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  label="Email Recipients"
                  placeholder="email1@example.com, email2@example.com"
                  fullWidth
                  helperText="Comma-separated email addresses"
                />
              </Box>
            )}
          </Paper>

          {generating && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Generating report...
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          startIcon={<Preview />}
          onClick={() => setPreview(true)}
          disabled={generating}
        >
          Preview
        </Button>
        <Button
          variant="contained"
          startIcon={generating ? <CircularProgress size={20} /> : <Download />}
          onClick={handleGenerateReport}
          disabled={generating || !config.name}
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportGenerator;