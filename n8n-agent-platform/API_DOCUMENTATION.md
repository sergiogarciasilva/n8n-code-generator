# 📚 API Documentation - n8n Agent Platform

## 🚀 Base URL
```
http://localhost:3456/api/v1
```

## 🔐 Authentication
Todos los endpoints (excepto públicos) requieren autenticación Bearer token:
```bash
Authorization: Bearer <your_jwt_token>
```

---

## 🤖 Workflow Generator API

### Generate Workflow
Genera un workflow completo desde una descripción en lenguaje natural.

**Endpoint:** `POST /generator/generate`

**Request Body:**
```json
{
  "description": "Create a workflow that processes customer emails and sends notifications",
  "category": "automation",
  "difficulty": "intermediate",
  "useCase": "email-processing",
  "specificRequirements": ["error handling", "logging"],
  "integrations": ["email", "slack"]
}
```

**Response:**
```json
{
  "success": true,
  "workflow": {
    "id": "workflow_1234567890",
    "name": "Generated: Customer Email Processing",
    "nodes": [
      {
        "id": "start",
        "type": "webhook",
        "name": "Webhook",
        "position": [250, 300],
        "parameters": {
          "httpMethod": "POST",
          "path": "webhook"
        }
      }
    ],
    "connections": {
      "start": {
        "main": [[{"node": "process", "type": "main", "index": 0}]]
      }
    }
  },
  "metadata": {
    "category": "automation",
    "difficulty": "intermediate", 
    "estimatedExecutionTime": "30-60 seconds",
    "generatedAt": "2025-06-28T10:43:20.152Z"
  },
  "usage_instructions": [
    "1. Import this workflow into your n8n instance",
    "2. Configure the webhook URL if needed",
    "3. Update the HTTP request endpoint to your desired destination"
  ],
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": [],
    "suggestions": ["Consider adding error handling nodes"]
  }
}
```

### Other Generator Endpoints
```http
POST /generator/optimize     # Optimizar workflow existente
POST /generator/validate     # Validar workflow  
GET  /generator/templates    # Buscar templates
GET  /generator/stats        # Estadísticas del generador
```

---

## 📊 Dashboard API

### Get Dashboard Data
Obtiene métricas reales del dashboard desde la base de datos.

**Endpoint:** `GET /dashboard/data`

**Response:**
```json
{
  "agents": {
    "total": 12,
    "active": 8,
    "inactive": 4
  },
  "workflows": {
    "total": 45,
    "active": 32,
    "lastOptimized": "2025-06-28T09:30:00Z"
  },
  "executions": {
    "today": 1250,
    "errors": 23,
    "successRate": 98.16
  },
  "activeAgents": [
    {
      "id": "agent_001",
      "name": "MCP Optimizer",
      "status": "active",
      "uptime": 14400,
      "health": "good"
    }
  ],
  "recentOptimizations": [
    {
      "workflowName": "Customer Processing",
      "improvement": "23% faster execution",
      "timestamp": "2025-06-28T08:45:00Z"
    }
  ]
}
```

### Agent Management
```http
GET  /dashboard/agents           # Lista de agentes
POST /dashboard/agents/:id/toggle # Activar/desactivar agente
GET  /dashboard/agents/:id/settings # Configuración de agente
```

---

## 🔔 Notifications API

### List Notifications
**Endpoint:** `GET /notifications`

