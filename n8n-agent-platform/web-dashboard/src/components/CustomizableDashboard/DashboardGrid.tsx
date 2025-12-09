import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Fab,
} from '@mui/material';
import {
  DragIndicator,
  Close,
  Add,
  Settings,
  Save,
  Restore,
  Timeline,
  SmartToy,
  AccountTree,
  Speed,
  DonutLarge,
  BarChart,
  ViewModule,
  AutoFixHigh,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useStore } from '../../store';

// Import widget components
import MetricsWidget from './widgets/MetricsWidget';
import AgentStatusWidget from './widgets/AgentStatusWidget';
import WorkflowPerformanceWidget from './widgets/WorkflowPerformanceWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import OptimizationSuggestionsWidget from './widgets/OptimizationSuggestionsWidget';
import SystemHealthWidget from './widgets/SystemHealthWidget';

interface WidgetConfig {
  id: string;
  type: string;
  title: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
}

interface Layout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface Layouts {
  lg?: Layout[];
}

const availableWidgets: WidgetConfig[] = [
  {
    id: 'metrics',
    type: 'metrics',
    title: 'Key Metrics',
    icon: <Timeline />,
    component: MetricsWidget,
    defaultSize: { w: 6, h: 4 },
    minSize: { w: 4, h: 3 },
  },
  {
    id: 'agent-status',
    type: 'agent-status',
    title: 'Agent Status',
    icon: <SmartToy />,
    component: AgentStatusWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
  {
    id: 'workflow-performance',
    type: 'workflow-performance',
    title: 'Workflow Performance',
    icon: <AccountTree />,
    component: WorkflowPerformanceWidget,
    defaultSize: { w: 8, h: 5 },
    minSize: { w: 6, h: 4 },
  },
  {
    id: 'recent-activity',
    type: 'recent-activity',
    title: 'Recent Activity',
    icon: <Timeline />,
    component: RecentActivityWidget,
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
  },
  {
    id: 'optimization-suggestions',
    type: 'optimization-suggestions',
    title: 'Optimization Suggestions',
    icon: <AutoFixHigh />,
    component: OptimizationSuggestionsWidget,
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 4, h: 4 },
  },
  {
    id: 'system-health',
    type: 'system-health',
    title: 'System Health',
    icon: <Speed />,
    component: SystemHealthWidget,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
  },
];

