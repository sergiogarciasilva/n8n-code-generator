# System Setup - Linux Configuration

## Docker Setup

### Installation Details

- **Docker Location**: `/usr/local/bin/docker`
- **Docker Version**: 28.1.1, build 4eba377
- **Docker Engine**: Community Edition

### Docker Configuration

#### Docker Context
- **Current Context**: `desktop-linux`
- **Docker Endpoint**: `unix:///home/[USER]/.docker/desktop/docker.sock`
- **DOCKER_HOST**: `unix:///home/[USER]/.docker/desktop/docker.sock`

#### Configuration Files

**config.json** (`~/.docker/config.json`):
```json
{
  "auths": {},
  "credsStore": "desktop",
  "currentContext": "desktop-linux"
}
```

**daemon.json** (`~/.docker/daemon.json`):
```json
{
  "builder": {
    "gc": {
      "defaultKeepStorage": "20GB",
      "enabled": true
    }
  },
  "experimental": false
}
```

### Docker CLI Plugins

The following Docker CLI plugins are installed:

- **ai**: Docker AI Agent - Ask Gordon (v1.1.3)
- **buildx**: Docker Buildx (v0.22.0-desktop.1)
- **cloud**: Docker Cloud (0.2.20)
- **compose**: Docker Compose (v2.34.0-desktop.1)
- **debug**: Get a shell into any image or container (0.0.38)
- **desktop**: Docker Desktop commands - Beta (v0.1.6)
- **dev**: Docker Dev Environments (v0.1.2)
- **extension**: Manages Docker extensions (v0.2.27)
- **init**: Creates Docker-related starter files (v1.4.0)
- **sbom**: View packaged-based Software Bill Of Materials (0.6.0)
- **scout**: Docker Scout (v1.17.0)

### Docker Containers

**Running Containers:**
- **postgres** - PostgreSQL for analyst_suite (port 15432)
- **redis** - Redis Alpine (port 6379)
- **pgadmin** - pgAdmin4 web interface (port 5151)
- **h2o3** - H2O Open Source ML platform (port 54321)

**Stopped Containers:**
- **pycaret** - Python 3.11 environment (stopped 2 weeks ago)
- **pgvector-container** - PostgreSQL with pgvector extension (stopped 2 months ago)

### Notes

- Docker Desktop is installed but the daemon is currently not running
- The Docker daemon is configured to use the desktop socket
- Garbage collection is enabled with a default storage limit of 20GB
- Experimental features are disabled

## Conda Environment - cuda121

### Environment Details

- **Python Version**: 3.10.14
- **Location**: `/home/[USER]/miniconda3/envs/cuda121`
- **CUDA Version**: 12.1
- **Purpose**: Deep Learning and ML development with CUDA 12.1 support

### Key Libraries Installed

#### Deep Learning Frameworks
- **PyTorch**: 2.1.2 (with CUDA 12.1 and cuDNN 8.9.2)
- **PyTorch Lightning**: 2.5.1.post0
- **Diffusers**: 0.32.2
- **Transformers**: 5.34.1 
- **Accelerate**: 0.21.0
- **DeepSpeed**: 0.16.5

#### Computer Vision
- **OpenCV**: 4.11.0.86
- **Albumentations**: 1.3.1
- **Pillow**: 10.3.0
- **torchvision**: 0.16.2

#### Natural Language Processing
- **spaCy**: 3.7.6
- **NLTK**: 3.9.1
- **Nougat-OCR**: 0.1.17
- **LangChain**: 0.3.23
- **LangChain Community**: 0.3.21
- **ChromaDB**: 1.0.9

#### Scientific Computing
- **NumPy**: 1.25.2
- **Pandas**: 2.2.3
- **SciPy**: 1.14.1
- **scikit-learn**: 1.6.1
- **Matplotlib**: 3.10.1

