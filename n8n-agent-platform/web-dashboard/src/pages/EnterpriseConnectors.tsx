import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tab,
  Tabs,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Search,
  Add,
  Business,
  Cloud,
  Storage,
  People,
  AccountBalance,
  Extension,
  Settings,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  ExpandMore,
  ExpandLess,
  Refresh,
  Delete,
  Edit,
  PlayArrow,
  Stop,
  ContentCopy,
  Download,
  Upload,
  Security,
  Speed,
  Api,
  Cable,
  Link,
  LinkOff,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import { designTokens } from '../theme/designTokens';
import { useStore } from '../store';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';

// Types
interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  documentationUrl: string;
  supportedOperations: string[];
  rateLimit?: {
    requests: number;
    window: string;
  };
}

interface Connection {
  id: string;
  name: string;
  connectorId: string;
  connectorName: string;
  connectorIcon: string;
  connectorCategory: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  lastUsed?: string;
}

interface ConnectorUsage {
  connectorId: string;
  connectionCount: number;
  apiCallsToday: number;
  apiCallsMonth: number;
  errors24h: number;
  errorRate?: string;
  lastUsed?: string;
}

interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'number' | 'boolean';
  required: boolean;
  placeholder?: string;
  helpText?: string;
  default?: any;
}

// Connector credentials schemas
const CONNECTOR_CREDENTIALS: Record<string, CredentialField[]> = {
  salesforce: [
    { name: 'loginUrl', label: 'Login URL', type: 'url', required: true, default: 'https://login.salesforce.com', helpText: 'Use test.salesforce.com for sandbox' },
    { name: 'username', label: 'Username', type: 'email', required: true, placeholder: 'user@company.com' },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'securityToken', label: 'Security Token', type: 'password', required: true, helpText: 'Reset from Salesforce settings if needed' },
    { name: 'apiVersion', label: 'API Version', type: 'text', required: false, default: '57.0' },
    { name: 'sandbox', label: 'Sandbox Environment', type: 'boolean', required: false, default: false },
  ],
  sap: [
    { name: 'host', label: 'Host', type: 'text', required: true, placeholder: 'sap.company.com' },
    { name: 'port', label: 'Port', type: 'number', required: false, default: 443 },
    { name: 'client', label: 'Client', type: 'text', required: true, placeholder: '100' },
    { name: 'username', label: 'Username', type: 'text', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true },
    { name: 'language', label: 'Language', type: 'text', required: false, default: 'EN' },
    { name: 'systemNumber', label: 'System Number', type: 'text', required: false, default: '00' },
  ],
};

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  crm: <People />,
  erp: <Business />,
  hr: <People />,
  finance: <AccountBalance />,
  custom: <Extension />,
};

