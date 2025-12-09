import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { useStore } from '../store';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => void;
  off: (event: string, callback?: (data: any) => void) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  emit: () => {},
  on: () => {},
  off: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { updateAgent, addActivity, addNotification } = useStore();

  useEffect(() => {
    const socketInstance = io('http://localhost:3456', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      toast.success('Connected to agent platform');
      
      // Identify as dashboard
      socketInstance.emit('identify', {
        type: 'dashboard',
        metadata: { version: '1.0.0' }
      });
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      toast.error('Disconnected from agent platform');
    });

    // Handle real-time updates
    socketInstance.on('agent:status:update', (data) => {
      updateAgent(data.agentId, { status: data.status });
      
      addNotification({
        id: `agent-status-${Date.now()}`,
        type: 'info',
        title: 'Agent Status Changed',
        message: `Agent ${data.agentId} is now ${data.status}`,
        timestamp: new Date(),
      });
    });

    socketInstance.on('workflow:changed', (data) => {
      addActivity({
        type: 'workflow_change',
        ...data,
      });
      
      toast.success(`Workflow ${data.workflowId} optimized by ${data.agentId}`);
    });

    socketInstance.on('optimization:suggestion', (data) => {
      addActivity({
        type: 'suggestion',
        ...data,
      });
    });

    socketInstance.on('agent:execution:complete', (data) => {
      const { agentId, result } = data;
      
      addNotification({
        id: `execution-${Date.now()}`,
        type: result.success ? 'success' : 'error',
        title: `Agent Execution ${result.success ? 'Completed' : 'Failed'}`,
        message: `${result.changes?.length || 0} changes applied`,
        timestamp: new Date(),
      });
    });

    socketInstance.on('metrics:update', (data) => {
      // Handle metrics updates
      console.log('Metrics update:', data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.close();
    };
  }, []);

  const emit = (event: string, data?: any) => {
    if (socket && connected) {
      socket.emit(event, data);
    }
  };

  const on = (event: string, callback: (data: any) => void) => {
    if (socket) {
      socket.on(event, callback);
    }
  };

  const off = (event: string, callback?: (data: any) => void) => {
    if (socket) {
      socket.off(event, callback);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, connected, emit, on, off }}>
      {children}
    </SocketContext.Provider>
  );
};