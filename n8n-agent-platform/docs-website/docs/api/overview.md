---
sidebar_position: 1
---

# API Overview

La API REST de n8n Agent Platform proporciona acceso completo a todas las funcionalidades de la plataforma.

## 🚀 Base URL

```
https://api.n8n-agent-platform.com/v1
```

Para desarrollo local:
```
http://localhost:3456/api
```

## 🔐 Autenticación

La API usa JWT (JSON Web Tokens) para autenticación. Incluye el token en el header de cada request:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Obtener Token

```bash
curl -X POST https://api.n8n-agent-platform.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

Respuesta:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "user": {
    "id": "usr_123",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

### Refresh Token

```bash
curl -X POST https://api.n8n-agent-platform.com/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

## 📋 Recursos Principales

### Agents
- `GET /agents` - Listar agentes
- `GET /agents/:id` - Obtener agente
- `POST /agents/:id/run` - Ejecutar agente
- `POST /agents/:id/schedule` - Programar agente
- `PUT /agents/:id/config` - Actualizar configuración

### Workflows
- `GET /workflows` - Listar workflows
- `POST /workflows` - Crear workflow
- `GET /workflows/:id` - Obtener workflow
- `PUT /workflows/:id` - Actualizar workflow
- `DELETE /workflows/:id` - Eliminar workflow
- `GET /workflows/:id/versions` - Historial de versiones

### Marketplace
- `GET /marketplace/templates` - Explorar templates
- `GET /marketplace/templates/:id` - Detalle de template
- `POST /marketplace/publish` - Publicar template
- `POST /marketplace/install/:id` - Instalar template
- `GET /marketplace/purchases` - Mis compras

### Versioning
- `POST /versions/create` - Crear versión
- `GET /versions/:id` - Obtener versión
- `GET /versions/:id/diff` - Ver diferencias
- `POST /versions/:id/rollback` - Rollback
- `POST /versions/:id/deploy` - Deploy

## 🔄 Rate Limiting

La API tiene límites de rate para proteger el servicio:

| Plan | Requests/Minuto | Requests/Hora |
|------|-----------------|---------------|
| Free | 60 | 1000 |
| Pro | 300 | 10000 |
| Enterprise | Ilimitado | Ilimitado |

Headers de respuesta:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1640995200
```

## 📝 Formato de Respuesta

### Éxito
```json
{
  "success": true,
  "data": {
    // Datos del recurso
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0"
  }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

## 🔍 Paginación

Para endpoints que retornan listas:

```http
GET /api/workflows?page=2&limit=20&sort=createdAt:desc
```

Respuesta incluye metadata de paginación:
```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": true
  }
}
```

## 🔄 WebSocket Events

Conéctate para recibir eventos en tiempo real:

```javascript
const socket = io('wss://api.n8n-agent-platform.com', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

socket.on('agent:status:update', (data) => {
  console.log('Agent status changed:', data);
});

socket.on('workflow:optimization:complete', (data) => {
  console.log('Optimization complete:', data);
});
```

### Eventos Disponibles

| Evento | Descripción |
|--------|-------------|
| `agent:status:update` | Cambio de estado de agente |
| `workflow:optimization:complete` | Optimización completada |
| `workflow:error` | Error en workflow |
| `marketplace:new:template` | Nuevo template publicado |
| `version:deployed` | Nueva versión desplegada |

## 🛡️ Seguridad

### CORS
```javascript
// Dominios permitidos
const allowedOrigins = [
  'https://app.n8n-agent-platform.com',
  'https://localhost:3000'
];
```

### Headers Requeridos
```http
Content-Type: application/json
X-API-Version: 1.0
X-Request-ID: uuid-v4
```

### Encriptación
- Todas las comunicaciones usan HTTPS
- Datos sensibles encriptados con AES-256-GCM
- Tokens firmados con RS256

## 📊 Códigos de Estado

| Código | Significado |
|--------|-------------|
| 200 | OK - Solicitud exitosa |
| 201 | Created - Recurso creado |
| 204 | No Content - Eliminación exitosa |
| 400 | Bad Request - Error en la solicitud |
| 401 | Unauthorized - Token inválido o expirado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 429 | Too Many Requests - Rate limit excedido |
| 500 | Internal Server Error - Error del servidor |

## 🧪 Testing

### Ambiente Sandbox
```
https://sandbox.api.n8n-agent-platform.com/v1
```

### Credenciales de Prueba
```json
{
  "email": "test@example.com",
  "password": "test123",
  "apiKey": "test_pk_1234567890"
}
```

## 📚 SDKs Oficiales

### JavaScript/TypeScript
```bash
npm install @n8n-agent-platform/sdk
```

```typescript
import { AgentPlatformClient } from '@n8n-agent-platform/sdk';

const client = new AgentPlatformClient({
  apiKey: 'YOUR_API_KEY',
  environment: 'production' // o 'sandbox'
});

const agents = await client.agents.list();
```

### Python
```bash
pip install n8n-agent-platform
```

```python
from n8n_agent_platform import Client

client = Client(api_key='YOUR_API_KEY')
agents = client.agents.list()
```

## 🔄 Changelog

### v1.0.0 (2024-01-15)
- Initial API release
- Core endpoints for agents, workflows, marketplace
- WebSocket support
- JWT authentication

### Próximas Características
- GraphQL API
- Batch operations
- Webhook subscriptions
- Advanced filtering

<div className="agent-message">
💡 <strong>Tip:</strong> Usa nuestro Postman Collection para explorar la API rápidamente: 
<a href="https://postman.com/n8n-agent-platform">Download Collection</a>
</div>