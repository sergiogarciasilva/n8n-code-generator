const { app, BrowserWindow, Tray, Menu, shell, dialog, ipcMain, Notification } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');
const net = require('net');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Global variables
let mainWindow = null;
let tray = null;
let services = {
  postgres: null,
  redis: null,
  apiServer: null,
  webDashboard: null
};

// Service status
let serviceStatus = {
  postgres: 'stopped',
  redis: 'stopped',
  apiServer: 'stopped',
  webDashboard: 'stopped'
};

// Configuration
const config = {
  apiPort: process.env.API_PORT || 3000,
  dashboardPort: process.env.DASHBOARD_PORT || 5173,
  postgresPort: process.env.POSTGRES_PORT || 5432,
  redisPort: process.env.REDIS_PORT || 6379,
  useDocker: false // Can be toggled based on Docker availability
};

// Check if a port is in use
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(true); // Port is in use
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Port is free
    });
    server.listen(port);
  });
}

// Check if Docker is available
async function checkDocker() {
  try {
    await execAsync('docker --version');
    const { stdout } = await execAsync('docker compose version || docker-compose --version');
    console.log('Docker found:', stdout.trim());
    return true;
  } catch (error) {
    console.log('Docker not found, will use native services');
    return false;
  }
}

// Create the application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'n8n Agent Platform',
    show: false // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the dashboard URL with retry logic
  let retries = 0;
  const maxRetries = 10;
  
  function loadDashboard() {
    const dashboardUrl = `http://localhost:${config.dashboardPort}`;
    
    mainWindow.loadURL(dashboardUrl).catch((error) => {
      console.error('Failed to load dashboard:', error);
      if (retries < maxRetries) {
        retries++;
        setTimeout(loadDashboard, 2000);
      } else {
        mainWindow.loadFile(path.join(__dirname, 'loading.html'));
      }
    });
  }

  // Start loading after a short delay
  setTimeout(loadDashboard, 2000);

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent window from closing, minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      if (process.platform === 'win32') {
        showNotification('n8n Agent Platform', 'Application minimized to system tray');
      }
    }
    return false;
  });
}

// Show notification
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: path.join(__dirname, 'assets', 'icon.png')
    }).show();
  }
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, 'assets', process.platform === 'darwin' ? 'tray-icon.png' : 'icon.png');
  
  // Create icon if it doesn't exist
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found, using default');
  }
  
  tray = new Tray(iconPath);
  updateTrayMenu();

  tray.setToolTip('n8n Agent Platform');

  // Show window on double click
  tray.on('double-click', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
}

