import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Chip,
  Alert,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save,
  Notifications,
  Security,
  Api,
  Schedule,
  Language,
  Delete,
  Add,
  Edit,
  Key,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useStore } from '../store';
import { toast } from 'react-hot-toast';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const Settings: React.FC = () => {
  const { darkMode, toggleDarkMode } = useStore();
  const [tabValue, setTabValue] = useState(0);
  const [apiKeyDialog, setApiKeyDialog] = useState(false);
  const [settings, setSettings] = useState({
    general: {
      platformName: 'n8n Agent Platform',
      defaultAgentType: 'mcp',
      autoStartAgents: true,
      debugMode: false,
    },
    notifications: {
      emailEnabled: true,
      email: 'admin@example.com',
      slackEnabled: false,
      slackWebhook: '',
      errorNotifications: true,
      successNotifications: false,
      optimizationNotifications: true,
    },
    performance: {
      maxConcurrentAgents: 10,
      workflowTimeout: 300,
      retryAttempts: 3,
      cacheEnabled: true,
      cacheTTL: 3600,
    },
    api: {
      n8nApiUrl: 'https://api.n8n.io',
      openaiModel: 'gpt-4',
      claudeModel: 'claude-3-opus',
      rateLimit: 100,
    },
  });

  const [apiKeys, setApiKeys] = useState([
    { id: '1', name: 'OpenAI API', key: 'sk-...', lastUsed: '2024-01-20' },
    { id: '2', name: 'Claude API', key: 'sk-ant-...', lastUsed: '2024-01-19' },
    { id: '3', name: 'n8n API', key: 'n8n_...', lastUsed: '2024-01-20' },
  ]);

  const handleSettingChange = (category: string, field: string, value: any) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category as keyof typeof settings],
        [field]: value,
      },
    });
  };

  const handleSaveSettings = () => {
    // Save settings logic
    toast.success('Settings saved successfully');
  };

  const handleAddApiKey = (name: string, key: string) => {
    setApiKeys([
      ...apiKeys,
      {
        id: Date.now().toString(),
        name,
        key: `${key.slice(0, 5)}...`,
        lastUsed: 'Never',
      },
    ]);
    setApiKeyDialog(false);
    toast.success('API key added successfully');
  };

  const handleDeleteApiKey = (id: string) => {
    setApiKeys(apiKeys.filter((key) => key.id !== id));
    toast.success('API key deleted');
  };

  const GeneralSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          General Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            label="Platform Name"
            value={settings.general.platformName}
            onChange={(e) => handleSettingChange('general', 'platformName', e.target.value)}
            fullWidth
          />
          
          <FormControl fullWidth>
            <InputLabel>Default Agent Type</InputLabel>
            <Select
              value={settings.general.defaultAgentType}
              onChange={(e) => handleSettingChange('general', 'defaultAgentType', e.target.value)}
              label="Default Agent Type"
            >
              <MenuItem value="mcp">MCP Agent</MenuItem>
              <MenuItem value="telegram">Telegram Agent</MenuItem>
              <MenuItem value="multi-agent">Multi-Agent System</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={settings.general.autoStartAgents}
                onChange={(e) => handleSettingChange('general', 'autoStartAgents', e.target.checked)}
              />
            }
            label="Auto-start agents on platform startup"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.general.debugMode}
                onChange={(e) => handleSettingChange('general', 'debugMode', e.target.checked)}
              />
            }
            label="Enable debug mode"
          />

          <FormControlLabel
            control={
              <Switch
                checked={darkMode}
                onChange={toggleDarkMode}
              />
            }
            label="Dark mode"
          />
        </Box>
      </CardContent>
    </Card>
  );

  const NotificationSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Notification Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.emailEnabled}
                  onChange={(e) => handleSettingChange('notifications', 'emailEnabled', e.target.checked)}
                />
              }
              label="Email Notifications"
            />
            {settings.notifications.emailEnabled && (
              <TextField
                label="Email Address"
                value={settings.notifications.email}
                onChange={(e) => handleSettingChange('notifications', 'email', e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
              />
            )}
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications.slackEnabled}
                  onChange={(e) => handleSettingChange('notifications', 'slackEnabled', e.target.checked)}
                />
              }
              label="Slack Notifications"
            />
            {settings.notifications.slackEnabled && (
              <TextField
                label="Slack Webhook URL"
                value={settings.notifications.slackWebhook}
                onChange={(e) => handleSettingChange('notifications', 'slackWebhook', e.target.value)}
                fullWidth
                sx={{ mt: 2 }}
              />
            )}
          </Box>

          <Divider />

          <Typography variant="subtitle2">Notification Types</Typography>
          
          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.errorNotifications}
                onChange={(e) => handleSettingChange('notifications', 'errorNotifications', e.target.checked)}
              />
            }
            label="Error notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.successNotifications}
                onChange={(e) => handleSettingChange('notifications', 'successNotifications', e.target.checked)}
              />
            }
            label="Success notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.notifications.optimizationNotifications}
                onChange={(e) => handleSettingChange('notifications', 'optimizationNotifications', e.target.checked)}
              />
            }
            label="Optimization suggestions"
          />
        </Box>
      </CardContent>
    </Card>
  );

  const PerformanceSettings = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Performance Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography gutterBottom>
              Max Concurrent Agents: {settings.performance.maxConcurrentAgents}
            </Typography>
            <Slider
              value={settings.performance.maxConcurrentAgents}
              onChange={(e, value) => handleSettingChange('performance', 'maxConcurrentAgents', value)}
              min={1}
              max={50}
              marks
              step={1}
            />
          </Box>

          <Box>
            <Typography gutterBottom>
              Workflow Timeout: {settings.performance.workflowTimeout}s
            </Typography>
            <Slider
              value={settings.performance.workflowTimeout}
              onChange={(e, value) => handleSettingChange('performance', 'workflowTimeout', value)}
              min={30}
              max={600}
              step={30}
              marks={[
                { value: 30, label: '30s' },
                { value: 300, label: '5m' },
                { value: 600, label: '10m' },
              ]}
            />
          </Box>

          <TextField
            label="Retry Attempts"
            type="number"
            value={settings.performance.retryAttempts}
            onChange={(e) => handleSettingChange('performance', 'retryAttempts', parseInt(e.target.value))}
            InputProps={{ inputProps: { min: 0, max: 10 } }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.performance.cacheEnabled}
                onChange={(e) => handleSettingChange('performance', 'cacheEnabled', e.target.checked)}
              />
            }
            label="Enable caching"
          />

          {settings.performance.cacheEnabled && (
            <TextField
              label="Cache TTL (seconds)"
              type="number"
              value={settings.performance.cacheTTL}
              onChange={(e) => handleSettingChange('performance', 'cacheTTL', parseInt(e.target.value))}
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );

  const ApiSettings = () => (
    <>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">API Keys</Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setApiKeyDialog(true)}
              size="small"
            >
              Add Key
            </Button>
          </Box>
          <List>
            {apiKeys.map((apiKey) => (
              <ListItem key={apiKey.id} divider>
                <ListItemText
                  primary={apiKey.name}
                  secondary={`Key: ${apiKey.key} • Last used: ${apiKey.lastUsed}`}
                />
                <ListItemSecondaryAction>
                  <IconButton edge="end" onClick={() => handleDeleteApiKey(apiKey.id)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            API Configuration
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="n8n API URL"
              value={settings.api.n8nApiUrl}
              onChange={(e) => handleSettingChange('api', 'n8nApiUrl', e.target.value)}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>OpenAI Model</InputLabel>
              <Select
                value={settings.api.openaiModel}
                onChange={(e) => handleSettingChange('api', 'openaiModel', e.target.value)}
                label="OpenAI Model"
              >
                <MenuItem value="gpt-4">GPT-4</MenuItem>
                <MenuItem value="gpt-4-turbo">GPT-4 Turbo</MenuItem>
                <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Claude Model</InputLabel>
              <Select
                value={settings.api.claudeModel}
                onChange={(e) => handleSettingChange('api', 'claudeModel', e.target.value)}
                label="Claude Model"
              >
                <MenuItem value="claude-3-opus">Claude 3 Opus</MenuItem>
                <MenuItem value="claude-3-sonnet">Claude 3 Sonnet</MenuItem>
                <MenuItem value="claude-3-haiku">Claude 3 Haiku</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Rate Limit (requests/minute)"
              type="number"
              value={settings.api.rateLimit}
              onChange={(e) => handleSettingChange('api', 'rateLimit', parseInt(e.target.value))}
            />
          </Box>
        </CardContent>
      </Card>
    </>
  );

  const ApiKeyDialog = () => {
    const [name, setName] = useState('');
    const [key, setKey] = useState('');

    return (
      <Dialog open={apiKeyDialog} onClose={() => setApiKeyDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add API Key</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Key Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              placeholder="e.g., OpenAI Production"
            />
            <TextField
              label="API Key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              fullWidth
              type="password"
              placeholder="sk-..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApiKeyDialog(false)}>Cancel</Button>
          <Button
            onClick={() => handleAddApiKey(name, key)}
            variant="contained"
            disabled={!name || !key}
          >
            Add Key
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        Settings
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Changes will be applied after saving. Some settings may require a platform restart.
      </Alert>

      <Card>
        <Tabs
          value={tabValue}
          onChange={(e, value) => setTabValue(value)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="General" icon={<Language />} iconPosition="start" />
          <Tab label="Notifications" icon={<Notifications />} iconPosition="start" />
          <Tab label="Performance" icon={<Schedule />} iconPosition="start" />
          <Tab label="API & Security" icon={<Security />} iconPosition="start" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <GeneralSettings />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <NotificationSettings />
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            <PerformanceSettings />
          </TabPanel>
          <TabPanel value={tabValue} index={3}>
            <ApiSettings />
          </TabPanel>
        </Box>
      </Card>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSaveSettings}
          sx={{
            background: 'linear-gradient(45deg, #ff6d00 30%, #ff9800 90%)',
            boxShadow: '0 3px 5px 2px rgba(255, 105, 0, .3)',
          }}
        >
          Save Settings
        </Button>
      </Box>

      <ApiKeyDialog />
    </Box>
  );
};

export default Settings;