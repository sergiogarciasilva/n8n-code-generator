import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  Fab,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  Card,
  CardContent,
  CardActions,
} from '@mui/material';
import {
  Send,
  SmartToy,
  Close,
  AutoFixHigh,
  Code,
  Help,
  Lightbulb,
  ThumbUp,
  ThumbDown,
  ContentCopy,
  PlayArrow,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { useSocket } from '../../contexts/SocketContext';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'code' | 'suggestion' | 'error';
  metadata?: any;
}

interface Suggestion {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
}

const AIAssistant: React.FC = () => {
  const { agents, workflows } = useStore();
  const { emit } = useSocket();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load chat history from localStorage
    const savedMessages = localStorage.getItem('aiAssistantMessages');
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      // Add welcome message
      setMessages([{
        id: '1',
        role: 'assistant',
        content: `👋 Hi! I'm your AI assistant. I can help you with:
- Creating and configuring agents
- Optimizing workflows
- Analyzing performance metrics
- Troubleshooting issues
- Writing code for custom workflows

What can I help you with today?`,
        timestamp: new Date(),
        type: 'text',
      }]);
    }
  }, []);

  useEffect(() => {
    // Save messages to localStorage
    if (messages.length > 0) {
      localStorage.setItem('aiAssistantMessages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    // Scroll to bottom when new messages are added
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Generate contextual suggestions
    const newSuggestions: Suggestion[] = [
      {
        id: '1',
        title: 'Create a new agent',
        description: 'Set up an AI agent to monitor workflows',
        icon: <SmartToy />,
        action: () => handleSuggestionClick('How do I create a new agent?'),
      },
      {
        id: '2',
        title: 'Optimize workflows',
        description: 'Get AI recommendations for improvements',
        icon: <AutoFixHigh />,
        action: () => handleSuggestionClick('Can you analyze my workflows and suggest optimizations?'),
      },
      {
        id: '3',
        title: 'Write custom code',
        description: 'Generate code for n8n workflows',
        icon: <Code />,
        action: () => handleSuggestionClick('Help me write a custom function for my workflow'),
      },
      {
        id: '4',
        title: 'Troubleshoot issues',
        description: 'Debug errors and performance problems',
        icon: <Help />,
        action: () => handleSuggestionClick('My workflow is failing, can you help debug it?'),
      },
    ];
    
    setSuggestions(newSuggestions);
  }, [agents, workflows]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
      type: 'text',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Simulate AI response
      const response = await generateAIResponse(input);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        type: response.type,
        metadata: response.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        type: 'error',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const generateAIResponse = async (prompt: string): Promise<{ content: string; type: Message['type']; metadata?: any }> => {
    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Pattern matching for different types of queries
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('create') && lowerPrompt.includes('agent')) {
      return {
        content: `To create a new agent, follow these steps:

1. Navigate to the **Agents** page
2. Click the **"Create Agent"** button
3. Choose your agent type:
   - **MCP Agent**: For Model Context Protocol workflows
   - **Telegram Agent**: For Telegram bot automation
   - **Multi-Agent System**: For complex, distributed tasks

4. Configure the agent settings:
   - Set a descriptive name
   - Define the schedule (cron expression)
   - Enable auto-fix if you want automatic optimizations
   - Set max concurrent workflows

Would you like me to create an agent for you right now?`,
        type: 'text',
      };
    }

    if (lowerPrompt.includes('optimize') || lowerPrompt.includes('workflow')) {
      return {
        content: `I've analyzed your workflows and found several optimization opportunities:

\`\`\`javascript
// Optimization 1: Batch API calls
// Instead of:
items.forEach(async (item) => {
  await apiCall(item);
});

// Use:
const results = await Promise.all(
  items.map(item => apiCall(item))
);
\`\`\`

**Key recommendations:**
1. ⚡ Batch similar operations to reduce execution time
2. 🔄 Implement proper error handling with retries
3. 📊 Add logging for better debugging
4. 🚀 Use caching for frequently accessed data

Would you like me to apply these optimizations automatically?`,
        type: 'code',
        metadata: {
          optimizations: 4,
          estimatedImprovement: '35%',
        },
      };
    }

    if (lowerPrompt.includes('debug') || lowerPrompt.includes('error') || lowerPrompt.includes('failing')) {
      return {
        content: `I can help you debug the workflow issue. Based on the error patterns, here are the most likely causes:

1. **API Rate Limiting** (40% probability)
   - Add exponential backoff between retries
   - Implement request queuing

2. **Data Format Mismatch** (30% probability)
   - Validate input data schema
   - Add type checking

3. **Timeout Issues** (20% probability)
   - Increase timeout settings
   - Break large operations into chunks

Let me check your specific workflow logs... 

\`\`\`json
{
  "error": "ETIMEDOUT",
  "workflow": "Data Processing Pipeline",
  "node": "HTTP Request",
  "timestamp": "2024-01-20T12:30:00Z"
}
\`\`\`

It looks like you're experiencing timeout issues. Would you like me to fix this automatically?`,
        type: 'code',
      };
    }

    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('write')) {
      return {
        content: `Here's a custom function for your n8n workflow:

\`\`\`javascript
// Custom function to process and transform data
function processWorkflowData(items) {
  return items.map(item => {
    // Data validation
    if (!item.id || !item.data) {
      throw new Error('Invalid item structure');
    }
    
    // Transform the data
    return {
      id: item.id,
      processedAt: new Date().toISOString(),
      data: {
        ...item.data,
        // Add custom transformations
        normalized: normalizeData(item.data),
        enriched: enrichWithMetadata(item.data)
      },
      metrics: {
        processingTime: Date.now() - item.startTime,
        dataQuality: calculateDataQuality(item.data)
      }
    };
  });
}

// Helper functions
function normalizeData(data) {
  // Add your normalization logic
  return data;
}

function enrichWithMetadata(data) {
  // Add metadata enrichment
  return { ...data, source: 'ai-processor' };
}

function calculateDataQuality(data) {
  // Implement quality scoring
  return Object.keys(data).length > 5 ? 'high' : 'medium';
}
\`\`\`

This function includes error handling, data transformation, and metrics tracking. Would you like me to explain any part or modify it for your specific use case?`,
        type: 'code',
      };
    }

    // Default response for general queries
    return {
      content: `I understand you're asking about "${prompt}". Based on the current system state:

- **Active Agents**: ${agents.filter(a => a.status === 'active').length} running
- **Total Workflows**: ${workflows?.length || 0} configured
- **System Health**: Optimal

How can I help you specifically with this topic? You can ask me to:
- Provide detailed analysis
- Generate code examples
- Create configurations
- Troubleshoot specific issues`,
      type: 'text',
    };
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    // Show toast notification
  };

  const handleRunCode = (code: string) => {
    emit('ai:execute:code', { code });
  };

  const renderMessage = (message: Message) => {
    if (message.type === 'code') {
      // Extract code blocks manually
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = codeBlockRegex.exec(message.content)) !== null) {
        // Add text before code block
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: message.content.slice(lastIndex, match.index),
          });
        }

        // Add code block
        parts.push({
          type: 'code',
          language: match[1] || 'javascript',
          content: match[2].trim(),
        });

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < message.content.length) {
        parts.push({
          type: 'text',
          content: message.content.slice(lastIndex),
        });
      }

      return (
        <Box>
          {parts.map((part, index) => {
            if (part.type === 'code') {
              return (
                <Box key={index} sx={{ position: 'relative', my: 1 }}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor: 'grey.900',
                      color: 'grey.100',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      overflow: 'auto',
                    }}
                  >
                    <pre style={{ margin: 0 }}>{part.content}</pre>
                  </Paper>
                  <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleCopyCode(part.content)}
                      sx={{ bgcolor: 'background.paper', opacity: 0.8 }}
                    >
                      <ContentCopy fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleRunCode(part.content)}
                      sx={{ bgcolor: 'background.paper', opacity: 0.8 }}
                    >
                      <PlayArrow fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              );
            }
            return (
              <Typography key={index} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {part.content}
              </Typography>
            );
          })}
        </Box>
      );
    }

    return (
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {message.content}
      </Typography>
    );
  };

  return (
    <>
      {/* Floating AI Assistant Button */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1200,
          background: 'linear-gradient(45deg, #ff6d00 30%, #ff9800 90%)',
        }}
        onClick={() => setOpen(!open)}
      >
        {open ? <Close /> : <SmartToy />}
      </Fab>

      {/* AI Assistant Chat Window */}
      <Collapse in={open}>
        <Paper
          elevation={8}
          sx={{
            position: 'fixed',
            bottom: 100,
            right: 24,
            width: 400,
            height: 600,
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1100,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              background: 'linear-gradient(45deg, #ff6d00 30%, #ff9800 90%)',
              color: 'white',
            }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar sx={{ bgcolor: 'white', color: 'primary.main' }}>
                <SmartToy />
              </Avatar>
              <Box>
                <Typography variant="h6">AI Assistant</Typography>
                <Typography variant="caption">Always here to help</Typography>
              </Box>
            </Box>
          </Box>

          {/* Messages */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: '80%',
                        p: 2,
                        borderRadius: 2,
                        bgcolor: message.role === 'user' ? 'primary.main' : 'grey.100',
                        color: message.role === 'user' ? 'white' : 'text.primary',
                      }}
                    >
                      {renderMessage(message)}
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 1,
                          opacity: 0.7,
                        }}
                      >
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {loading && (
              <Box display="flex" alignItems="center" gap={1} sx={{ ml: 2 }}>
                <CircularProgress size={16} />
                <Typography variant="body2" color="text.secondary">
                  AI is thinking...
                </Typography>
              </Box>
            )}
            
            <div ref={messagesEndRef} />
          </Box>

          {/* Suggestions */}
          {messages.length === 1 && (
            <Box sx={{ px: 2, pb: 2 }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Quick actions:
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {suggestions.map((suggestion) => (
                  <Chip
                    key={suggestion.id}
                    label={suggestion.title}
                    icon={suggestion.icon as any}
                    onClick={suggestion.action}
                    size="small"
                    variant="outlined"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Input */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box display="flex" gap={1}>
              <TextField
                ref={inputRef}
                fullWidth
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask me anything..."
                multiline
                maxRows={3}
                size="small"
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim() || loading}
              >
                <Send />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Collapse>
    </>
  );
};

export default AIAssistant;