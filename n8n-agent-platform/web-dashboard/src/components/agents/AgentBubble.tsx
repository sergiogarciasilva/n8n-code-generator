import React, { useState, useEffect } from 'react';
import { styled, keyframes } from '@mui/material/styles';
import { 
  Box, 
  Typography, 
  Avatar, 
  Chip, 
  IconButton,
  Tooltip,
  Fade,
  Zoom
} from '@mui/material';
import { 
  SmartToy as RobotIcon,
  AutoAwesome as MagicIcon,
  Bolt as LightningIcon,
  Favorite as HeartIcon,
  Chat as ChatIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import GlassCard from '../ui/GlassCard';
import { designTokens } from '../../theme/designTokens';

interface AgentBubbleProps {
  agent: {
    id: string;
    name: string;
    type: 'mcp' | 'telegram' | 'multi-agent';
    status: 'active' | 'idle' | 'error' | 'processing';
    avatar?: string;
    lastMessage?: string;
    performance: {
      tasksCompleted: number;
      successRate: number;
      avgResponseTime: number;
    };
    mood?: 'happy' | 'working' | 'thinking' | 'sleeping' | 'excited';
  };
  size?: 'small' | 'medium' | 'large';
  interactive?: boolean;
  showControls?: boolean;
  onChat?: () => void;
  onSettings?: () => void;
  onToggle?: () => void;
}

// Floating animation
const float = keyframes`
  0%, 100% { 
    transform: translateY(0px) rotate(0deg); 
  }
  50% { 
    transform: translateY(-10px) rotate(1deg); 
  }
`;

// Pulse animation for active agents
const pulse = keyframes`
  0%, 100% { 
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
  }
  50% { 
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
`;

// Thinking animation
const thinking = keyframes`
  0%, 100% { 
    opacity: 0.6;
    transform: scale(1);
  }
  50% { 
    opacity: 1;
    transform: scale(1.05);
  }
`;

const StyledAgentBubble = styled(GlassCard)<{ 
  size: string; 
  status: string; 
  interactive: boolean;
  mood: string;
}>(({ theme, size, status, interactive, mood }) => {
  const sizeMap = {
    small: { width: 80, height: 80, padding: 8 },
    medium: { width: 120, height: 120, padding: 12 },
    large: { width: 160, height: 160, padding: 16 },
  };

  const statusColors = {
    active: designTokens.colors.glass.blue,
    idle: designTokens.colors.glass.purple,
    error: designTokens.colors.glass.red,
    processing: designTokens.colors.glass.orange,
  };

  const dimensions = sizeMap[size as keyof typeof sizeMap];

  return {
    width: dimensions.width,
    height: dimensions.height,
    padding: dimensions.padding,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderRadius: designTokens.borderRadius.full,
    background: statusColors[status as keyof typeof statusColors],
    animation: `${float} 3s ease-in-out infinite`,
    cursor: interactive ? 'pointer' : 'default',

    // Status-specific animations
    ...(status === 'active' && {
      animation: `${float} 3s ease-in-out infinite, ${pulse} 2s infinite`,
    }),

    ...(status === 'processing' && {
      animation: `${float} 3s ease-in-out infinite, ${thinking} 1.5s ease-in-out infinite`,
    }),

    // Mood-based effects
    ...(mood === 'excited' && {
      animation: `${float} 1s ease-in-out infinite`,
    }),

    ...(mood === 'sleeping' && {
      opacity: 0.7,
      filter: 'grayscale(0.3)',
    }),

    // Hover effects for interactive bubbles
    ...(interactive && {
      '&:hover': {
        transform: 'scale(1.1)',
        animation: 'none',
        boxShadow: `0 8px 32px 0 ${statusColors[status as keyof typeof statusColors]}, 0 0 20px ${statusColors[status as keyof typeof statusColors]}`,
      },
    }),

    // Controls overlay
    '& .controls-overlay': {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      opacity: 0,
      transition: `opacity ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,
      display: 'flex',
      gap: theme.spacing(1),
      zIndex: 10,
    },

    '&:hover .controls-overlay': {
      opacity: 1,
    },

    // Speech bubble for messages
    '& .speech-bubble': {
      position: 'absolute',
      top: -60,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: 200,
      padding: theme.spacing(1, 2),
      borderRadius: designTokens.borderRadius.lg,
      background: designTokens.glass.medium.background,
      backdropFilter: designTokens.glass.medium.backdrop,
      border: designTokens.glass.medium.border,
      opacity: 0,
      transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.spring}`,
      zIndex: 5,

      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: -8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: `8px solid ${designTokens.glass.medium.background}`,
      },

      '&.show': {
        opacity: 1,
        transform: 'translateX(-50%) translateY(-10px)',
      },
    },
  };
});

const AgentName = styled(Typography)(({ theme }) => ({
  fontFamily: designTokens.fonts.agent,
  fontSize: '0.875rem',
  fontWeight: 400,
  textAlign: 'center',
  color: theme.palette.text.primary,
  marginTop: theme.spacing(1),
  textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
  letterSpacing: '0.5px',
}));

const StatusChip = styled(Chip)<{ status: string }>(({ theme, status }) => {
  const statusColors = {
    active: { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' },
    idle: { bg: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' },
    error: { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' },
    processing: { bg: 'rgba(249, 115, 22, 0.2)', color: '#f97316' },
  };

  const colors = statusColors[status as keyof typeof statusColors];

  return {
    position: 'absolute',
    top: -8,
    right: -8,
    height: 20,
    fontSize: '0.6rem',
    fontWeight: 600,
    backgroundColor: colors.bg,
    color: colors.color,
    borderRadius: designTokens.borderRadius.full,
    border: `1px solid ${colors.color}20`,
    '& .MuiChip-label': {
      padding: '0 6px',
    },
  };
});

const AgentAvatar = styled(Avatar)<{ mood: string; size: string }>(({ theme, mood, size }) => {
  const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
  };

  const moodFilters = {
    happy: 'hue-rotate(20deg) saturate(1.2)',
    working: 'hue-rotate(240deg) saturate(1.1)',
    thinking: 'hue-rotate(280deg) saturate(0.9)',
    sleeping: 'grayscale(0.5) brightness(0.8)',
    excited: 'hue-rotate(60deg) saturate(1.5) brightness(1.1)',
  };

  return {
    width: sizeMap[size as keyof typeof sizeMap],
    height: sizeMap[size as keyof typeof sizeMap],
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    filter: moodFilters[mood as keyof typeof moodFilters],
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
    transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.ease}`,
  };
});

const ControlButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  background: designTokens.glass.light.background,
  backdropFilter: designTokens.glass.light.backdrop,
  border: designTokens.glass.light.border,
  borderRadius: designTokens.borderRadius.full,
  color: theme.palette.primary.main,
  transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.ease}`,

  '&:hover': {
    background: designTokens.glass.medium.background,
    transform: 'scale(1.1)',
    boxShadow: designTokens.shadows.glass.md,
  },

  '& .MuiSvgIcon-root': {
    fontSize: '1rem',
  },
}));

const AgentBubble: React.FC<AgentBubbleProps> = ({
  agent,
  size = 'medium',
  interactive = true,
  showControls = true,
  onChat,
  onSettings,
  onToggle,
}) => {
  const [showMessage, setShowMessage] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Show last message periodically for active agents
  useEffect(() => {
    if (agent.status === 'active' && agent.lastMessage) {
      const interval = setInterval(() => {
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 3000);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [agent.status, agent.lastMessage]);

  const getAgentIcon = () => {
    switch (agent.type) {
      case 'mcp': return <MagicIcon />;
      case 'telegram': return <ChatIcon />;
      case 'multi-agent': return <LightningIcon />;
      default: return <RobotIcon />;
    }
  };

  const getMoodIcon = () => {
    switch (agent.mood) {
      case 'happy': return <HeartIcon fontSize="small" sx={{ color: '#f59e0b' }} />;
      case 'excited': return <LightningIcon fontSize="small" sx={{ color: '#f59e0b' }} />;
      default: return null;
    }
  };

  return (
    <Box
      position="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <StyledAgentBubble
        variant="medium"
        size={size}
        status={agent.status}
        interactive={interactive}
        mood={agent.mood || 'happy'}
        hover={interactive}
        glow={agent.status === 'active'}
        glowColor={agent.status === 'error' ? 'red' : 'blue'}
      >
        {/* Status Chip */}
        <StatusChip
          status={agent.status}
          label={agent.status.toUpperCase()}
          size="small"
        />

        {/* Agent Avatar */}
        <AgentAvatar
          mood={agent.mood || 'happy'}
          size={size}
          src={agent.avatar}
        >
          {!agent.avatar && getAgentIcon()}
        </AgentAvatar>

        {/* Mood Indicator */}
        {agent.mood && (
          <Box position="absolute" top={8} left={8}>
            {getMoodIcon()}
          </Box>
        )}

        {/* Agent Name */}
        <AgentName variant="caption">
          {agent.name}
        </AgentName>

        {/* Controls Overlay */}
        {showControls && (
          <Box className="controls-overlay">
            <Tooltip title="Chat with Agent" placement="top">
              <ControlButton onClick={onChat} size="small">
                <ChatIcon />
              </ControlButton>
            </Tooltip>

            <Tooltip title={agent.status === 'active' ? 'Pause' : 'Start'} placement="top">
              <ControlButton onClick={onToggle} size="small">
                {agent.status === 'active' ? <PauseIcon /> : <PlayIcon />}
              </ControlButton>
            </Tooltip>

            <Tooltip title="Settings" placement="top">
              <ControlButton onClick={onSettings} size="small">
                <SettingsIcon />
              </ControlButton>
            </Tooltip>
          </Box>
        )}

        {/* Speech Bubble for Messages */}
        {agent.lastMessage && (
          <Box className={`speech-bubble ${showMessage ? 'show' : ''}`}>
            <Typography
              variant="caption"
              sx={{
                fontFamily: designTokens.fonts.agent,
                fontSize: '0.75rem',
                color: 'text.primary',
                display: 'block',
              }}
            >
              {agent.lastMessage}
            </Typography>
          </Box>
        )}
      </StyledAgentBubble>

      {/* Performance Metrics Tooltip */}
      {isHovered && (
        <Fade in={isHovered}>
          <GlassCard
            variant="medium"
            rounded="lg"
            sx={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              mt: 2,
              p: 2,
              minWidth: 200,
              zIndex: 20,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontFamily: designTokens.fonts.agent,
                mb: 1,
                textAlign: 'center',
              }}
            >
              Agent Performance
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="caption">
                Tasks: {agent.performance.tasksCompleted}
              </Typography>
              <Typography variant="caption">
                Success: {agent.performance.successRate}%
              </Typography>
              <Typography variant="caption">
                Avg Response: {agent.performance.avgResponseTime}ms
              </Typography>
            </Box>
          </GlassCard>
        </Fade>
      )}
    </Box>
  );
};

export default AgentBubble;