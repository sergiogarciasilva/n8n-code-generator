# n8n Agent Platform Launcher

A desktop application launcher for the n8n Agent Platform that manages all backend services and provides a system tray interface.

## Features

- **One-Click Launch**: Starts all required services automatically
  - PostgreSQL database
  - Redis cache
  - API server
  - Web dashboard
- **System Tray Integration**: Runs in the background with easy access
- **Service Management**: Start, stop, and monitor all services
- **Automatic Browser Launch**: Opens the dashboard when ready
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Docker Support**: Automatically uses Docker if available

## Prerequisites

### Option 1: Docker (Recommended)
- Docker Desktop installed and running
- Docker Compose

### Option 2: Native Services
- PostgreSQL 12+
- Redis 6+
- Node.js 16+
- npm 8+

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

## Usage

### Development Mode
Run the launcher in development mode:
```bash
npm run launcher:dev
```

### Production Mode
Run the launcher:
```bash
npm run launcher
```

### Building Executables

Build for all platforms:
```bash
npm run launcher:build
npm run launcher:dist
```

Build for specific platforms:
```bash
# Windows
npm run launcher:dist:win

# macOS
npm run launcher:dist:mac

# Linux
npm run launcher:dist:linux
```

The built executables will be in the `dist-electron` directory.

## System Tray Menu

The launcher provides a system tray icon with the following options:

- **Show Dashboard**: Opens the web dashboard
- **Services**: Shows the status of all services
- **Start All Services**: Starts all backend services
- **Stop All Services**: Stops all backend services
- **Restart Services**: Restarts all services
- **Open Logs**: Opens the logs directory
- **Open Config**: Opens the configuration directory
- **About**: Shows version and service information
- **Quit**: Stops all services and exits the application

## Configuration

Environment variables can be set to customize the launcher:

- `API_PORT`: API server port (default: 3000)
- `DASHBOARD_PORT`: Web dashboard port (default: 5173)
- `POSTGRES_PORT`: PostgreSQL port (default: 5432)
- `REDIS_PORT`: Redis port (default: 6379)

## Service Status

The launcher shows the status of each service:
- `stopped`: Service is not running
- `starting`: Service is starting up
- `running`: Service is active
- `error`: Service failed to start

## Troubleshooting

### Services fail to start
1. Check if ports are already in use
2. Ensure PostgreSQL and Redis are installed (if not using Docker)
3. Check the logs in `core/logs` directory

### Dashboard doesn't load
1. Wait for all services to start (check system tray)
2. Ensure no other application is using port 5173
3. Check browser console for errors

### Docker issues
1. Ensure Docker Desktop is running
2. Check Docker compose is installed
3. Run `docker-compose ps` to check container status

## Development

The launcher is built with:
- Electron for the desktop application
- Node.js child processes for service management
- System tray integration for background operation

Key files:
- `launcher.js`: Main Electron application
- `preload.js`: Secure bridge between main and renderer
- `package.json`: Configuration and scripts

## Security

- Context isolation enabled
- No direct Node.js access in renderer
- Secure IPC communication
- Environment-based configuration

## License

Part of the n8n Agent Platform project.