**Query Parameters:**
- `filter`: 'all' | 'unread' | 'critical'
- `limit`: número de notificaciones (default: 20)

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif_001",
      "type": "optimization",
      "title": "New Optimization Available",
      "message": "5 new optimization suggestions for Data Processing Pipeline",
      "priority": "medium",
      "read": false,
      "created_at": "2025-06-28T10:30:00Z",
      "actions": [
        {"label": "Review", "action": "review"}
      ],
      "metadata": {}
    }
  ],
  "unreadCount": 3,
  "totalCount": 25
}
```

### Notification Actions
```http
PUT    /notifications/:id/read      # Marcar como leída
DELETE /notifications/:id           # Eliminar notificación  
POST   /notifications/:id/snooze    # Posponer notificación
POST   /notifications/:id/action    # Ejecutar acción
```

---

## 💬 Chat API

### Send Message
Enviar mensaje al asistente AI.

**Endpoint:** `POST /chat/message`

**Request Body:**
```json
{
  "message": "How can I optimize my workflow performance?",
  "conversationId": "conv_123", // opcional
  "context": {
    "workflowId": "workflow_001",
    "agentId": "agent_001"
  }
}
```

**Response:**
```json
{
  "response": "To optimize workflow performance, I recommend: 1. Adding caching nodes...",
  "conversationId": "conv_123",
  "suggestions": [
    "Show me workflow performance metrics",
    "Apply AI optimizations",
    "View optimization history"
  ],
  "timestamp": "2025-06-28T10:45:00Z"
}
```

### Chat Management
```http
GET /chat/conversations     # Lista de conversaciones
GET /chat/suggestions       # Obtener sugerencias contextuales
```

---

## 📈 Reports API

### Generate Report
**Endpoint:** `POST /reports/generate`

**Request Body:**
```json
{
  "type": "performance",
  "format": "pdf",
  "dateRange": {
    "start": "2025-06-21T00:00:00Z",
    "end": "2025-06-28T23:59:59Z"
  },
  "filters": {
    "sections": ["summary", "metrics", "charts"]
  }
}
```

**Response:**
- Para PDF/CSV: Stream del archivo
- Para JSON: Datos estructurados del reporte

### Schedule Report
```http
POST /reports/schedule      # Programar reporte recurrente
GET  /reports/scheduled     # Lista de reportes programados
```

---

## 🔧 Workflow Management API

### Workflow Operations
```http
GET    /workflows                    # Lista workflows
POST   /workflows                    # Crear workflow
GET    /workflows/:id                # Obtener workflow específico
PUT    /workflows/:id                # Actualizar workflow
DELETE /workflows/:id                # Eliminar workflow
POST   /workflows/:id/optimize       # Optimizar con AI
GET    /workflows/:id/analytics      # Analytics del workflow
```

---

## 📊 Analytics API

### Workflow Analytics
```http
GET /analytics/workflows         # Analytics generales de workflows
GET /analytics/agents           # Analytics de agentes
GET /analytics/performance      # Métricas de performance
GET /analytics/optimization     # Estadísticas de optimización
```

---

## 🏥 Health & Monitoring

### Health Check
**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-06-28T10:45:00Z",
  "uptime": 86400,
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy", 
    "ai": "healthy"
  }
}
```

### System Status
```http
GET /system/status          # Estado del sistema
GET /system/metrics         # Métricas del sistema
GET /system/logs            # Logs del sistema
```

---

## 🔒 Error Responses

### Standard Error Format
```json
{
  "error": "Bad Request",
  "message": "Description is required",
  "code": 400,
  "timestamp": "2025-06-28T10:45:00Z",
  "path": "/api/v1/generator/generate"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `501` - Not Implemented

---

## 📝 Rate Limiting

- **Auth endpoints**: 5 requests per 15 minutes
- **General API**: 100 requests per 15 minutes
- **Generator API**: 10 requests per minute
- **Chat API**: 20 requests per minute

---

## 🛠️ Development & Testing

### Test Endpoints
```bash
# Test WorkflowGenerator
curl -X POST http://localhost:3456/api/v1/generator/generate \
  -H "Content-Type: application/json" \
  -d '{"description": "test workflow"}'

# Test Dashboard
curl -X GET http://localhost:3456/api/v1/dashboard/data \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Health
curl -X GET http://localhost:3456/health
```

### Environment Setup
```bash
# Required environment variables
DB_PORT=5433
REDIS_PORT=6380
API_PORT=3456
OPENAI_API_KEY=your_key_here
```

---

## 📚 Additional Resources

- [Deployment Guide](./DOCKER_README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Frontend Integration Guide](./FRONTEND_INTEGRATION.md)

---

**Last Updated:** 2025-06-28  
**API Version:** v1.0.0