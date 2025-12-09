module.exports = {
  apps: [
    {
      name: 'n8n-agent-platform',
      cwd: '/home/sergio/n8n_code_generator_github/n8n-agent-platform/core',
      script: 'npm',
      args: 'start',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      error_file: '/home/sergio/n8n_code_generator_github/logs/agent-platform-error.log',
      out_file: '/home/sergio/n8n_code_generator_github/logs/agent-platform-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'n8n-dashboard',
      cwd: '/home/sergio/n8n_code_generator_github/n8n-agent-platform/web-dashboard',
      script: 'npm',
      args: 'run dev',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 5173
      },
      error_file: '/home/sergio/n8n_code_generator_github/logs/dashboard-error.log',
      out_file: '/home/sergio/n8n_code_generator_github/logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'n8n-extension-server',
      cwd: '/home/sergio/n8n_code_generator_github/n8n-copilot-extension',
      script: 'out/server/localServer.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3456
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3456
      },
      error_file: '/home/sergio/n8n_code_generator_github/logs/extension-server-error.log',
      out_file: '/home/sergio/n8n_code_generator_github/logs/extension-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ],

  deploy: {
    production: {
      user: 'sergio',
      host: 'localhost',
      ref: 'origin/master',
      repo: 'https://github.com/yourusername/n8n-code-generator.git',
      path: '/home/sergio/n8n_code_generator_github',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};