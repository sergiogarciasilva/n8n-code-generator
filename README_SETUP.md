# n8n Agent Platform - Guía de Instalación

## 🚀 Instalación Rápida

1. **Ejecutar el script de instalación:**
   ```bash
   cd /home/sergio/n8n_code_generator_github
   ./install.sh
   ```

2. **Configurar las API Keys:**
   
   Edita el archivo `.env` con tus claves:
   
   - `/home/sergio/n8n_code_generator_github/n8n-agent-platform/core/.env`
   
   Necesitas agregar:
   - `OPENAI_API_KEY`: Tu clave de OpenAI
   - `ANTHROPIC_API_KEY`: Tu clave de Anthropic (opcional)
   - `N8N_API_KEY`: Tu clave de n8n (si usas n8n Cloud)
   - `DATABASE_URL`: URL de conexión a PostgreSQL

## 🖥️ Iniciar la Aplicación

### Opción 1: Usando el icono del escritorio
- Haz doble clic en el icono "n8n Agent Platform" en tu escritorio

### Opción 2: Desde la terminal
```bash
/home/sergio/n8n_code_generator_github/launcher.sh
```

### Opción 3: Comandos directos
```bash
# Iniciar todo
./launcher.sh --start

# Solo el dashboard
./launcher.sh --dashboard

# Detener todo
./launcher.sh --stop
```

## 📋 Servicios Incluidos

1. **n8n Agent Platform API** (Puerto 3000)
   - API REST para gestión de workflows
   - Motor de IA para generación automática
   - Sistema de validación y análisis
   - Integración con n8n Cloud

2. **Web Dashboard** (Puerto 5173)
   - Interfaz gráfica moderna con diseño glassmorphism
   - Editor visual de workflows
   - Gestión de agentes IA
   - Métricas y analytics en tiempo real
   - Marketplace de templates

3. **Web Application** (Puerto 3456)
   - Aplicación web principal
   - Generador de workflows con IA
   - Sistema de testing y debugging
   - Panel de control empresarial

## 🔧 Gestión de Servicios

### Ver estado de los servicios:
```bash
pm2 status
```

### Ver logs:
```bash
pm2 logs
pm2 logs n8n-agent-platform
pm2 logs n8n-dashboard
pm2 logs n8n-web-app
```

### Reiniciar servicios:
```bash
pm2 restart all
pm2 restart n8n-agent-platform
```

### Monitoreo en tiempo real:
```bash
pm2 monit
```

## 🗄️ Base de Datos

Las bases de datos se crean automáticamente:
- `n8n_agent_platform`: Base de datos principal del sistema
- Incluye tablas para workflows, templates, usuarios, y métricas

Conexión:
- Host: localhost
- Puerto: 15432
- Usuario: sergio
- Password: [configurado en .env]

## 🐛 Solución de Problemas

### Si la instalación falla:
1. Verifica que PostgreSQL esté ejecutándose:
   ```bash
   docker ps | grep postgres
   ```

2. Verifica que tengas Node.js 16+:
   ```bash
   node --version
   ```

3. Revisa los logs:
   ```bash
   cat /home/sergio/n8n_code_generator_github/logs/*.log
   ```

### Si los servicios no inician:
1. Verifica que el archivo .env esté configurado correctamente
2. Asegúrate de que los puertos no estén ocupados:
   ```bash
   sudo lsof -i :3000
   sudo lsof -i :5173
   sudo lsof -i :3456
   ```

### Para reinstalar:
```bash
# Detener servicios
pm2 delete all

# Limpiar node_modules
find . -name "node_modules" -type d -prune -exec rm -rf '{}' +

# Reinstalar
./install.sh
```

## 📱 Acceso a las Aplicaciones

- **Dashboard Principal**: http://localhost:5173
- **API Platform**: http://localhost:3000
- **API Docs**: http://localhost:3000/api-docs
- **Generador de Workflows**: http://localhost:5173/workflow-generator.html
- **Métricas Avanzadas**: http://localhost:5173/advanced-metrics-dashboard.html

## 🔐 Seguridad

Recuerda:
- No compartir los archivos .env
- Cambiar las contraseñas por defecto
- Configurar un firewall si expones los servicios
- Habilitar HTTPS para producción
- Configurar autenticación JWT

## 💡 Próximos Pasos

1. Configura tus API keys en el archivo .env
2. Inicia la aplicación con el launcher
3. Accede al dashboard web
4. Explora el generador de workflows con IA
5. Crea tu primer workflow automatizado!

## 🌟 Características Principales

- **Generador IA de Workflows**: Crea workflows desde lenguaje natural
- **Editor Visual**: Interfaz drag-and-drop para diseñar workflows
- **Integración n8n Cloud**: Sincroniza con tu instancia de n8n
- **Sistema de Templates**: Biblioteca de workflows pre-construidos
- **Analytics Avanzados**: Métricas de rendimiento y uso
- **Multi-agente IA**: Orquestación de múltiples modelos de IA
- **Diseño Glassmorphism**: Interfaz moderna estilo Apple

¿Necesitas ayuda? Revisa los logs o abre un issue en el repositorio.