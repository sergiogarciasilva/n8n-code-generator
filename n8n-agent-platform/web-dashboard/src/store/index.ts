import { create } from 'zustand';
import { Agent, DashboardMetrics, WorkflowAnalysis } from '@n8n-agent-platform/shared';

interface AppState {
  // UI State
  sidebarOpen: boolean;
  darkMode: boolean;
  
  // Data State
  agents: Agent[];
  workflows: any[];
  metrics: DashboardMetrics | null;
  recentActivity: any[];
  selectedWorkflow: string | null;
  
  // Real-time updates
  notifications: Notification[];
  
  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleDarkMode: () => void;
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  setMetrics: (metrics: DashboardMetrics) => void;
  addActivity: (activity: any) => void;
  setSelectedWorkflow: (workflowId: string | null) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: Date;
}

export const useStore = create<AppState>((set) => ({
  // Initial state
  sidebarOpen: true,
  darkMode: false,
  agents: [],
  workflows: [],
  metrics: null,
  recentActivity: [],
  selectedWorkflow: null,
  notifications: [],
  
  // Actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  
  setAgents: (agents) => set({ agents }),
  updateAgent: (agentId, updates) =>
    set((state) => ({
      agents: state.agents.map((agent) =>
        agent.id === agentId ? { ...agent, ...updates } : agent
      ),
    })),
  
  setMetrics: (metrics) => set({ metrics }),
  
  addActivity: (activity) =>
    set((state) => ({
      recentActivity: [activity, ...state.recentActivity].slice(0, 100),
    })),
  
  setSelectedWorkflow: (workflowId) => set({ selectedWorkflow: workflowId }),
  
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 10),
    })),
  
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));