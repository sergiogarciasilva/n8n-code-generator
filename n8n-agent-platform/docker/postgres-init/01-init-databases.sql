-- n8n Agent Platform Database Initialization Script
-- This script creates the necessary databases and extensions

-- Create n8n instance database (separate from platform database)
CREATE DATABASE n8n_instance_db;

-- Switch to platform database
\c n8n_agent_platform_db;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas for better organization
CREATE SCHEMA IF NOT EXISTS agent_platform;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS security;

-- Set default search path
ALTER DATABASE n8n_agent_platform_db SET search_path TO agent_platform, public;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE n8n_agent_platform_db TO n8n_agent_user;
GRANT ALL PRIVILEGES ON SCHEMA agent_platform TO n8n_agent_user;
GRANT ALL PRIVILEGES ON SCHEMA analytics TO n8n_agent_user;
GRANT ALL PRIVILEGES ON SCHEMA security TO n8n_agent_user;

-- Create base tables structure
CREATE TABLE IF NOT EXISTS agent_platform.system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial configuration
INSERT INTO agent_platform.system_config (key, value, description) VALUES
    ('platform_version', '"1.0.0"', 'Current platform version'),
    ('initialized', 'true', 'Platform initialization status'),
    ('environment', '"development"', 'Current environment')
ON CONFLICT (key) DO NOTHING;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_system_config_key ON agent_platform.system_config(key);

-- Add comments for documentation
COMMENT ON SCHEMA agent_platform IS 'Main schema for n8n Agent Platform data';
COMMENT ON SCHEMA analytics IS 'Schema for analytics and reporting data';
COMMENT ON SCHEMA security IS 'Schema for security-related data';
COMMENT ON TABLE agent_platform.system_config IS 'System configuration storage';

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'n8n Agent Platform database initialized successfully';
END $$;