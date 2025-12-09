import React, { useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Grid,
  Typography,
  IconButton,
  Fab,
  Tooltip,
  Zoom,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Fullscreen as FullscreenIcon,
  Settings as SettingsIcon,
  TrendingUp as TrendingIcon,
  Speed as SpeedIcon,
  Psychology as BrainIcon,
  CloudDone as CloudIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import GlassCard from '../components/ui/GlassCard';
import AgentBubble from '../components/agents/AgentBubble';
import AgentChatPanel from '../components/agents/AgentChatPanel';
import { designTokens } from '../theme/designTokens';
import { useStore } from '../store';
import { useSocket } from '../contexts/SocketContext';

// Mock data
const mockAgents = [
  {
    id: '1',
    name: 'Workflow Wizard',
    type: 'mcp' as const,
    status: 'active' as const,
    mood: 'excited' as const,
    lastMessage: 'I just optimized 3 workflows! 🚀',
    performance: {
      tasksCompleted: 247,
      successRate: 98.5,
      avgResponseTime: 342,
    },
  },
  {
    id: '2',
    name: 'Bot Guardian',
    type: 'telegram' as const,
    status: 'active' as const,
    mood: 'working' as const,
    lastMessage: 'Monitoring 12 channels...',
    performance: {
      tasksCompleted: 1834,
      successRate: 99.2,
      avgResponseTime: 156,
    },
  },
  {
    id: '3',
    name: 'Multi-Mind',
    type: 'multi-agent' as const,
    status: 'processing' as const,
    mood: 'thinking' as const,
    lastMessage: 'Coordinating team efforts...',
    performance: {
      tasksCompleted: 89,
      successRate: 94.7,
      avgResponseTime: 789,
    },
  },
  {
    id: '4',
    name: 'Data Sage',
    type: 'mcp' as const,
    status: 'idle' as const,
    mood: 'sleeping' as const,
    performance: {
      tasksCompleted: 456,
      successRate: 97.1,
      avgResponseTime: 234,
    },
  },
];

const mockMetrics = {
  totalWorkflows: 156,
  activeAgents: 3,
  successRate: 98.2,
  avgResponseTime: 342,
  totalOptimizations: 1247,
  todayExecutions: 89,
  resourceUsage: 67,
  uptime: 99.9,
};

// Styled Components
const DashboardContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: `
    radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 40% 80%, rgba(120, 219, 255, 0.1) 0%, transparent 50%),
    linear-gradient(135deg, #667eea 0%, #764ba2 100%)
  `,
  padding: theme.spacing(3),
  position: 'relative',
  overflow: 'hidden',

  // Animated background particles
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.05) 0%, transparent 2%),
      radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 1%),
      radial-gradient(circle at 40% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 3%)
    `,
    animation: 'float 20s ease-in-out infinite',
    zIndex: 0,
  },

  '@keyframes float': {
    '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
    '50%': { transform: 'translateY(-20px) rotate(1deg)' },
  },
}));

const WelcomeHeader = styled(GlassCard)(({ theme }) => ({
  padding: theme.spacing(4),
  marginBottom: theme.spacing(4),
  position: 'relative',
  overflow: 'visible',
  
  '&::after': {
    content: '""',
    position: 'absolute',
    top: -50,
    right: -50,
    width: 100,
    height: 100,
    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'pulse 4s ease-in-out infinite',
  },

  '@keyframes pulse': {
    '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
    '50%': { transform: 'scale(1.2)', opacity: 0.8 },
  },
}));

const MetricCard = styled(GlassCard)<{ accent?: string }>(({ theme, accent = 'blue' }) => {
  const accentColors = {
    blue: designTokens.colors.glass.blue,
    purple: designTokens.colors.glass.purple,
    green: designTokens.colors.glass.green,
    orange: designTokens.colors.glass.orange,
  };

  return {
    padding: theme.spacing(3),
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    position: 'relative',
    transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,
    
    '&:hover': {
      transform: 'translateY(-4px) scale(1.02)',
      background: accentColors[accent as keyof typeof accentColors],
      boxShadow: `0 12px 40px 0 ${accentColors[accent as keyof typeof accentColors]}`,
    },

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '3px',
      background: `linear-gradient(90deg, ${accentColors[accent as keyof typeof accentColors]}, transparent)`,
      borderRadius: `${designTokens.borderRadius.xl} ${designTokens.borderRadius.xl} 0 0`,
    },
  };
});

const AgentContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(3),
  padding: theme.spacing(2),
  justifyContent: 'center',
  alignItems: 'flex-start',
  position: 'relative',
  
  // Floating agent paths
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.05) 0%, transparent 1px),
      radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.05) 0%, transparent 1px)
    `,
    backgroundSize: '100px 100px',
    animation: 'drift 30s linear infinite',
    zIndex: 0,
  },

  '@keyframes drift': {
    '0%': { transform: 'translateX(0) translateY(0)' },
    '100%': { transform: 'translateX(-100px) translateY(-100px)' },
  },
}));