#### CUDA Libraries
- **cuda-cudart**: 12.1.105
- **cuda-cupti**: 12.1.105
- **cuda-libraries**: 12.1.0
- **cuda-nvrtc**: 12.1.105
- **cuda-nvtx**: 12.1.105
- **cuda-opencl**: 12.8.90
- **cuda-runtime**: 12.1.0
- **libcublas**: 12.1.0.26
- **libcufft**: 11.0.2.4
- **libcurand**: 10.3.9.90
- **libcusolver**: 11.4.4.55
- **libcusparse**: 12.0.2.55
- **libnpp**: 12.0.2.50
- **libnvjpeg**: 12.1.1.14
- **libnvjitlink**: 12.1.105

#### Machine Learning Tools
- **XGBoost**: 2.1.4
- **CatBoost**: 1.2.7
- **H5py**: 3.13.0
- **Datasets**: 2.14.4
- **FAISS-GPU**: 1.10.0 (with CUDA 12 support)

#### Web and API Development
- **FastAPI**: 0.115.11
- **Gradio**: 3.41.2
- **Jupyter Lab**: 4.3.6
- **Streamlit**: 1.42.1

#### Additional Tools
- **ONNX Runtime**: 1.22.0
- **TensorBoard**: 2.17.0
- **Weights & Biases**: 0.19.4
- **Neo4j**: 5.28.1
- **DuckDB**: 1.2.2
- **Redis-py**: 5.3.0

### GPU Configuration

**System GPUs:**
- **GPU 0**: NVIDIA GeForce RTX 3090 (24GB VRAM)
  - Memory Usage: 475MiB / 24576MiB
  - Power: 18W / 350W
  - Temperature: 40°C
- **GPU 1**: NVIDIA GeForce RTX 3090 (24GB VRAM)
  - Memory Usage: 27MiB / 24576MiB
  - Power: 7W / 350W
  - Temperature: 34°C

**NVIDIA Driver**: 570.153.02
**CUDA Version**: 12.8 (system-wide)

### Other Conda Environments

- **base**: Default Miniconda environment
- **chroma-env**: ChromaDB vector database environment
- **cuda121_langflow**: LangFlow with CUDA 12.1
- **cuda12_env**: Alternative CUDA 12 environment
- **langflow-env**: LangFlow development
- **langflow_121**: Another LangFlow variant
- **langflow_basic**: Basic LangFlow setup
- **projectbot**: Project bot environment

## PostgreSQL Database Setup

### Container Configuration

- **Container Name**: postgres (analyst_suite-postgres)
- **PostgreSQL Version**: 16.8-1.pgdg120+1
- **Port Mapping**: 0.0.0.0:15432 → 5432 (container)
- **Data Volume**: `/home/[USER]/analyst_suite/data/postgres` → `/var/lib/postgresql/data`

### Connection Details

- **Host**: localhost
- **Port**: 15432
- **Default User**: [REDACTED]
- **Default Password**: [REDACTED]
- **Default Database**: analyticsdb

### Databases

#### 1. analyticsdb (Main Database)
**Owner**: [REDACTED]  
**Purpose**: Main analytics database for business intelligence and data analysis

**Tables**:

- **column_aliases** - Stores column name aliases for better readability
  - `alias` (text): Human-readable alias
  - `column_name` (text): Original column name
  - `table_name` (text): Table reference

- **data_drivers** - Business KPI drivers data
  - `country_sanitized` (text)
  - `region_sanitized` (text)
  - `pool_sanitized` (text)
  - `cost_center_sanitized` (text)
  - `ops_ssc_hq` (text)
  - `kpi_indicator_name` (text)
  - `cy` (text): Current year
  - `pl` (text): Plan
  - `ly` (text): Last year
  - `rev_m1costs_m2costs_kpi` (text)
  - `mii_vs_kpi` (text)
  - `month_sanitized` (text)