const DashboardGrid: React.FC = () => {
  const [layouts, setLayouts] = useState<Layouts>(() => {
    const saved = localStorage.getItem('dashboardLayouts');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Default layout
    return {
      lg: [
        { i: 'metrics-1', x: 0, y: 0, w: 6, h: 4 },
        { i: 'agent-status-1', x: 6, y: 0, w: 4, h: 4 },
        { i: 'workflow-performance-1', x: 0, y: 4, w: 8, h: 5 },
        { i: 'recent-activity-1', x: 8, y: 4, w: 4, h: 6 },
      ],
    };
  });

  const [widgets, setWidgets] = useState<Array<{ id: string; type: string }>>(() => {
    const saved = localStorage.getItem('dashboardWidgets');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Default widgets
    return [
      { id: 'metrics-1', type: 'metrics' },
      { id: 'agent-status-1', type: 'agent-status' },
      { id: 'workflow-performance-1', type: 'workflow-performance' },
      { id: 'recent-activity-1', type: 'recent-activity' },
    ];
  });

  const [editMode, setEditMode] = useState(false);
  const [addWidgetDialog, setAddWidgetDialog] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<null | HTMLElement>(null);

  const handleLayoutChange = (newLayouts: Layouts) => {
    setLayouts(newLayouts);
    localStorage.setItem('dashboardLayouts', JSON.stringify(newLayouts));
  };

  const handleAddWidget = (widgetType: string) => {
    const widgetConfig = availableWidgets.find((w) => w.type === widgetType);
    if (!widgetConfig) return;

    const newWidget = {
      id: `${widgetType}-${Date.now()}`,
      type: widgetType,
    };

    const newLayout: Layout = {
      i: newWidget.id,
      x: 0,
      y: 0,
      w: widgetConfig.defaultSize.w,
      h: widgetConfig.defaultSize.h,
      minW: widgetConfig.minSize?.w,
      minH: widgetConfig.minSize?.h,
    };

    setWidgets([...widgets, newWidget]);
    setLayouts({
      ...layouts,
      lg: [...(layouts.lg || []), newLayout],
    });

    setAddWidgetDialog(false);
    setEditMode(true);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setWidgets(widgets.filter((w) => w.id !== widgetId));
    setLayouts({
      ...layouts,
      lg: layouts.lg?.filter((l) => l.i !== widgetId) || [],
    });
  };

  const handleSaveLayout = () => {
    localStorage.setItem('dashboardLayouts', JSON.stringify(layouts));
    localStorage.setItem('dashboardWidgets', JSON.stringify(widgets));
    setEditMode(false);
  };

  const handleResetLayout = () => {
    const defaultLayouts = {
      lg: [
        { i: 'metrics-1', x: 0, y: 0, w: 6, h: 4 },
        { i: 'agent-status-1', x: 6, y: 0, w: 4, h: 4 },
        { i: 'workflow-performance-1', x: 0, y: 4, w: 8, h: 5 },
        { i: 'recent-activity-1', x: 8, y: 4, w: 4, h: 6 },
      ],
    };
    
    const defaultWidgets = [
      { id: 'metrics-1', type: 'metrics' },
      { id: 'agent-status-1', type: 'agent-status' },
      { id: 'workflow-performance-1', type: 'workflow-performance' },
      { id: 'recent-activity-1', type: 'recent-activity' },
    ];

    setLayouts(defaultLayouts);
    setWidgets(defaultWidgets);
    localStorage.setItem('dashboardLayouts', JSON.stringify(defaultLayouts));
    localStorage.setItem('dashboardWidgets', JSON.stringify(defaultWidgets));
    setEditMode(false);
  };

  const renderWidget = (widget: { id: string; type: string }) => {
    const widgetConfig = availableWidgets.find((w) => w.type === widget.type);
    if (!widgetConfig) return null;

    const WidgetComponent = widgetConfig.component;

    return (
      <Paper
        key={widget.id}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {editMode && (
          <>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 40,
                bgcolor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1,
                cursor: 'move',
                zIndex: 10,
              }}
              className="drag-handle"
            >
              <Box display="flex" alignItems="center" gap={1}>
                <DragIndicator sx={{ color: 'white' }} />
                <Typography variant="caption" sx={{ color: 'white' }}>
                  {widgetConfig.title}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleRemoveWidget(widget.id)}
                sx={{ color: 'white' }}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          </>
        )}
        <WidgetComponent />
      </Paper>
    );
  };

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      {/* Control Buttons */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: 0,
          display: 'flex',
          gap: 1,
          zIndex: 100,
        }}
      >
        {editMode ? (
          <>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSaveLayout}
              size="small"
            >
              Save Layout
            </Button>
            <Button
              variant="outlined"
              onClick={() => setEditMode(false)}
              size="small"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={<ViewModule />}
              onClick={() => setEditMode(true)}
              size="small"
            >
              Customize
            </Button>
            <IconButton
              size="small"
              onClick={(e) => setSettingsAnchor(e.currentTarget)}
            >
              <Settings />
            </IconButton>
          </>
        )}
      </Box>

      {/* Grid Layout - Simple implementation without external library */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: 2,
          p: 2,
        }}
      >
        {widgets.map((widget) => {
          const layout = layouts.lg?.find((l) => l.i === widget.id);
          return (
            <Box
              key={widget.id}
              sx={{
                gridColumn: `span ${layout?.w || 4}`,
                gridRow: `span ${layout?.h || 4}`,
              }}
            >
              {renderWidget(widget)}
            </Box>
          );
        })}
      </Box>

      {/* Add Widget FAB */}
      {editMode && (
        <Fab
          color="primary"
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
          }}
          onClick={() => setAddWidgetDialog(true)}
        >
          <Add />
        </Fab>
      )}

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuItem onClick={handleResetLayout}>
          <ListItemIcon>
            <Restore />
          </ListItemIcon>
          <ListItemText>Reset to Default</ListItemText>
        </MenuItem>
      </Menu>

      {/* Add Widget Dialog */}
      <Dialog
        open={addWidgetDialog}
        onClose={() => setAddWidgetDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Widget</DialogTitle>
        <DialogContent>
          <List>
            {availableWidgets.map((widget) => (
              <ListItem
                button
                key={widget.type}
                onClick={() => handleAddWidget(widget.type)}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon>{widget.icon}</ListItemIcon>
                <ListItemText
                  primary={widget.title}
                  secondary={`Size: ${widget.defaultSize.w}x${widget.defaultSize.h}`}
                />
                <Chip label="Add" color="primary" size="small" />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddWidgetDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardGrid;