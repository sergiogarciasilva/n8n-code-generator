import React, { useState, useRef, useEffect } from 'react';
import { styled, keyframes } from '@mui/material/styles';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Paper,
  Chip,
  Fade,
  Slide,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  Close as CloseIcon,
  Minimize as MinimizeIcon,
  AutoAwesome as MagicIcon,
  SmartToy as RobotIcon,
  Person as PersonIcon,
  Attachment as AttachIcon,
  Mood as MoodIcon,
} from '@mui/icons-material';
import GlassCard from '../ui/GlassCard';
import { designTokens } from '../../theme/designTokens';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  type?: 'text' | 'code' | 'suggestion' | 'workflow' | 'error';
  metadata?: {
    workflowId?: string;
    executionTime?: number;
    confidence?: number;
  };
}

interface AgentChatPanelProps {
  agent: {
    id: string;
    name: string;
    type: string;
    status: string;
    avatar?: string;
    mood?: string;
  };
  isOpen: boolean;
  isMinimized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  position?: { x: number; y: number };
}

// Typing indicator animation
const typing = keyframes`
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
`;

// Message slide in animation
const slideInMessage = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

// Glassmorphism panel
const StyledChatPanel = styled(GlassCard)<{ 
  isMinimized: boolean; 
  position?: { x: number; y: number } 
}>(({ theme, isMinimized, position }) => ({
  position: 'fixed',
  top: position?.y || '20%',
  right: position?.x || theme.spacing(3),
  width: isMinimized ? 300 : 420,
  height: isMinimized ? 60 : 600,
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1500,
  overflow: 'hidden',
  transition: `all ${designTokens.animation.duration.normal} ${designTokens.animation.easing.spring}`,
  transform: isMinimized ? 'scale(0.9)' : 'scale(1)',
  
  // Responsive design
  [theme.breakpoints.down('md')]: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },

  // Draggable handle
  '& .drag-handle': {
    cursor: 'move',
    userSelect: 'none',
  },
}));

const ChatHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${designTokens.glass.light.border}`,
  background: designTokens.glass.light.background,
  backdropFilter: designTokens.glass.light.backdrop,
}));

const ChatMessages = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: 'auto',
  padding: theme.spacing(1),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  
  // Custom scrollbar
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.5)',
    },
  },
}));

const MessageBubble = styled(GlassCard)<{ 
  sender: 'user' | 'agent';
  messageType?: string;
}>(({ theme, sender, messageType }) => ({
  maxWidth: '80%',
  padding: theme.spacing(1.5, 2),
  alignSelf: sender === 'user' ? 'flex-end' : 'flex-start',
  animation: `${slideInMessage} ${designTokens.animation.duration.normal} ${designTokens.animation.easing.spring}`,
  
  // User messages (right side)
  ...(sender === 'user' && {
    background: designTokens.colors.glass.blue,
    borderTopRightRadius: designTokens.borderRadius.sm,
  }),
  
  // Agent messages (left side)
  ...(sender === 'agent' && {
    background: designTokens.glass.medium.background,
    borderTopLeftRadius: designTokens.borderRadius.sm,
  }),

  // Special message types
  ...(messageType === 'code' && {
    background: designTokens.colors.glass.purple,
    fontFamily: designTokens.fonts.mono,
  }),

  ...(messageType === 'suggestion' && {
    background: designTokens.colors.glass.green,
    border: `1px solid rgba(34, 197, 94, 0.3)`,
  }),

  ...(messageType === 'error' && {
    background: designTokens.colors.glass.red,
    border: `1px solid rgba(239, 68, 68, 0.3)`,
  }),
}));

const MessageText = styled(Typography)<{ sender: 'user' | 'agent' }>(({ sender }) => ({
  fontFamily: sender === 'agent' ? designTokens.fonts.agent : designTokens.fonts.primary,
  fontSize: sender === 'agent' ? '0.95rem' : '0.9rem',
  lineHeight: 1.5,
  letterSpacing: sender === 'agent' ? '0.3px' : 'normal',
  fontWeight: sender === 'agent' ? 400 : 500,
}));

const ChatInput = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  borderTop: `1px solid ${designTokens.glass.light.border}`,
  background: designTokens.glass.light.background,
  backdropFilter: designTokens.glass.light.backdrop,
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    background: designTokens.glass.light.background,
    backdropFilter: designTokens.glass.light.backdrop,
    borderRadius: designTokens.borderRadius.xl,
    border: designTokens.glass.light.border,
    
    '& fieldset': {
      border: 'none',
    },
    
    '&:hover': {
      background: designTokens.glass.medium.background,
    },
    
    '&.Mui-focused': {
      background: designTokens.glass.medium.background,
      boxShadow: designTokens.shadows.glass.md,
    },
  },

  '& .MuiInputBase-input': {
    fontFamily: designTokens.fonts.primary,
    fontSize: '0.9rem',
    padding: theme.spacing(1.5, 2),
    
    '&::placeholder': {
      fontFamily: designTokens.fonts.agent,
      opacity: 0.7,
    },
  },
}));

const TypingIndicator = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  alignSelf: 'flex-start',
  
  '& .dot': {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: theme.palette.primary.main,
    animation: `${typing} 1.4s infinite`,
    
    '&:nth-of-type(2)': {
      animationDelay: '0.2s',
    },
    '&:nth-of-type(3)': {
      animationDelay: '0.4s',
    },
  },
}));

const AgentChatPanel: React.FC<AgentChatPanelProps> = ({
  agent,
  isOpen,
  isMinimized = false,
  onClose,
  onMinimize,
  position,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Hello! I'm ${agent.name}, your AI assistant. How can I help you optimize your workflows today?`,
      sender: 'agent',
      timestamp: new Date(),
      type: 'text',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date(),
      type: 'text',
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate agent response
    setTimeout(() => {
      const agentResponses = [
        "I understand! Let me analyze your workflow and suggest some optimizations.",
        "That's a great question! Based on my analysis, I recommend implementing error handling nodes.",
        "I can help you with that! Let me create a custom workflow template for your use case.",
        "Excellent idea! I'll generate the necessary connections and test them for you.",
        "I've processed your request and found 3 potential improvements. Would you like me to implement them?",
      ];

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: agentResponses[Math.floor(Math.random() * agentResponses.length)],
        sender: 'agent',
        timestamp: new Date(),
        type: Math.random() > 0.7 ? 'suggestion' : 'text',
        metadata: {
          confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
          executionTime: Math.random() * 500 + 100, // 100-600ms
        },
      };

      setIsTyping(false);
      setMessages(prev => [...prev, agentMessage]);
    }, 2000);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const getMessageIcon = (type?: string) => {
    switch (type) {
      case 'suggestion': return <MagicIcon fontSize="small" />;
      case 'workflow': return <RobotIcon fontSize="small" />;
      case 'error': return <MoodIcon fontSize="small" />;
      default: return null;
    }
  };

  if (!isOpen) return null;

  return (
    <Fade in={isOpen}>
      <StyledChatPanel
        variant="heavy"
        rounded="2xl"
        isMinimized={isMinimized}
        position={position}
      >
        {/* Header */}
        <ChatHeader className="drag-handle">
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              src={agent.avatar}
              sx={{
                width: 32,
                height: 32,
                background: `linear-gradient(135deg, #3b82f6, #8b5cf6)`,
              }}
            >
              <RobotIcon fontSize="small" />
            </Avatar>
            <Box>
              <Typography
                variant="subtitle2"
                sx={{
                  fontFamily: designTokens.fonts.agent,
                  fontWeight: 600,
                }}
              >
                {agent.name}
              </Typography>
              <Chip
                label={agent.status}
                size="small"
                variant="outlined"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  borderRadius: designTokens.borderRadius.full,
                }}
              />
            </Box>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            {onMinimize && (
              <IconButton
                size="small"
                onClick={onMinimize}
                sx={{
                  background: designTokens.glass.light.background,
                  '&:hover': { background: designTokens.glass.medium.background },
                }}
              >
                <MinimizeIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton
              size="small"
              onClick={onClose}
              sx={{
                background: designTokens.glass.light.background,
                '&:hover': { background: designTokens.colors.glass.red },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </ChatHeader>

        {!isMinimized && (
          <>
            {/* Messages */}
            <ChatMessages>
              {messages.map((message) => (
                <Box key={message.id} display="flex" alignItems="flex-start" gap={1}>
                  {message.sender === 'agent' && (
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        background: 'transparent',
                      }}
                    >
                      <RobotIcon fontSize="small" color="primary" />
                    </Avatar>
                  )}
                  
                  <MessageBubble
                    variant="light"
                    rounded="lg"
                    sender={message.sender}
                    messageType={message.type}
                  >
                    <Box display="flex" alignItems="center" gap={1}>
                      {getMessageIcon(message.type)}
                      <MessageText sender={message.sender}>
                        {message.content}
                      </MessageText>
                    </Box>
                    
                    {message.metadata && (
                      <Box mt={1}>
                        <Typography
                          variant="caption"
                          sx={{
                            opacity: 0.7,
                            fontSize: '0.7rem',
                          }}
                        >
                          {message.metadata.confidence && 
                            `Confidence: ${Math.round(message.metadata.confidence * 100)}%`
                          }
                          {message.metadata.executionTime && 
                            ` • ${message.metadata.executionTime}ms`
                          }
                        </Typography>
                      </Box>
                    )}
                  </MessageBubble>

                  {message.sender === 'user' && (
                    <Avatar
                      sx={{
                        width: 24,
                        height: 24,
                        background: 'transparent',
                      }}
                    >
                      <PersonIcon fontSize="small" color="primary" />
                    </Avatar>
                  )}
                </Box>
              ))}

              {/* Typing Indicator */}
              {isTyping && (
                <TypingIndicator>
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      background: 'transparent',
                    }}
                  >
                    <RobotIcon fontSize="small" color="primary" />
                  </Avatar>
                  <GlassCard variant="light" rounded="lg" sx={{ p: 1, display: 'flex', gap: 0.5 }}>
                    <Box className="dot" />
                    <Box className="dot" />
                    <Box className="dot" />
                  </GlassCard>
                </TypingIndicator>
              )}

              <div ref={messagesEndRef} />
            </ChatMessages>

            {/* Input */}
            <ChatInput>
              <IconButton
                size="small"
                sx={{
                  background: designTokens.glass.light.background,
                  '&:hover': { background: designTokens.glass.medium.background },
                }}
              >
                <AttachIcon fontSize="small" />
              </IconButton>

              <StyledTextField
                fullWidth
                size="small"
                placeholder="Ask me anything about workflows..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                multiline
                maxRows={3}
              />

              <IconButton
                onClick={handleSendMessage}
                disabled={!inputValue.trim()}
                sx={{
                  background: inputValue.trim() 
                    ? designTokens.colors.glass.blue 
                    : designTokens.glass.light.background,
                  '&:hover': {
                    background: designTokens.colors.glass.blue,
                    transform: 'scale(1.05)',
                  },
                  transition: `all ${designTokens.animation.duration.fast} ${designTokens.animation.easing.ease}`,
                }}
              >
                <SendIcon fontSize="small" />
              </IconButton>
            </ChatInput>
          </>
        )}
      </StyledChatPanel>
    </Fade>
  );
};

export default AgentChatPanel;