const EnterpriseConnectors: React.FC = () => {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [usage, setUsage] = useState<ConnectorUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [connectionDialog, setConnectionDialog] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [connectionForm, setConnectionForm] = useState<any>({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState(0);

  const navigate = useNavigate();
  const { user } = useStore();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [connectorsRes, connectionsRes, usageRes] = await Promise.all([
        api.get('/enterprise/connectors'),
        api.get('/enterprise/connections'),
        api.get('/enterprise/usage'),
      ]);

      setConnectors(connectorsRes.data.connectors);
      setConnections(connectionsRes.data.connections);
      setUsage(usageRes.data.usage);
    } catch (error) {
      console.error('Failed to fetch enterprise data:', error);
      toast.error('Failed to load enterprise connectors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!selectedConnector) return;

    try {
      // Validate required fields
      const credentialFields = CONNECTOR_CREDENTIALS[selectedConnector.id] || [];
      const missingFields = credentialFields
        .filter(field => field.required && !connectionForm[field.name])
        .map(field => field.label);

      if (missingFields.length > 0) {
        toast.error(`Missing required fields: ${missingFields.join(', ')}`);
        return;
      }

      const response = await api.post('/enterprise/connections', {
        connectorId: selectedConnector.id,
        name: connectionForm.name,
        credentials: connectionForm,
        metadata: {},
      });

      toast.success('Connection created successfully');
      setConnectionDialog(false);
      setConnectionForm({});
      setSelectedConnector(null);
      setConnectionTestResult(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create connection');
    }
  };

  const handleTestConnection = async () => {
    if (!selectedConnector) return;

    setTestingConnection(true);
    setConnectionTestResult(null);

    try {
      const response = await api.post('/enterprise/connections/test', {
        connectorId: selectedConnector.id,
        credentials: connectionForm,
      });

      setConnectionTestResult(response.data);
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.response?.data?.error || 'Connection test failed',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;

    try {
      await api.delete(`/enterprise/connections/${connectionId}`);
      toast.success('Connection deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete connection');
    }
  };

  const handleExecuteOperation = (connectionId: string) => {
    navigate(`/enterprise/playground/${connectionId}`);
  };

  const filteredConnectors = connectors.filter(connector => {
    const matchesSearch = connector.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         connector.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || connector.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getConnectionStats = (connectorId: string) => {
    const connectorUsage = usage.find(u => u.connectorId === connectorId);
    const connectorConnections = connections.filter(c => c.connectorId === connectorId);
    
    return {
      connections: connectorConnections.length,
      apiCalls: connectorUsage?.apiCallsToday || 0,
      errors: connectorUsage?.errors24h || 0,
      errorRate: connectorUsage?.errorRate || '0%',
    };
  };

  const renderConnectorCard = (connector: Connector) => {
    const stats = getConnectionStats(connector.id);
    const isExpanded = expandedConnector === connector.id;
    const connectorConnections = connections.filter(c => c.connectorId === connector.id);

    return (
      <Grid item xs={12} key={connector.id}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GlassCard
            variant="medium"
            rounded="xl"
            hover
            sx={{
              p: 3,
              borderLeft: `4px solid ${designTokens.colors.glass.blue}`,
            }}
          >
            <Box display="flex" alignItems="flex-start" justifyContent="space-between">
              <Box display="flex" alignItems="center" gap={2} flex={1}>
                <Box
                  sx={{
                    fontSize: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {connector.icon}
                </Box>
                
                <Box flex={1}>
                  <Typography variant="h6" fontWeight="bold">
                    {connector.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {connector.description}
                  </Typography>
                  
                  <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                    <Chip
                      size="small"
                      icon={CATEGORY_ICONS[connector.category]}
                      label={connector.category.toUpperCase()}
                    />
                    <Chip
                      size="small"
                      icon={<Cable />}
                      label={`${stats.connections} connections`}
                      color={stats.connections > 0 ? 'success' : 'default'}
                    />
                    <Chip
                      size="small"
                      icon={<Api />}
                      label={`${stats.apiCalls} API calls today`}
                    />
                    {stats.errors > 0 && (
                      <Chip
                        size="small"
                        icon={<Warning />}
                        label={`${stats.errorRate} error rate`}
                        color="warning"
                      />
                    )}
                  </Box>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gap={1}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => {
                    setSelectedConnector(connector);
                    setConnectionDialog(true);
                    setConnectionForm({ name: `${connector.name} Connection` });
                  }}
                >
                  New Connection
                </Button>
                <IconButton
                  onClick={() => setExpandedConnector(isExpanded ? null : connector.id)}
                >
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
            </Box>

            <Collapse in={isExpanded}>
              <Box mt={3}>
                {connectorConnections.length === 0 ? (
                  <Alert severity="info">
                    No connections configured for this connector yet.
                  </Alert>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Connection Name</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Last Used</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {connectorConnections.map((connection) => (
                          <TableRow key={connection.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="bold">
                                {connection.name}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                icon={<CheckCircle />}
                                label="Active"
                                color="success"
                              />
                            </TableCell>
                            <TableCell>
                              {connection.lastUsed
                                ? new Date(connection.lastUsed).toLocaleDateString()
                                : 'Never'}
                            </TableCell>
                            <TableCell>
                              {new Date(connection.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell align="right">
                              <Tooltip title="Test Connection">
                                <IconButton
                                  size="small"
                                  onClick={() => handleExecuteOperation(connection.id)}
                                >
                                  <PlayArrow />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton size="small">
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteConnection(connection.id)}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                <Box mt={2} display="flex" gap={2}>
                  <Button
                    size="small"
                    startIcon={<Api />}
                    onClick={() => window.open(connector.documentationUrl, '_blank')}
                  >
                    API Documentation
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => {
                      // Generate usage report
                      toast.success('Generating usage report...');
                    }}
                  >
                    Download Usage Report
                  </Button>
                </Box>
              </Box>
            </Collapse>
          </GlassCard>
        </motion.div>
      </Grid>
    );
  };

  const renderConnectionDialog = () => {
    if (!selectedConnector) return null;

    const credentialFields = CONNECTOR_CREDENTIALS[selectedConnector.id] || [];

    return (
      <Dialog
        open={connectionDialog}
        onClose={() => {
          setConnectionDialog(false);
          setConnectionForm({});
          setSelectedConnector(null);
          setConnectionTestResult(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <Box fontSize={32}>{selectedConnector.icon}</Box>
            <Typography variant="h6">
              Create {selectedConnector.name} Connection
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <TextField
              fullWidth
              label="Connection Name"
              value={connectionForm.name || ''}
              onChange={(e) =>
                setConnectionForm({ ...connectionForm, name: e.target.value })
              }
              margin="normal"
              required
            />

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 2 }}>
              Connection Credentials
            </Typography>

            {credentialFields.map((field) => (
              <Box key={field.name} mb={2}>
                {field.type === 'boolean' ? (
                  <FormControl fullWidth>
                    <InputLabel>{field.label}</InputLabel>
                    <Select
                      value={connectionForm[field.name] || field.default || false}
                      onChange={(e) =>
                        setConnectionForm({
                          ...connectionForm,
                          [field.name]: e.target.value === 'true',
                        })
                      }
                      label={field.label}
                    >
                      <MenuItem value="true">Yes</MenuItem>
                      <MenuItem value="false">No</MenuItem>
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    fullWidth
                    label={field.label}
                    type={field.type}
                    value={connectionForm[field.name] || field.default || ''}
                    onChange={(e) =>
                      setConnectionForm({
                        ...connectionForm,
                        [field.name]: e.target.value,
                      })
                    }
                    placeholder={field.placeholder}
                    helperText={field.helpText}
                    required={field.required}
                    InputProps={{
                      ...(field.type === 'password' && {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small">
                              <Security />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }),
                    }}
                  />
                )}
              </Box>
            ))}

            {connectionTestResult && (
              <Alert
                severity={connectionTestResult.success ? 'success' : 'error'}
                sx={{ mt: 2 }}
              >
                <Typography variant="subtitle2">
                  {connectionTestResult.message}
                </Typography>
                {connectionTestResult.metadata && (
                  <Box mt={1}>
                    <Typography variant="caption" component="div">
                      Organization: {connectionTestResult.metadata.organizationId}
                    </Typography>
                    <Typography variant="caption" component="div">
                      User: {connectionTestResult.metadata.username}
                    </Typography>
                  </Box>
                )}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectionDialog(false)}>Cancel</Button>
          <Button
            onClick={handleTestConnection}
            disabled={testingConnection}
            startIcon={testingConnection ? <CircularProgress size={16} /> : <Api />}
          >
            Test Connection
          </Button>
          <Button
            onClick={handleCreateConnection}
            variant="contained"
            disabled={!connectionTestResult?.success}
          >
            Create Connection
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const renderUsageOverview = () => {
    const totalConnections = connections.length;
    const totalApiCalls = usage.reduce((sum, u) => sum + u.apiCallsMonth, 0);
    const totalErrors = usage.reduce((sum, u) => sum + u.errors24h, 0);
    const avgErrorRate = totalApiCalls > 0 ? ((totalErrors / totalApiCalls) * 100).toFixed(2) : '0';

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <GlassCard variant="light" rounded="xl" sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Total Connections
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {totalConnections}
                </Typography>
              </Box>
              <Link fontSize="large" color="primary" />
            </Box>
          </GlassCard>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <GlassCard variant="light" rounded="xl" sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  API Calls (Month)
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {totalApiCalls.toLocaleString()}
                </Typography>
              </Box>
              <Api fontSize="large" color="success" />
            </Box>
          </GlassCard>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <GlassCard variant="light" rounded="xl" sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Error Rate
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {avgErrorRate}%
                </Typography>
              </Box>
              <Warning fontSize="large" color="warning" />
            </Box>
          </GlassCard>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <GlassCard variant="light" rounded="xl" sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Active Connectors
                </Typography>
                <Typography variant="h4" fontWeight="bold">
                  {connectors.length}
                </Typography>
              </Box>
              <Extension fontSize="large" color="secondary" />
            </Box>
          </GlassCard>
        </Grid>
      </Grid>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Enterprise Connectors
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Connect to enterprise systems like Salesforce, SAP, and more
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button variant="outlined" startIcon={<Upload />}>
            Import Custom Connector
          </Button>
          <IconButton onClick={fetchData}>
            <Refresh />
          </IconButton>
        </Box>
      </Box>

      {/* Usage Overview */}
      {renderUsageOverview()}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} sx={{ mb: 3 }}>
        <Tab label="Available Connectors" />
        <Tab label="My Connections" />
        <Tab label="Usage Analytics" />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && (
        <>
          {/* Search and Filters */}
          <GlassCard variant="light" rounded="xl" sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Search connectors..."
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
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="all">All Categories</MenuItem>
                    <MenuItem value="crm">CRM</MenuItem>
                    <MenuItem value="erp">ERP</MenuItem>
                    <MenuItem value="hr">HR</MenuItem>
                    <MenuItem value="finance">Finance</MenuItem>
                    <MenuItem value="custom">Custom</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </GlassCard>

          {/* Connectors List */}
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {filteredConnectors.map(renderConnectorCard)}
            </Grid>
          )}
        </>
      )}

      {activeTab === 1 && (
        <Typography>My Connections (Coming Soon)</Typography>
      )}

      {activeTab === 2 && (
        <Typography>Usage Analytics (Coming Soon)</Typography>
      )}

      {/* Connection Dialog */}
      {renderConnectionDialog()}
    </Box>
  );
};

export default EnterpriseConnectors;