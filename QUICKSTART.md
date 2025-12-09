# n8n Code Generator - Inicio Rápido

## 🚀 Estado Actual

✅ **Servidor de Extensión**: Funcionando en http://localhost:3456
✅ **Base de Datos**: PostgreSQL configurado y bases creadas
✅ **Dependencias**: Instaladas parcialmente

## 📦 Lo que está funcionando ahora:

### 1. Servidor de API Local
El servidor está activo y proporciona los siguientes endpoints:

- `GET /health` - Verificar estado del servidor
- `POST /api/generate-workflow` - Generar workflows con IA (mock por ahora)
- `POST /api/validate-workflow` - Validar workflows
- `POST /api/execute-workflow` - Ejecutar workflows (mock)
- `GET /api/templates` - Listar plantillas disponibles

### 2. Comandos Disponibles:

```bash
# Ver estado del servidor
pm2 status

# Ver logs en tiempo real
pm2 logs n8n-extension-server

# Detener servidor
pm2 stop n8n-extension-server

# Reiniciar servidor
pm2 restart n8n-extension-server

# Probar el servidor
curl http://localhost:3456/health
```

## 🔧 Próximos Pasos:

### 1. Configurar API Keys
Edita los archivos `.env` y agrega tus claves:
```bash
# En /home/sergio/n8n_code_generator_github/n8n-copilot-extension/.env
OPENAI_API_KEY=tu_clave_aqui
N8N_API_KEY=tu_clave_n8n_aqui
```

### 2. Instalar Extensión VS Code
```bash
cd /home/sergio/n8n_code_generator_github/n8n-copilot-extension
vsce package --no-dependencies
code --install-extension n8n-copilot-extension-0.0.1.vsix
```

### 3. Usar la Extensión
1. Abre VS Code
2. Crea un archivo con extensión `.n8n.json`
3. Usa los comandos:
   - `Ctrl+Shift+P` → "n8n: Create Workflow from Description"
   - `Ctrl+Shift+P` → "n8n: Validate Current Workflow"

## 🐛 Solución de Problemas:

### Si el servidor no responde:
```bash
# Verificar si está corriendo
pm2 list

# Ver logs de error
pm2 logs n8n-extension-server --err

# Reiniciar
pm2 restart n8n-extension-server
```

### Si la extensión no funciona:
1. Verifica que el servidor esté corriendo
2. Revisa la configuración en VS Code (Settings → n8n)
3. Asegúrate de que el puerto 3456 esté disponible

## 📱 Aplicación de Escritorio

Puedes usar el icono en tu escritorio o ejecutar:
```bash
/home/sergio/n8n_code_generator_github/quick-start.sh --status
```

## 🎯 Ejemplo de Uso Rápido:

### Generar un workflow:
```bash
curl -X POST http://localhost:3456/api/generate-workflow \
  -H "Content-Type: application/json" \
  -d '{"description": "Crear un bot de Telegram que responda mensajes"}'
```

### Listar plantillas:
```bash
curl http://localhost:3456/api/templates
```

---

¡El servidor básico ya está funcionando! Puedes empezar a experimentar con los endpoints mientras completamos la instalación completa.