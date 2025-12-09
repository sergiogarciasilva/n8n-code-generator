import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  InputAdornment,
  Paper,
  Divider,
} from '@mui/material';
import {
  Search,
  Dashboard,
  SmartToy,
  AccountTree,
  Timeline,
  Analytics,
  Settings,
  PlayArrow,
  Stop,
  Add,
  AutoFixHigh,
  NavigateNext,
  History,
  Keyboard,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { useSocket } from '../../contexts/SocketContext';
import { Agent } from '@n8n-agent-platform/shared';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  category: 'navigation' | 'action' | 'search' | 'recent';
  icon: React.ReactNode;
  keywords: string[];
  action: () => void;
  shortcut?: string;
}

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const { agents } = useStore();
  const { emit } = useSocket();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent commands from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recentCommands');
    if (recent) {
      setRecentCommands(JSON.parse(recent));
    }
  }, []);

  // Keyboard shortcut to open (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      
      if (open) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleExecuteCommand(filteredCommands[selectedIndex]);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const baseCommands: CommandItem[] = [
    // Navigation commands
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      category: 'navigation',
      icon: <Dashboard />,
      keywords: ['dashboard', 'home', 'overview'],
      action: () => navigate('/dashboard'),
      shortcut: 'G D',
    },
    {
      id: 'nav-agents',
      title: 'Go to Agents',
      category: 'navigation',
      icon: <SmartToy />,
      keywords: ['agents', 'ai', 'bots'],
      action: () => navigate('/agents'),
      shortcut: 'G A',
    },
    {
      id: 'nav-workflows',
      title: 'Go to Workflows',
      category: 'navigation',
      icon: <AccountTree />,
      keywords: ['workflows', 'flows', 'automation'],
      action: () => navigate('/workflows'),
      shortcut: 'G W',
    },
    {
      id: 'nav-activity',
      title: 'Go to Activity',
      category: 'navigation',
      icon: <Timeline />,
      keywords: ['activity', 'timeline', 'history'],
      action: () => navigate('/activity'),
      shortcut: 'G T',
    },
    {
      id: 'nav-metrics',
      title: 'Go to Metrics',
      category: 'navigation',
      icon: <Analytics />,
      keywords: ['metrics', 'analytics', 'performance'],
      action: () => navigate('/metrics'),
      shortcut: 'G M',
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      category: 'navigation',
      icon: <Settings />,
      keywords: ['settings', 'config', 'preferences'],
      action: () => navigate('/settings'),
      shortcut: 'G S',
    },
    
    // Action commands
    {
      id: 'action-create-agent',
      title: 'Create New Agent',
      description: 'Create a new AI agent',
      category: 'action',
      icon: <Add />,
      keywords: ['create', 'new', 'agent', 'add'],
      action: () => {
        navigate('/agents');
        // Trigger create agent dialog
        window.dispatchEvent(new CustomEvent('createAgent'));
      },
      shortcut: 'C A',
    },
    {
      id: 'action-optimize-all',
      title: 'Optimize All Workflows',
      description: 'Run optimization on all active workflows',
      category: 'action',
      icon: <AutoFixHigh />,
      keywords: ['optimize', 'all', 'workflows', 'improve'],
      action: () => {
        emit('workflows:optimize:all');
      },
    },
  ];

  // Dynamic commands based on current data
  const dynamicCommands = useMemo(() => {
    const commands: CommandItem[] = [];
    
    // Add agent-specific commands
    agents.forEach((agent) => {
      commands.push({
        id: `agent-start-${agent.id}`,
        title: `Start ${agent.name}`,
        description: `Start the ${agent.type} agent`,
        category: 'action',
        icon: <PlayArrow />,
        keywords: ['start', 'agent', agent.name.toLowerCase(), agent.type],
        action: () => emit('agent:start', { agentId: agent.id }),
      });
      
      commands.push({
        id: `agent-stop-${agent.id}`,
        title: `Stop ${agent.name}`,
        description: `Stop the ${agent.type} agent`,
        category: 'action',
        icon: <Stop />,
        keywords: ['stop', 'agent', agent.name.toLowerCase(), agent.type],
        action: () => emit('agent:stop', { agentId: agent.id }),
      });
    });
    
    return commands;
  }, [agents, emit]);

  const allCommands = [...baseCommands, ...dynamicCommands];

  // Fuzzy search function
  const fuzzyMatch = (str: string, pattern: string) => {
    const patternLower = pattern.toLowerCase();
    const strLower = str.toLowerCase();
    
    let patternIdx = 0;
    let strIdx = 0;
    let score = 0;
    let consecutive = 0;
    
    while (strIdx < strLower.length && patternIdx < patternLower.length) {
      if (strLower[strIdx] === patternLower[patternIdx]) {
        score += 1 + consecutive;
        consecutive++;
        patternIdx++;
      } else {
        consecutive = 0;
      }
      strIdx++;
    }
    
    return patternIdx === patternLower.length ? score : 0;
  };

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) {
      // Show recent commands when no search
      const recentItems = recentCommands
        .map((id) => allCommands.find((cmd) => cmd.id === id))
        .filter(Boolean) as CommandItem[];
      
      return [
        ...recentItems.map((cmd) => ({ ...cmd, category: 'recent' as const })),
        ...allCommands.filter((cmd) => !recentCommands.includes(cmd.id)),
      ].slice(0, 8);
    }
    
    const results = allCommands
      .map((command) => {
        const titleScore = fuzzyMatch(command.title, search) * 2;
        const descScore = command.description ? fuzzyMatch(command.description, search) : 0;
        const keywordScore = command.keywords.reduce(
          (acc, keyword) => acc + fuzzyMatch(keyword, search),
          0
        );
        
        const totalScore = titleScore + descScore + keywordScore;
        
        return { command, score: totalScore };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ command }) => command);
    
    return results.slice(0, 8);
  }, [search, allCommands, recentCommands]);

  const handleExecuteCommand = (command: CommandItem) => {
    if (!command) return;
    
    // Add to recent commands
    const newRecent = [command.id, ...recentCommands.filter((id) => id !== command.id)].slice(0, 5);
    setRecentCommands(newRecent);
    localStorage.setItem('recentCommands', JSON.stringify(newRecent));
    
    // Execute command
    command.action();
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    setSearch('');
    setSelectedIndex(0);
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'navigation':
        return 'Navigate';
      case 'action':
        return 'Actions';
      case 'search':
        return 'Search';
      case 'recent':
        return 'Recent';
      default:
        return category;
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
      >
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Paper
            elevation={4}
            sx={{
              p: 2,
              borderRadius: 2,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'background.paper',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
            onClick={() => setOpen(true)}
          >
            <Search />
            <Typography variant="body2">Quick Search</Typography>
            <Chip label="⌘K" size="small" />
          </Paper>
        </motion.div>
      </Box>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            position: 'fixed',
            top: '20%',
            m: 0,
            borderRadius: 2,
            maxHeight: '60vh',
          },
        }}
      >
        <DialogContent sx={{ p: 0 }}>
          <TextField
            ref={inputRef}
            fullWidth
            placeholder="Type a command or search..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
              sx: {
                fontSize: '1.1rem',
                py: 1.5,
                '& fieldset': { border: 'none' },
              },
            }}
          />
          
          <Divider />
          
          <List sx={{ py: 1, maxHeight: '50vh', overflow: 'auto' }}>
            {filteredCommands.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No commands found
                </Typography>
              </Box>
            ) : (
              filteredCommands.map((command, index) => (
                <React.Fragment key={command.id}>
                  {index === 0 || command.category !== filteredCommands[index - 1].category ? (
                    <ListItem>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ px: 2, py: 0.5 }}
                      >
                        {getCategoryLabel(command.category)}
                      </Typography>
                    </ListItem>
                  ) : null}
                  
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <ListItem
                      button
                      selected={selectedIndex === index}
                      onClick={() => handleExecuteCommand(command)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      sx={{
                        borderRadius: 1,
                        mx: 1,
                        '&.Mui-selected': {
                          bgcolor: 'action.selected',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {command.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={command.title}
                        secondary={command.description}
                        primaryTypographyProps={{
                          fontWeight: selectedIndex === index ? 600 : 400,
                        }}
                      />
                      {command.shortcut && (
                        <Chip
                          label={command.shortcut}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                      {command.category === 'recent' && (
                        <History sx={{ ml: 1, color: 'text.secondary', fontSize: 16 }} />
                      )}
                    </ListItem>
                  </motion.div>
                </React.Fragment>
              ))
            )}
          </List>
          
          <Divider />
          
          <Box sx={{ p: 1.5, display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Keyboard sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                to navigate
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Chip label="↵" size="small" />
              <Typography variant="caption" color="text.secondary">
                to select
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={0.5}>
              <Chip label="esc" size="small" />
              <Typography variant="caption" color="text.secondary">
                to close
              </Typography>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CommandPalette;