const FloatingActionButton = styled(Fab)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  right: theme.spacing(3),
  background: designTokens.glass.medium.background,
  backdropFilter: designTokens.glass.medium.backdrop,
  border: designTokens.glass.medium.border,
  color: theme.palette.primary.main,
  zIndex: 1000,
  
  '&:hover': {
    background: designTokens.glass.heavy.background,
    transform: 'scale(1.1) rotate(90deg)',
    boxShadow: `0 8px 32px 0 ${designTokens.colors.glass.blue}`,
  },

  '&::before': {
    content: '""',
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    background: 'linear-gradient(45deg, #3b82f6, #8b5cf6, #06d6a0)',
    borderRadius: '50%',
    zIndex: -1,
    animation: 'spin 3s linear infinite',
  },

  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
}));

const Dashboard: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState<any>({
    metrics: mockMetrics,
    agents: mockAgents,
    activities: []
  });
  const { agents, metrics, recentActivity } = useStore();
  const { emit } = useSocket();

  useEffect(() => {
    // Fetch initial data
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('http://localhost:3456/api/v1/dashboard/data', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      
      // Update dashboard data with real data
      setDashboardData({
        metrics: data.metrics || mockMetrics,
        agents: data.agents || mockAgents,
        activities: data.activities || []
      });
      
      // Also emit to socket for real-time updates
      emit('dashboard:updated', data);
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Keep using mock data as fallback
    } finally {
      setRefreshing(false);
    }
  };

  const handleAgentChat = (agent: any) => {
    setSelectedAgent(agent);
    setChatOpen(true);
  };

  const handleAgentSettings = async (agent: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      // For now, just log - in a real implementation, this would open a settings dialog
      console.log('Opening settings for agent:', agent.id);
      
      // You could emit an event or navigate to a settings page
      emit('agent:settings', { agentId: agent.id });
    } catch (error) {
      console.error('Failed to open agent settings:', error);
    }
  };

  const handleAgentToggle = async (agent: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`http://localhost:3456/api/v1/dashboard/agents/${agent.id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to toggle agent');
      }

      const result = await response.json();
      
      // Update the agent status in the dashboard data
      setDashboardData((prev: any) => ({
        ...prev,
        agents: prev.agents.map((a: any) => 
          a.id === agent.id ? { ...a, status: result.newStatus } : a
        )
      }));
      
      // Emit event for real-time updates
      emit('agent:toggled', { agentId: agent.id, newStatus: result.newStatus });
      
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  };

  return (
    <DashboardContainer>
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <WelcomeHeader variant="medium" rounded="2xl">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography
                variant="h3"
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 700,
                  fontSize: { xs: '2rem', md: '3rem' },
                  mb: 1,
                }}
              >
                AI Agent Command Center
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontFamily: designTokens.fonts.agent,
                  color: 'text.secondary',
                  opacity: 0.8,
                }}
              >
                Your autonomous workforce is optimizing workflows 24/7 ✨
              </Typography>
            </Box>
            
            <Box display="flex" gap={1}>
              <Tooltip title="Refresh Data">
                <IconButton
                  onClick={fetchDashboardData}
                  disabled={refreshing}
                  sx={{
                    background: designTokens.glass.light.background,
                    '&:hover': { background: designTokens.glass.medium.background },
                  }}
                >
                  <RefreshIcon 
                    sx={{ 
                      animation: refreshing ? 'spin 1s linear infinite' : 'none',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' },
                      },
                    }} 
                  />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Settings">
                <IconButton
                  sx={{
                    background: designTokens.glass.light.background,
                    '&:hover': { background: designTokens.glass.medium.background },
                  }}
                >
                  <SettingsIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </WelcomeHeader>
      </motion.div>

      {/* Metrics Grid */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard variant="medium" rounded="xl" hover accent="blue">
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="primary">
                    {dashboardData.metrics.totalWorkflows}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Workflows
                  </Typography>
                </Box>
                <CloudIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.7 }} />
              </Box>
            </MetricCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MetricCard variant="medium" rounded="xl" hover accent="green">
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    {dashboardData.metrics.successRate}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                </Box>
                <TrendingIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.7 }} />
              </Box>
            </MetricCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MetricCard variant="medium" rounded="xl" hover accent="purple">
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="secondary.main">
                    {dashboardData.metrics.avgResponseTime || dashboardData.metrics.avgExecutionTime || 0}ms
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Avg Response
                  </Typography>
                </Box>
                <SpeedIcon sx={{ fontSize: 40, color: 'secondary.main', opacity: 0.7 }} />
              </Box>
            </MetricCard>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <MetricCard variant="medium" rounded="xl" hover accent="orange">
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="warning.main">
                    {dashboardData.metrics.totalOptimizations || dashboardData.metrics.executionsToday || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    AI Optimizations
                  </Typography>
                </Box>
                <BrainIcon sx={{ fontSize: 40, color: 'warning.main', opacity: 0.7 }} />
              </Box>
            </MetricCard>
          </Grid>
        </Grid>
      </motion.div>

      {/* Agents Section */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        <GlassCard variant="light" rounded="2xl" sx={{ p: 3, mb: 4 }}>
          <Typography
            variant="h5"
            sx={{
              fontFamily: designTokens.fonts.agent,
              mb: 3,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontWeight: 600,
            }}
          >
            Your AI Agent Workforce
          </Typography>

          <AgentContainer>
            <AnimatePresence>
              {dashboardData.agents.map((agent: any, index: number) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, scale: 0, rotate: -180 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0, rotate: 180 }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.1,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                  whileHover={{ scale: 1.1, zIndex: 10 }}
                  style={{ zIndex: 1 }}
                >
                  <AgentBubble
                    agent={agent}
                    size="large"
                    interactive
                    showControls
                    onChat={() => handleAgentChat(agent)}
                    onSettings={() => handleAgentSettings(agent)}
                    onToggle={() => handleAgentToggle(agent)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </AgentContainer>
        </GlassCard>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6 }}
      >
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <GlassCard variant="medium" rounded="xl" sx={{ p: 3, height: 300 }}>
              <Typography variant="h6" sx={{ fontFamily: designTokens.fonts.agent, mb: 2 }}>
                Workflow Performance Chart
              </Typography>
              <Box 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
                  borderRadius: designTokens.borderRadius.lg,
                }}
              >
                <Typography 
                  variant="body1" 
                  sx={{ 
                    fontFamily: designTokens.fonts.agent,
                    opacity: 0.7,
                  }}
                >
                  Interactive charts loading... ✨
                </Typography>
              </Box>
            </GlassCard>
          </Grid>

          <Grid item xs={12} md={4}>
            <GlassCard variant="medium" rounded="xl" sx={{ p: 3, height: 300 }}>
              <Typography variant="h6" sx={{ fontFamily: designTokens.fonts.agent, mb: 2 }}>
                System Health
              </Typography>
              <Box display="flex" flexDirection="column" gap={2} height="100%" justifyContent="center">
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Uptime</Typography>
                  <Typography variant="h6" color="success.main">{dashboardData.metrics.uptime || 99.9}%</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Resource Usage</Typography>
                  <Typography variant="h6" color="warning.main">{dashboardData.metrics.resourceUsage || 67}%</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">Today's Executions</Typography>
                  <Typography variant="h6" color="primary.main">{dashboardData.metrics.executionsToday || dashboardData.metrics.todayExecutions || 0}</Typography>
                </Box>
              </Box>
            </GlassCard>
          </Grid>
        </Grid>
      </motion.div>

      {/* Floating Action Button */}
      <Zoom in={!isMobile}>
        <FloatingActionButton>
          <AddIcon />
        </FloatingActionButton>
      </Zoom>

      {/* Agent Chat Panel */}
      {selectedAgent && (
        <AgentChatPanel
          agent={selectedAgent}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          onMinimize={() => setChatOpen(false)}
        />
      )}
    </DashboardContainer>
  );
};

export default Dashboard;