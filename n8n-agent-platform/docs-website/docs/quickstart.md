---
sidebar_position: 2
---

# Guía de Inicio Rápido

Configura tu n8n Agent Platform en menos de 5 minutos ⚡

## 📋 Pre-requisitos

Antes de comenzar, asegúrate de tener:

- Node.js 18+ instalado
- Docker Desktop (para PostgreSQL y Redis)
- Una cuenta en n8n Cloud v1.98
- API keys de OpenAI y/o Anthropic

## 🚀 Instalación Express

### 1. Clonar y configurar

```bash
# Clonar el repositorio
git clone https://github.com/n8n-agent-platform/n8n-agent-platform.git
cd n8n-agent-platform

# Instalar dependencias
npm install

# Copiar configuración
cp core/.env.example core/.env
```

### 2. Configurar variables de entorno

Edita `core/.env`:

```env
# n8n Integration (REQUERIDO)
N8N_API_URL=https://app.n8n.cloud/api/v1/
N8N_API_KEY=tu_api_key_de_n8n

# AI Providers (al menos uno es REQUERIDO)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Database (valores por defecto funcionan con Docker)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=n8n_agent_platform
DB_USER=postgres
DB_PASSWORD=postgres
```

### 3. Iniciar servicios con Docker

```bash
# Iniciar PostgreSQL y Redis
docker-compose up -d

# Verificar que estén corriendo
docker-compose ps
```

### 4. Configurar la base de datos

```bash
# Ejecutar migraciones
cd core
npm run db:migrate
```

### 5. ¡Lanzar la plataforma! 🎉

```bash
# Modo desarrollo
npm run dev

# O modo producción
npm run build
npm start
```

La plataforma estará disponible en:
- **API**: http://localhost:3456
- **Dashboard**: http://localhost:3000 (requiere iniciar por separado)

## 🎯 Primer Workflow

### 1. Registrar un workflow

```bash
curl -X POST http://localhost:3456/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mi primer workflow",
    "n8nId": "workflow_id_de_n8n",
    "type": "telegram-bot"
  }'
```

### 2. Ver agentes disponibles

```bash
curl http://localhost:3456/api/agents
```

### 3. Ejecutar análisis manual

```bash
curl -X POST http://localhost:3456/api/agents/telegram-agent/run
```

<div className="agent-message">
¡Felicidades! 🎊 Tu primer workflow está siendo analizado. En unos minutos verás las primeras sugerencias de optimización.
</div>

## 📱 Configurar App Móvil (Opcional)

```bash
# Ir al directorio de la app
cd mobile-app

# Instalar dependencias
npm install

# Configurar API URL
echo "API_URL=http://tu-ip-local:3456" > .env

# Iniciar con Expo
npx expo start
```

Escanea el código QR con Expo Go en tu teléfono.

## 🎨 Iniciar Dashboard Web

```bash
# En otra terminal
cd web-dashboard
npm install
npm run dev
```

Abre http://localhost:3000 para ver el dashboard con diseño glassmorphism.

## ⚡ Comandos Útiles

### Monitoreo en tiempo real
```bash
# Ver logs de agentes
tail -f core/logs/combined.log

# Ver solo errores
tail -f core/logs/error.log | grep ERROR

# Estadísticas de PostgreSQL
docker exec -it n8n-postgres psql -U postgres -d n8n_agent_platform -c "SELECT * FROM agents;"
```

### Control de agentes
```bash
# Detener todos los agentes
curl -X POST http://localhost:3456/api/agents/stop-all

# Programar agente con cron
curl -X POST http://localhost:3456/api/agents/mcp-agent/schedule \
  -H "Content-Type: application/json" \
  -d '{"cron": "0 */2 * * *"}'  # Cada 2 horas
```

## 🔧 Configuración Avanzada

### Habilitar 2FA
```env
# En core/.env
MFA_ENABLED=true
MFA_ISSUER=n8n-agent-platform
```

### Configurar Marketplace
```env
# En core/.env
MARKETPLACE_ENABLED=true
STRIPE_SECRET_KEY=sk_test_...
REVENUE_SHARE_PERCENTAGE=70
```

### Límites de recursos
```env
# En core/.env
MAX_CONCURRENT_AGENTS=5
MAX_WORKFLOW_SIZE_MB=10
AGENT_TIMEOUT_MINUTES=30
```

## 🚨 Troubleshooting Común

### Error: "Cannot connect to PostgreSQL"
```bash
# Verificar que Docker esté corriendo
docker-compose ps

# Reiniciar servicios
docker-compose restart postgres
```

### Error: "Invalid API key"
- Verifica tu API key de n8n en https://app.n8n.cloud/settings/api
- Asegúrate de que no haya espacios extras en `.env`

### Los agentes no encuentran workflows
- Confirma que el workflow esté activo en n8n Cloud
- Verifica que el `n8nId` sea correcto al registrar

## 🎉 ¡Listo!

Tu plataforma está configurada y funcionando. Los agentes comenzarán a:

1. ✅ Analizar workflows cada hora
2. ✅ Generar sugerencias de optimización
3. ✅ Aplicar mejoras automáticamente (si está habilitado)
4. ✅ Enviar notificaciones de eventos importantes

## 📚 Próximos Pasos

- [Configurar agentes personalizados](./agents/custom-agents)
- [Publicar en el Marketplace](./guides/marketplace-publishing)
- [Configurar ambientes de testing](./features/testing-environments)
- [Desplegar en producción](./guides/deployment)

<div className="gradient-text" style={{fontSize: '1.5rem', textAlign: 'center', marginTop: '2rem'}}>
  ¿Necesitas ayuda? Únete a nuestro Discord: discord.gg/n8n-agents
</div>