● Para instalar la extensión n8n Copilot en VS Code, sigue estos pasos:

  Instalación Local (Desarrollo)

  1. Prerequisitos

  # Instalar Node.js 16+ y npm
  node --version  # Debe ser 16 o superior

  # Instalar PostgreSQL (opcional, para templates)
  # En Ubuntu/Debian:
  sudo apt install postgresql

  # En macOS:
  brew install postgresql

  2. Clonar y preparar el proyecto

  # Navegar al directorio del proyecto
  cd /mnt/Datos/n8n_code_generator_github/n8n-copilot-extension

  # Instalar dependencias
  npm install

  # Crear archivo .env desde el ejemplo
  cp .env.example .env

  3. Configurar credenciales

  Edita el archivo .env con tus credenciales:
  # n8n Configuration
  N8N_API_URL=https://app.n8n.cloud/api/v1/
  N8N_API_KEY=tu_api_key_de_n8n

  # OpenAI Configuration (para sugerencias IA)
  OPENAI_API_KEY=tu_api_key_de_openai

  # Database (opcional)
  DB_PASSWORD=tu_password_postgres

  4. Compilar la extensión

  # Compilar todo
  npm run compile

  # O compilar con watch mode
  npm run watch

  5. Configurar base de datos (opcional)

  # Crear base de datos
  createdb n8n_copilot

  # Ejecutar migraciones
  npm run db:migrate

  # Cargar templates
  npm run db:seed

  6. Instalar en VS Code

  Opción A: Desde VS Code (recomendado)
  1. Abre VS Code
  2. Presiona F5 o ve a Run → Start Debugging
  3. Se abrirá una nueva ventana de VS Code con la extensión cargada

  Opción B: Instalar como VSIX
  # Instalar vsce si no lo tienes
  npm install -g vsce

  # Empaquetar la extensión
  vsce package

  # Instalar el archivo .vsix generado
  code --install-extension n8n-copilot-extension-0.0.1.vsix

  7. Configurar la extensión en VS Code

  1. Ve a Settings (Cmd/Ctrl + ,)
  2. Busca "n8n"
  3. Configura:
    - n8n.apiKey: Tu API key de n8n Cloud
    - n8n.openaiApiKey: Tu API key de OpenAI
    - n8n.localServerPort: Puerto del servidor local (default: 3456)

  Uso Rápido

  Crear un workflow:

  1. Cmd/Ctrl + Shift + P
  2. Escribe: "n8n: Create Workflow from Description"
  3. Describe tu workflow, ej: "Crear un bot de Telegram que responda mensajes"

  Ejecutar un workflow:

  1. Abre un archivo .n8n.json
  2. Cmd/Ctrl + Shift + P
  3. "n8n: Execute Workflow"

  Ejecutar localmente (sin n8n Cloud):

  # En el directorio del proyecto, iniciar el servidor local
  cd n8n-copilot-extension
  node out/server/localServer.js

  ¿Necesitas ayuda con algún paso específico de la instalación?