// Update tray menu with service status
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Dashboard',
      click: () => {
        if (mainWindow === null) {
          createWindow();
        } else {
          mainWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Services',
      submenu: [
        {
          label: `PostgreSQL: ${serviceStatus.postgres}`,
          enabled: false
        },
        {
          label: `Redis: ${serviceStatus.redis}`,
          enabled: false
        },
        {
          label: `API Server: ${serviceStatus.apiServer}`,
          enabled: false
        },
        {
          label: `Web Dashboard: ${serviceStatus.webDashboard}`,
          enabled: false
        }
      ]
    },
    { type: 'separator' },
    {
      label: 'Start All Services',
      click: () => startAllServices(),
      enabled: !isAnyServiceRunning()
    },
    {
      label: 'Stop All Services',
      click: () => stopAllServices(),
      enabled: isAnyServiceRunning()
    },
    {
      label: 'Restart Services',
      click: async () => {
        await stopAllServices();
        await startAllServices();
      }
    },
    { type: 'separator' },
    {
      label: 'Open Logs',
      click: () => openLogsFolder()
    },
    {
      label: 'Open Config',
      click: () => openConfigFolder()
    },
    { type: 'separator' },
    {
      label: 'About',
      click: () => showAbout()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        stopAllServices().then(() => {
          app.quit();
        });
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// Check if any service is running
function isAnyServiceRunning() {
  return Object.values(serviceStatus).some(status => 
    status === 'running' || status === 'starting'
  );
}

// Docker-based service management
async function startServicesWithDocker() {
  console.log('Starting services with Docker...');
  
  try {
    // Create docker-compose.yml if it doesn't exist
    const dockerComposePath = path.join(__dirname, 'docker-compose.yml');
    if (!fs.existsSync(dockerComposePath)) {
      await createDockerCompose();
    }

    // Start Docker services
    const dockerUp = spawn('docker-compose', ['up', '-d'], {
      cwd: __dirname,
      shell: true
    });

    dockerUp.stdout.on('data', (data) => {
      console.log(`Docker: ${data}`);
    });

    dockerUp.stderr.on('data', (data) => {
      console.error(`Docker Error: ${data}`);
    });

    dockerUp.on('close', (code) => {
      if (code === 0) {
        serviceStatus.postgres = 'running';
        serviceStatus.redis = 'running';
        updateTrayMenu();
        showNotification('Services Started', 'PostgreSQL and Redis are running');
      }
    });

    // Start API server and web dashboard
    await startAPIServer();
    await startWebDashboard();
    
  } catch (error) {
    console.error('Failed to start Docker services:', error);
    dialog.showErrorBox('Docker Error', 'Failed to start services with Docker. Please check Docker installation.');
  }
}

// Create docker-compose.yml
async function createDockerCompose() {
  const dockerComposeContent = `version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: n8n_agent
      POSTGRES_PASSWORD: n8n_agent_password
      POSTGRES_DB: n8n_agent_platform
    ports:
      - "\${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n_agent"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "\${REDIS_PORT:-6379}:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
`;

  fs.writeFileSync(path.join(__dirname, 'docker-compose.yml'), dockerComposeContent);
}

// Native service management (fallback)
async function startPostgreSQL() {
  return new Promise((resolve) => {
    console.log('Starting PostgreSQL...');
    serviceStatus.postgres = 'starting';
    updateTrayMenu();

    // Check if port is already in use
    checkPort(config.postgresPort).then((inUse) => {
      if (inUse) {
        console.log('PostgreSQL port already in use, assuming it\'s running');
        serviceStatus.postgres = 'running';
        updateTrayMenu();
        resolve(true);
        return;
      }

      // Try to start PostgreSQL
      exec('pg_ctl status', (error, stdout) => {
        if (error) {
          serviceStatus.postgres = 'error';
          updateTrayMenu();
          dialog.showMessageBox({
            type: 'warning',
            title: 'PostgreSQL Not Found',
            message: 'PostgreSQL is not installed or not in PATH. Please install PostgreSQL or use Docker.',
            buttons: ['OK']
          });
          resolve(false);
        } else if (stdout.includes('server is running')) {
          serviceStatus.postgres = 'running';
          updateTrayMenu();
          resolve(true);
        } else {
          // Try to start PostgreSQL
          exec('pg_ctl start', (error) => {
            if (error) {
              serviceStatus.postgres = 'error';
              updateTrayMenu();
              resolve(false);
            } else {
              serviceStatus.postgres = 'running';
              updateTrayMenu();
              resolve(true);
            }
          });
        }
      });
    });
  });
}

// Start Redis
async function startRedis() {
  return new Promise((resolve) => {
    console.log('Starting Redis...');
    serviceStatus.redis = 'starting';
    updateTrayMenu();

    // Check if port is already in use
    checkPort(config.redisPort).then((inUse) => {
      if (inUse) {
        console.log('Redis port already in use, assuming it\'s running');
        serviceStatus.redis = 'running';
        updateTrayMenu();
        resolve(true);
        return;
      }

      // Start Redis server
      services.redis = spawn('redis-server', [], {
        detached: process.platform !== 'win32',
        stdio: 'ignore'
      });

      if (process.platform !== 'win32') {
        services.redis.unref();
      }

      // Give Redis time to start
      setTimeout(() => {
        checkPort(config.redisPort).then((inUse) => {
          if (inUse) {
            serviceStatus.redis = 'running';
            console.log('Redis started successfully');
          } else {
            serviceStatus.redis = 'error';
            console.error('Redis failed to start');
          }
          updateTrayMenu();
          resolve(inUse);
        });
      }, 2000);
    }).catch(() => {
      serviceStatus.redis = 'error';
      updateTrayMenu();
      dialog.showMessageBox({
        type: 'warning',
        title: 'Redis Not Found',
        message: 'Redis is not installed or not in PATH. Please install Redis or use Docker.',
        buttons: ['OK']
      });
      resolve(false);
    });
  });
}

// Start API Server
async function startAPIServer() {
  return new Promise((resolve) => {
    console.log('Starting API Server...');
    serviceStatus.apiServer = 'starting';
    updateTrayMenu();

    const apiPath = path.join(__dirname, 'core');
    
    // Check if built files exist
    const distPath = path.join(apiPath, 'dist');
    if (!fs.existsSync(distPath)) {
      console.log('Building API server...');
      exec('npm run build', { cwd: apiPath }, (error) => {
        if (error) {
          console.error('Failed to build API server:', error);
          serviceStatus.apiServer = 'error';
          updateTrayMenu();
          resolve(false);
          return;
        }
        startAPIServerProcess();
      });
    } else {
      startAPIServerProcess();
    }

    function startAPIServerProcess() {
      services.apiServer = spawn('npm', ['run', 'start'], {
        cwd: apiPath,
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: isDev ? 'development' : 'production',
          PORT: config.apiPort,
          DATABASE_URL: `postgresql://n8n_agent:n8n_agent_password@localhost:${config.postgresPort}/n8n_agent_platform`,
          REDIS_URL: `redis://localhost:${config.redisPort}`
        }
      });

      let started = false;

      services.apiServer.stdout.on('data', (data) => {
        console.log(`API Server: ${data}`);
        if (!started && (data.toString().includes('Server running') || 
            data.toString().includes('listening') || 
            data.toString().includes('started'))) {
          started = true;
          serviceStatus.apiServer = 'running';
          updateTrayMenu();
          showNotification('API Server', 'API Server is running');
          resolve(true);
        }
      });

      services.apiServer.stderr.on('data', (data) => {
        console.error(`API Server Error: ${data}`);
      });

      services.apiServer.on('error', (err) => {
        console.error('Failed to start API Server:', err);
        serviceStatus.apiServer = 'error';
        updateTrayMenu();
        if (!started) resolve(false);
      });

      services.apiServer.on('close', (code) => {
        serviceStatus.apiServer = 'stopped';
        updateTrayMenu();
      });

      // Timeout fallback
      setTimeout(() => {
        if (!started) {
          checkPort(config.apiPort).then((inUse) => {
            if (inUse) {
              serviceStatus.apiServer = 'running';
              updateTrayMenu();
              resolve(true);
            } else {
              serviceStatus.apiServer = 'error';
              updateTrayMenu();
              resolve(false);
            }
          });
        }
      }, 15000);
    }
  });
}

// Start Web Dashboard
async function startWebDashboard() {
  return new Promise((resolve) => {
    console.log('Starting Web Dashboard...');
    serviceStatus.webDashboard = 'starting';
    updateTrayMenu();

    const dashboardPath = path.join(__dirname, 'web-dashboard');
    
    services.webDashboard = spawn('npm', ['run', isDev ? 'dev' : 'preview'], {
      cwd: dashboardPath,
      shell: true,
      env: {
        ...process.env,
        PORT: config.dashboardPort,
        VITE_API_URL: `http://localhost:${config.apiPort}`
      }
    });

    let started = false;

    services.webDashboard.stdout.on('data', (data) => {
      console.log(`Web Dashboard: ${data}`);
      if (!started && (data.toString().includes('ready') || 
          data.toString().includes('Local:') ||
          data.toString().includes('running'))) {
        started = true;
        serviceStatus.webDashboard = 'running';
        updateTrayMenu();
        showNotification('Web Dashboard', 'Dashboard is ready');
        resolve(true);
      }
    });

    services.webDashboard.stderr.on('data', (data) => {
      console.error(`Web Dashboard Error: ${data}`);
    });

    services.webDashboard.on('error', (err) => {
      console.error('Failed to start Web Dashboard:', err);
      serviceStatus.webDashboard = 'error';
      updateTrayMenu();
      if (!started) resolve(false);
    });

    services.webDashboard.on('close', (code) => {
      serviceStatus.webDashboard = 'stopped';
      updateTrayMenu();
    });

    // Timeout fallback
    setTimeout(() => {
      if (!started) {
        checkPort(config.dashboardPort).then((inUse) => {
          if (inUse) {
            serviceStatus.webDashboard = 'running';
            updateTrayMenu();
            resolve(true);
          } else {
            serviceStatus.webDashboard = 'error';
            updateTrayMenu();
            resolve(false);
          }
        });
      }
    }, 20000);
  });
}

// Start all services
async function startAllServices() {
  console.log('Starting all services...');
  showNotification('Starting Services', 'Please wait while services start...');
  
  // Check if Docker is available
  config.useDocker = await checkDocker();
  
  if (config.useDocker) {
    await startServicesWithDocker();
  } else {
    // Start services in order
    await startPostgreSQL();
    await startRedis();
    await startAPIServer();
    await startWebDashboard();
  }

  // Wait for dashboard to be ready then open browser
  setTimeout(() => {
    if (serviceStatus.webDashboard === 'running') {
      if (!mainWindow) {
        createWindow();
      }
    }
  }, 3000);
}

// Stop all services
async function stopAllServices() {
  console.log('Stopping all services...');
  showNotification('Stopping Services', 'Shutting down all services...');

  // Stop Web Dashboard
  if (services.webDashboard) {
    services.webDashboard.kill();
    services.webDashboard = null;
    serviceStatus.webDashboard = 'stopped';
  }

  // Stop API Server
  if (services.apiServer) {
    services.apiServer.kill();
    services.apiServer = null;
    serviceStatus.apiServer = 'stopped';
  }

  if (config.useDocker) {
    // Stop Docker services
    try {
      await execAsync('docker-compose down', { cwd: __dirname });
      serviceStatus.postgres = 'stopped';
      serviceStatus.redis = 'stopped';
    } catch (error) {
      console.error('Failed to stop Docker services:', error);
    }
  } else {
    // Stop Redis
    if (services.redis || serviceStatus.redis === 'running') {
      if (process.platform === 'win32') {
        exec('taskkill /F /IM redis-server.exe', () => {});
      } else {
        exec('redis-cli shutdown', () => {});
      }
      services.redis = null;
      serviceStatus.redis = 'stopped';
    }

    // Stop PostgreSQL
    if (serviceStatus.postgres === 'running') {
      exec('pg_ctl stop -m fast', () => {});
      serviceStatus.postgres = 'stopped';
    }
  }

  updateTrayMenu();
}

// Open logs folder
function openLogsFolder() {
  const logsPath = path.join(__dirname, 'core', 'logs');
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
  }
  shell.openPath(logsPath);
}

// Open config folder
function openConfigFolder() {
  shell.openPath(__dirname);
}

// Show about dialog
function showAbout() {
  dialog.showMessageBox({
    type: 'info',
    title: 'About n8n Agent Platform',
    message: 'n8n Agent Platform',
    detail: `Version: 1.0.0
    
Autonomous AI Agent Platform for n8n Workflow Optimization

Services Status:
- PostgreSQL: ${serviceStatus.postgres}
- Redis: ${serviceStatus.redis}
- API Server: ${serviceStatus.apiServer}
- Web Dashboard: ${serviceStatus.webDashboard}

Using Docker: ${config.useDocker ? 'Yes' : 'No'}

Powered by Electron ${process.versions.electron}
Node.js ${process.versions.node}`,
    buttons: ['OK'],
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
}

// Create loading page
function createLoadingPage() {
  const loadingHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>n8n Agent Platform - Loading</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
    }
    h1 {
      font-size: 3em;
      margin-bottom: 0.5em;
    }
    .loader {
      border: 5px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top: 5px solid white;
      width: 60px;
      height: 60px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .status {
      margin-top: 20px;
      font-size: 1.2em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>n8n Agent Platform</h1>
    <div class="loader"></div>
    <div class="status">Starting services...</div>
  </div>
</body>
</html>`;

  fs.writeFileSync(path.join(__dirname, 'loading.html'), loadingHtml);
}

// App event handlers
app.whenReady().then(async () => {
  createLoadingPage();
  createTray();
  
  // Auto-start services
  await startAllServices();
  
  // Set up auto-updater if not in dev
  if (!isDev) {
    // Add auto-updater logic here
  }
});

app.on('window-all-closed', () => {
  // Don't quit when window is closed (keep running in tray)
  if (process.platform !== 'darwin') {
    // Keep the app running
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  app.isQuitting = true;
  await stopAllServices();
});

// IPC handlers for renderer process
ipcMain.handle('get-service-status', () => {
  return serviceStatus;
});

ipcMain.handle('start-services', async () => {
  await startAllServices();
  return serviceStatus;
});

ipcMain.handle('stop-services', async () => {
  await stopAllServices();
  return serviceStatus;
});

ipcMain.handle('restart-service', async (event, serviceName) => {
  // Implement individual service restart
  console.log(`Restarting ${serviceName}...`);
  return serviceStatus;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Unexpected Error', error.message);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

// Export for testing
module.exports = { checkPort, checkDocker };