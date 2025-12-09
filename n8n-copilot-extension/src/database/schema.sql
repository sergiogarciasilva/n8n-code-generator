-- n8n Copilot Extension Database Schema

-- Create database if not exists
-- CREATE DATABASE n8n_copilot;

-- Workflow templates table
CREATE TABLE IF NOT EXISTS workflow_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('mcp', 'telegram', 'agent', 'general')),
    nodes JSONB NOT NULL,
    connections JSONB NOT NULL,
    description TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_tags ON workflow_templates USING GIN (tags);
CREATE INDEX idx_workflow_templates_name ON workflow_templates(name);

-- Execution history table
CREATE TABLE IF NOT EXISTS execution_history (
    id SERIAL PRIMARY KEY,
    workflow_id VARCHAR(255),
    workflow_name VARCHAR(255),
    execution_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) CHECK (status IN ('running', 'success', 'error', 'cancelled')),
    execution_time INTEGER, -- milliseconds
    node_count INTEGER,
    nodes_executed JSONB,
    error_message TEXT,
    mock_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for execution history
CREATE INDEX idx_execution_history_workflow_id ON execution_history(workflow_id);
CREATE INDEX idx_execution_history_status ON execution_history(status);
CREATE INDEX idx_execution_history_created_at ON execution_history(created_at DESC);

-- User patterns table (for AI learning)
CREATE TABLE IF NOT EXISTS user_patterns (
    id SERIAL PRIMARY KEY,
    pattern_type VARCHAR(50) CHECK (pattern_type IN ('workflow', 'node_sequence', 'parameter', 'connection')),
    description TEXT,
    pattern_data JSONB NOT NULL,
    frequency INTEGER DEFAULT 1,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for user patterns
CREATE INDEX idx_user_patterns_type ON user_patterns(pattern_type);
CREATE INDEX idx_user_patterns_frequency ON user_patterns(frequency DESC);

-- Node usage statistics
CREATE TABLE IF NOT EXISTS node_usage_stats (
    id SERIAL PRIMARY KEY,
    node_type VARCHAR(255) NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 0,
    avg_execution_time FLOAT,
    success_rate FLOAT,
    common_parameters JSONB,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for node usage
CREATE INDEX idx_node_usage_stats_type ON node_usage_stats(node_type);
CREATE INDEX idx_node_usage_stats_count ON node_usage_stats(usage_count DESC);

-- Workflow snippets table
CREATE TABLE IF NOT EXISTS workflow_snippets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    snippet_type VARCHAR(50) CHECK (snippet_type IN ('node', 'node_group', 'connection_pattern', 'parameter_set')),
    content JSONB NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for snippets
CREATE INDEX idx_workflow_snippets_type ON workflow_snippets(snippet_type);
CREATE INDEX idx_workflow_snippets_tags ON workflow_snippets USING GIN (tags);

-- Error patterns table (for better error detection)
CREATE TABLE IF NOT EXISTS error_patterns (
    id SERIAL PRIMARY KEY,
    error_type VARCHAR(100) NOT NULL,
    node_type VARCHAR(255),
    error_message TEXT,
    solution TEXT,
    occurrence_count INTEGER DEFAULT 1,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for error patterns
CREATE INDEX idx_error_patterns_type ON error_patterns(error_type);
CREATE INDEX idx_error_patterns_node_type ON error_patterns(node_type);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    avg_execution_time FLOAT,
    total_executions INTEGER,
    success_count INTEGER,
    error_count INTEGER,
    unique_workflows INTEGER,
    most_used_nodes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for metrics
CREATE INDEX idx_performance_metrics_date ON performance_metrics(metric_date DESC);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE
    ON workflow_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_snippets_updated_at BEFORE UPDATE
    ON workflow_snippets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW v_popular_templates AS
SELECT 
    id,
    name,
    category,
    description,
    tags,
    usage_count
FROM workflow_templates
ORDER BY usage_count DESC
LIMIT 10;

CREATE OR REPLACE VIEW v_recent_executions AS
SELECT 
    id,
    workflow_name,
    status,
    execution_time,
    node_count,
    error_message,
    created_at
FROM execution_history
ORDER BY created_at DESC
LIMIT 50;

CREATE OR REPLACE VIEW v_node_performance AS
SELECT 
    node_type,
    usage_count,
    avg_execution_time,
    success_rate
FROM node_usage_stats
WHERE usage_count > 10
ORDER BY usage_count DESC;