- **data_pci** - PCI (Process Control Indicators) data
  - `country_sanitized` (text)
  - `region_sanitized` (text)
  - `pool_sanitized` (text)
  - `cost_center_sanitized` (text)
  - `ops_ssc_hq` (text)
  - `pci_3_0_level_1` (text)
  - `pci_3_0_level_1_new` (text)
  - `pci_3_0_level_2` (text)
  - `pci_3_0_level_3` (text)
  - `cy` (numeric): Current year value
  - `pl` (numeric): Plan value
  - `ly` (numeric): Last year value
  - `rev_m1costs_m2costs_kpi` (text)
  - `mii_vs_kpi` (text)
  - `month_sanitized` (text)

- **distinct_column_values** - Tracks unique values per column
  - `table_name` (text)
  - `column_name` (text)
  - `value` (text)

- **glossary_definitions** - Business terminology definitions
  - `acronym_technical_name` (text)
  - `name_formal` (text)
  - `definition` (text)
  - `synonyms` (text)

- **glossary_drivers** - Driver definitions by PCI levels
  - `pci_level_1` (text)
  - `pci_level_2` (text)
  - `driver` (text)

- **n8n_vectors** - Vector embeddings for semantic search
  - `id` (integer): Primary key
  - `content` (text): Original text content
  - `metadata` (jsonb): Additional metadata
  - `embedding` (vector(1536)): Vector embedding for similarity search

- **n8n_chat_histories** - Chat conversation history
  - `id` (integer): Primary key
  - `session_id` (varchar(255)): Session identifier
  - `message` (jsonb): Chat message data

#### 2. adaptrix_db
**Owner**: adaptrix_full  
**Access**: 
- adaptrix_full (full access)
- adaptrix_readonly (read-only access)
**Status**: Empty (no tables created yet)

### PostgreSQL Extensions

- **plpgsql** (1.0): PL/pgSQL procedural language
- **uuid-ossp** (1.1): UUID generation functions
- **vector** (0.8.0): Vector data type for embeddings (supports ivfflat and hnsw)
- **pg_trgm** (1.6): Text similarity measurement and trigram-based indexing

### pgAdmin4 Web Interface

- **URL**: http://localhost:5151
- **Container**: pgadmin (dpage/pgadmin4)
- **Purpose**: Web-based PostgreSQL administration tool

## n8n Workflow Automation Setup

### Desktop Launcher

- **Location**: `/home/[USER]/Desktop/n8n.desktop`
- **Launch Script**: `/home/[USER]/Scripts/run_n8n.sh`
- **Icon**: `/home/[USER]/Pictures/n8n.png`
- **Environment**: Uses Conda environment cuda121

### n8n Configuration

#### Version and Installation
- **n8n Version**: 1.90.2
- **Installation Path**: `/home/[USER]/.nvm/versions/node/v20.18.1/bin/n8n`
- **Node.js Version**: v20.18.1 (via NVM)
- **Data Directory**: `~/.n8n/`

#### Environment Variables

**Security**:
- `N8N_ENCRYPTION_KEY`: [ENCRYPTION_KEY_REDACTED]
- `NODE_FUNCTION_ALLOW_BUILTIN`: https,fs,path,crypto,zlib,url,stream

**Database Configuration**:
- `DB_TYPE`: postgresdb
- `DB_POSTGRESDB_HOST`: localhost
- `DB_POSTGRESDB_PORT`: 15432
- `DB_POSTGRESDB_DATABASE`: analyticsdb
- `DB_POSTGRESDB_USER`: [REDACTED]
- `DB_POSTGRESDB_PASSWORD`: [REDACTED]
- `DB_POSTGRESDB_SCHEMA`: n8n

**Redis Configuration** (for queue management):
- `N8N_QUEUE_BULL_REDIS_HOST`: localhost
- `N8N_QUEUE_BULL_REDIS_PORT`: 6379

