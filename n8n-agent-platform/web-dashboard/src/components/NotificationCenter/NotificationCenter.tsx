import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Button,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  InputAdornment,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Notifications as NotificationIcon,
  CheckCircle,
  Error,
  Warning,
  Info,
  AutoFixHigh,
  Close,
  DoneAll,
  Search,
  NotificationsOff,
  Schedule,
  FilterList,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'optimization';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
  metadata?: any;
}

const NotificationCenter: React.FC = () => {
  const { notifications: storeNotifications, removeNotification } = useStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [doNotDisturb, setDoNotDisturb] = useState(false);

  // Fetch notifications from API
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch('http://localhost:3456/api/v1/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      
      // Transform API data to match component interface
      const transformedNotifications: Notification[] = data.notifications.map((n: any) => ({
        id: n.id,
        type: n.type || 'info',
        title: n.title,
        message: n.message,
        timestamp: new Date(n.created_at),
        read: n.read || false,
        priority: n.priority || 'medium',
        actions: n.actions || [],
        metadata: n.metadata || {}
      }));
      
      setNotifications(transformedNotifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      
      // Fallback to mock data for development
      const mockNotifications: Notification[] = [
        {
          id: '1',
          type: 'success',
          title: 'Workflow Optimized',
          message: 'Customer Onboarding Flow has been optimized successfully',
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
          read: false,
          priority: 'medium',
          actions: [
            { label: 'View Changes', action: () => handleNotificationAction('1', 'view') },
          ],
        },
        {
          id: '2',
          type: 'error',
          title: 'Agent Error',
          message: 'Multi-Agent System encountered an error while processing',
          timestamp: new Date(Date.now() - 1000 * 60 * 10),
          read: false,
          priority: 'high',
          actions: [
            { label: 'View Details', action: () => handleNotificationAction('2', 'view') },
            { label: 'Restart Agent', action: () => handleNotificationAction('2', 'restart') },
          ],
        },
        {
          id: '3',
          type: 'optimization',
          title: 'New Optimization Available',
          message: '5 new optimization suggestions for Data Processing Pipeline',
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          read: true,
          priority: 'medium',
          actions: [
            { label: 'Review', action: () => handleNotificationAction('3', 'review') },
          ],
        },
      ];
      
      setNotifications(mockNotifications);
    }
  };

  // Check for browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`http://localhost:3456/api/v1/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === id ? { ...notif, read: true } : notif
          )
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleNotificationAction = async (notificationId: string, action: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`http://localhost:3456/api/v1/notifications/${notificationId}/action`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        throw new Error('Failed to perform notification action');
      }

      const result = await response.json();
      
      // Handle redirect if provided
      if (result.redirect) {
        window.location.href = result.redirect;
      } else if (result.message) {
        console.log('Action result:', result.message);
      }

      // Mark notification as read after action
      await handleMarkAsRead(notificationId);
      
    } catch (error) {
      console.error('Failed to perform notification action:', error);
    }
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) =>
      prev.map((notif) => ({ ...notif, read: true }))
    );
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`http://localhost:3456/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((notif) => notif.id !== id));
        removeNotification(id);
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleSnooze = async (id: string, duration: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`http://localhost:3456/api/v1/notifications/${id}/snooze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ duration })
      });

      if (response.ok) {
        const result = await response.json();
        // Remove notification from view temporarily
        setNotifications((prev) => prev.filter((notif) => notif.id !== id));
        console.log(`Snoozed notification until ${result.snoozedUntil}`);
      }
    } catch (error) {
      console.error('Failed to snooze notification:', error);
    }
  };

  const sendBrowserNotification = (notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted' && !doNotDisturb) {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/icon-192x192.png',
        tag: notification.id,
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'optimization':
        return <AutoFixHigh color="info" />;
      default:
        return <Info color="info" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      default:
        return 'default';
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && !notif.read) ||
      (filter === 'critical' && (notif.priority === 'critical' || notif.priority === 'high'));
    
    const matchesSearch =
      !searchTerm ||
      notif.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.message.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;
  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        onClick={handleOpen}
        color="inherit"
        sx={{ position: 'relative' }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationIcon />
        </Badge>
        {doNotDisturb && (
          <NotificationsOff
            sx={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              fontSize: 16,
              bgcolor: 'background.paper',
              borderRadius: '50%',
            }}
          />
        )}
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            width: 420,
            maxHeight: 600,
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Notifications</Typography>
            <Box display="flex" gap={1}>
              <IconButton size="small" onClick={handleMarkAllAsRead}>
                <DoneAll />
              </IconButton>
              <IconButton size="small" onClick={handleClose}>
                <Close />
              </IconButton>
            </Box>
          </Box>
          
          <Box mt={2}>
            <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} variant="fullWidth">
              <Tab label={`All (${notifications.length})`} />
              <Tab label={`Unread (${unreadCount})`} />
              <Tab label="Settings" />
            </Tabs>
          </Box>
        </Box>

        {tabValue === 0 || tabValue === 1 ? (
          <>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
              />
              
              <Box mt={1}>
                <ToggleButtonGroup
                  value={filter}
                  exclusive
                  onChange={(e, value) => value && setFilter(value)}
                  size="small"
                  fullWidth
                >
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="unread">Unread</ToggleButton>
                  <ToggleButton value="critical">Critical</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Box>

            <List sx={{ maxHeight: 400, overflow: 'auto', p: 0 }}>
              <AnimatePresence>
                {filteredNotifications.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <NotificationIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      No notifications
                    </Typography>
                  </Box>
                ) : (
                  filteredNotifications.map((notification, index) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <ListItem
                        sx={{
                          bgcolor: notification.read ? 'transparent' : 'action.hover',
                          borderBottom: 1,
                          borderColor: 'divider',
                          '&:hover': {
                            bgcolor: 'action.selected',
                          },
                        }}
                      >
                        <ListItemIcon>
                          {getNotificationIcon(notification.type)}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography variant="subtitle2" fontWeight={notification.read ? 400 : 600}>
                                {notification.title}
                              </Typography>
                              <Chip
                                label={notification.priority}
                                size="small"
                                color={getPriorityColor(notification.priority) as any}
                              />
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" color="text.secondary">
                                {notification.message}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(notification.timestamp).toLocaleTimeString()}
                              </Typography>
                            </>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleDelete(notification.id)}
                          >
                            <Close fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      
                      {notification.actions && notification.actions.length > 0 && (
                        <Box sx={{ px: 2, py: 1, bgcolor: 'background.default' }}>
                          {notification.actions.map((action, idx) => (
                            <Button
                              key={idx}
                              size="small"
                              onClick={() => {
                                action.action();
                                handleMarkAsRead(notification.id);
                              }}
                              sx={{ mr: 1 }}
                            >
                              {action.label}
                            </Button>
                          ))}
                          <Button
                            size="small"
                            startIcon={<Schedule />}
                            onClick={() => handleSnooze(notification.id, 30)}
                          >
                            Snooze
                          </Button>
                        </Box>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </List>
          </>
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
              Notification Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={doNotDisturb}
                  onChange={(e) => setDoNotDisturb(e.target.checked)}
                />
              }
              label="Do Not Disturb"
            />
            
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              When enabled, you won't receive browser notifications
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="subtitle2" gutterBottom>
              Notification Types
            </Typography>
            
            {['Errors', 'Warnings', 'Success', 'Optimizations', 'System Updates'].map((type) => (
              <FormControlLabel
                key={type}
                control={<Switch defaultChecked />}
                label={type}
                sx={{ display: 'block', mb: 1 }}
              />
            ))}
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationCenter;