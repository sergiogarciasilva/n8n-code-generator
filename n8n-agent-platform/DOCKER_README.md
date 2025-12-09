# n8n Agent Platform - Docker Setup Guide

## 🐳 Overview

This guide explains how to set up and run the n8n Agent Platform using Docker. The platform is completely isolated from other projects with its own dedicated network, volumes, and port mappings.

## 🏗️ Architecture

The Docker setup includes:

- **PostgreSQL 15**: Main database (port 5433)
- **Redis 7**: Caching and queue management (port 6380)
- **n8n Instance**: Optional n8n server (port 5679)
- **pgAdmin**: Database management UI (port 5051)

All services run on a dedicated network (`172.30.0.0/16`) to avoid conflicts.

## 🚀 Quick Start

### 1. Using Docker Manager Script

```bash
# Start all services
./docker-manager.sh start

# Check service status
./docker-manager.sh status

# View logs
./docker-manager.sh logs

# Stop all services
./docker-manager.sh stop
```

### 2. Using Docker Compose Directly

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Reset everything (including data)
docker-compose down -v
```

## 📊 Service Details

### PostgreSQL Database
- **Container**: `n8n_agent_platform_postgres`
- **Port**: `5433` (host) → `5432` (container)
- **Database**: `n8n_agent_platform_db`
- **Username**: `n8n_agent_user`
- **Password**: `n8n_agent_secure_password_2024`

### Redis Cache
- **Container**: `n8n_agent_platform_redis`
- **Port**: `6380` (host) → `6379` (container)
- **Password**: `n8n_agent_redis_password_2024`
- **Max Memory**: 256MB with LRU eviction

### n8n Instance
- **Container**: `n8n_agent_platform_n8n`
- **Port**: `5679` (host) → `5678` (container)
- **Username**: `n8n_agent_admin`
- **Password**: `n8n_agent_admin_password_2024`

### pgAdmin
- **Container**: `n8n_agent_platform_pgadmin`
- **Port**: `5051` (host) → `80` (container)
- **Email**: `admin@n8nagentplatform.local`
- **Password**: `pgadmin_password_2024`

## 🛠️ Management Commands

### Database Operations

```bash
# Backup database
./docker-manager.sh backup

# Restore database
./docker-manager.sh restore backup_file.sql

# Access PostgreSQL shell
./docker-manager.sh shell postgres

# Access Redis CLI
./docker-manager.sh shell redis
```

### Health Checks

```bash
# Check all services health
./docker-manager.sh health

# Check specific service
docker exec n8n_agent_platform_postgres pg_isready
docker exec n8n_agent_platform_redis redis-cli ping
```

### Debugging

```bash
# View all logs
./docker-manager.sh logs

# View specific service logs
./docker-manager.sh logs postgres
./docker-manager.sh logs redis
./docker-manager.sh logs n8n

# Access container shell
docker exec -it n8n_agent_platform_postgres /bin/bash
```

## 🔧 Configuration

### Environment Variables

The platform uses `.env.docker` for Docker-specific configuration:

```bash
# Copy Docker environment template
cp .env.docker .env

# Edit configuration
nano .env
```

### Network Isolation

All services run on a dedicated network to avoid conflicts:
- **Network Name**: `n8n_agent_platform_network`
- **Subnet**: `172.30.0.0/16`

### Volume Persistence

Data is stored in named volumes:
- `n8n_agent_platform_postgres_data`
- `n8n_agent_platform_redis_data`
- `n8n_agent_platform_n8n_data`
- `n8n_agent_platform_pgadmin_data`

## 🔒 Security Notes

1. **Change default passwords** in production
2. **Use environment variables** for sensitive data
3. **Enable SSL/TLS** for external connections
4. **Restrict port exposure** in production
5. **Regular backups** are recommended

## 🐛 Troubleshooting

### Port Conflicts

If you get port binding errors:

```bash
# Check what's using the ports
sudo lsof -i :5433  # PostgreSQL
sudo lsof -i :6380  # Redis
sudo lsof -i :5679  # n8n
sudo lsof -i :5051  # pgAdmin

# Change ports in docker-compose.yml if needed
```

### Database Connection Issues

```bash
# Test PostgreSQL connection
docker exec n8n_agent_platform_postgres pg_isready -U n8n_agent_user

# Check PostgreSQL logs
docker logs n8n_agent_platform_postgres

# Verify network connectivity
docker network inspect n8n_agent_platform_network
```

### Redis Connection Issues

```bash
# Test Redis connection
docker exec n8n_agent_platform_redis redis-cli -a n8n_agent_redis_password_2024 ping

# Check Redis logs
docker logs n8n_agent_platform_redis
```

### Reset Everything

```bash
# Stop and remove all containers and volumes
./docker-manager.sh reset

# Or manually
docker-compose down -v
docker volume prune
```

## 📦 Production Deployment

For production deployment:

1. **Update passwords** in `.env` file
2. **Use Docker Swarm** or **Kubernetes** for orchestration
3. **Set up SSL certificates** for secure connections
4. **Configure backup strategies**
5. **Monitor with Prometheus/Grafana**
6. **Use external PostgreSQL/Redis** for better performance

## 🔗 Useful Commands

```bash
# Show all containers
docker ps -a | grep n8n_agent

# Show all volumes
docker volume ls | grep n8n_agent

# Show network details
docker network inspect n8n_agent_platform_network

# Clean up unused resources
docker system prune -a

# Monitor resource usage
docker stats $(docker ps -q --filter "name=n8n_agent")
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- [n8n Docker Documentation](https://docs.n8n.io/hosting/installation/docker/)