**Execution Data Settings**:
- All executions are saved (both successful and failed)
- `N8N_EXECUTIONS_DATA_SAVE_ON_SUCCESS`: all
- `N8N_EXECUTIONS_DATA_SAVE_ON_ERROR`: all
- `N8N_EXECUTION_DATA_SAVE_MODE`: all
- SQLite is disabled in favor of PostgreSQL

**Workflow Settings**:
- `N8N_WORKFLOW_ENABLE_OWNERSHIP`: true
- `N8N_CUSTOM_EXTENSIONS`: /home/[USER]/.n8n/custom-nodes (directory not created yet)

### Ngrok Integration

The setup includes automatic ngrok tunnel creation for webhook access:
- **Local Port**: 5678
- **Ngrok API**: http://localhost:4040/api/tunnels
- **Dynamic URL**: Automatically generates a public HTTPS URL for webhooks
- **Environment Variable**: `WEBHOOK_URL` is set with the ngrok URL

### Launch Process

1. Sets up environment variables and paths
2. Loads Node.js v20.18.1 via NVM
3. Starts ngrok tunnel in background
4. Waits for ngrok to initialize and fetches public URL
5. Configures database and Redis connections
6. Starts n8n server on port 5678

### Data Storage

**Local Files**:
- SQLite database: `~/.n8n/database.sqlite` (legacy, not used)
- Binary data: `~/.n8n/binaryData/`
- Git integration: `~/.n8n/git/`
- SSH keys: `~/.n8n/ssh/`
- Event logs: `~/.n8n/n8nEventLog*.log`
- Config: `~/.n8n/config`

**PostgreSQL Tables** (in n8n schema):
- Workflows
- Credentials
- Executions
- Webhook data
- User management
- Settings

### Access

- **Local URL**: http://localhost:5678
- **Public URL**: Dynamic ngrok URL (changes on each restart)
- **Database Admin**: pgAdmin at http://localhost:5151

## Node.js Setup

### Node Version Manager (NVM)

- **NVM Version**: 0.39.7
- **NVM Directory**: `/home/[USER]/.nvm`
- **Default Node Version**: 20.18.1

### Node.js Installations

**Current Active Version**: v20.18.1 (npm v11.3.0)

**Installed Versions**:
- v18.20.8 (LTS Hydrogen)
- **v20.18.1** (Current default)
- v20.19.0
- v22.15.0 (LTS Jod, latest stable)

**Version Aliases**:
- `default` → v20.18.1
- `node` → stable (v22.15.0)
- `stable` → v22.15.0
- `lts/hydrogen` → v18.20.8
- `lts/jod` → v22.15.0

### Global npm Packages (v20.18.1)

**Development Tools**:
- `typescript@5.8.3` - TypeScript compiler
- `ts-node@10.9.2` - TypeScript execution engine
- `@anthropic-ai/claude-code@1.0.35` - Claude Code CLI

**Package Managers**:
- `npm@11.3.0` - Node Package Manager
- `pnpm@10.10.0` - Fast, disk space efficient package manager
- `corepack@0.32.0` - Zero-runtime-dependency package manager bridge

**Applications**:
- `n8n@1.90.2` - Workflow automation tool
- `pm2@6.0.5` - Production process manager
- `ngrok@5.0.0-beta.2` - Secure tunneling service

**Utilities**:
- `mammoth@1.9.0` - Convert Word documents to HTML

### npm Configuration

- **Node Binary**: `/home/[USER]/.nvm/versions/node/v20.18.1/bin/node`
- **npm Local Prefix**: `/home/[USER]`
- **Global Packages Location**: `/home/[USER]/.nvm/versions/node/v20.18.1/lib`

### Usage Notes

- NVM is used to manage multiple Node.js versions
- Version v20.18.1 is set as default and primarily used for n8n
- Global packages are installed per Node.js version
- To switch versions: `nvm use <version>`
- To set default: `nvm alias default <version>`