import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Box } from '@mui/material';
import theme from './theme';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Workflows from './pages/Workflows';
import Activity from './pages/Activity';
import Metrics from './pages/Metrics';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import EnterpriseConnectors from './pages/EnterpriseConnectors';
import { SocketProvider } from './contexts/SocketContext';
import { useStore } from './store';
import OnboardingTour from './components/Onboarding/OnboardingTour';
import CommandPalette from './components/CommandPalette/CommandPalette';
import NotificationCenter from './components/NotificationCenter/NotificationCenter';
import AIAssistant from './components/AIAssistant/AIAssistant';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SocketProvider>
        <Box sx={{ display: 'flex', height: '100vh', bgcolor: 'background.default' }}>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/metrics" element={<Metrics />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/enterprise" element={<EnterpriseConnectors />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
          
          {/* Global Components */}
          <OnboardingTour />
          <CommandPalette />
          <AIAssistant />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#fff',
                boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
              },
            }}
          />
        </Box>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;