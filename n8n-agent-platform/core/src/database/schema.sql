-- n8n Agent Platform Database Schema

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    nodes JSONB NOT NULL,
    connections JSONB NOT NULL,
    settings JSONB,
    active BOOLEAN DEFAULT true,
    optimization_enabled BOOLEAN DEFAULT true,
    last_optimized TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_active ON workflows(active);
CREATE INDEX idx_workflows_optimization ON workflows(optimization_enabled);

-- Agent registry
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('mcp', 'telegram', 'multi-agent', 'general')),
    description TEXT,
    status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'active', 'paused', 'stopped', 'error')),
    config JSONB,
    last_run TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agents_type ON agents(type);
CREATE INDEX idx_agents_status ON agents(status);

-- Workflow analysis history
CREATE TABLE IF NOT EXISTS workflow_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    analysis JSONB NOT NULL,
    confidence FLOAT,
    execution_time INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

CREATE INDEX idx_analyses_workflow ON workflow_analyses(workflow_id);
CREATE INDEX idx_analyses_agent ON workflow_analyses(agent_id);
CREATE INDEX idx_analyses_created ON workflow_analyses(created_at DESC);

-- Optimization suggestions
CREATE TABLE IF NOT EXISTS optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id VARCHAR(255) UNIQUE NOT NULL,
    workflow_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('performance', 'reliability', 'security', 'feature', 'refactor')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    impact VARCHAR(20) CHECK (impact IN ('high', 'medium', 'low')),
    effort VARCHAR(20) CHECK (effort IN ('high', 'medium', 'low')),
    confidence FLOAT,
    metadata JSONB,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'failed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    applied_at TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

CREATE INDEX idx_suggestions_workflow ON optimization_suggestions(workflow_id);
CREATE INDEX idx_suggestions_status ON optimization_suggestions(status);
CREATE INDEX idx_suggestions_type ON optimization_suggestions(type);

-- Workflow changes log
CREATE TABLE IF NOT EXISTS workflow_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) NOT NULL,
    agent_id VARCHAR(255) NOT NULL,
    suggestion_id VARCHAR(255),
    change_type VARCHAR(50),
    before_state JSONB,
    after_state JSONB,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    rollback_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE,
    FOREIGN KEY (suggestion_id) REFERENCES optimization_suggestions(suggestion_id)
);

CREATE INDEX idx_changes_workflow ON workflow_changes(workflow_id);
CREATE INDEX idx_changes_created ON workflow_changes(created_at DESC);

-- Agent execution logs
CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    workflow_id VARCHAR(255),
    status VARCHAR(50) CHECK (status IN ('started', 'running', 'completed', 'failed', 'cancelled')),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    execution_time INTEGER,
    workflows_processed INTEGER DEFAULT 0,
    changes_applied INTEGER DEFAULT 0,
    error_message TEXT,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_executions_agent ON agent_executions(agent_id);
CREATE INDEX idx_executions_status ON agent_executions(status);
CREATE INDEX idx_executions_start ON agent_executions(start_time DESC);

-- Agent metrics
CREATE TABLE IF NOT EXISTS agent_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    agent_type VARCHAR(50),
    metric_type VARCHAR(50),
    metric_value FLOAT,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_agent ON agent_metrics(agent_id);
CREATE INDEX idx_metrics_timestamp ON agent_metrics(timestamp DESC);

-- Workflow execution results
CREATE TABLE IF NOT EXISTS workflow_execution_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) NOT NULL,
    execution_id VARCHAR(255),
    test_type VARCHAR(50) CHECK (test_type IN ('unit', 'integration', 'simulation', 'live')),
    success BOOLEAN,
    execution_time INTEGER,
    node_results JSONB,
    error_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

CREATE INDEX idx_execution_results_workflow ON workflow_execution_results(workflow_id);
CREATE INDEX idx_execution_results_created ON workflow_execution_results(created_at DESC);

-- Performance benchmarks
CREATE TABLE IF NOT EXISTS performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(255) NOT NULL,
    benchmark_type VARCHAR(50),
    baseline_time INTEGER,
    optimized_time INTEGER,
    improvement_percentage FLOAT,
    node_metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

CREATE INDEX idx_benchmarks_workflow ON performance_benchmarks(workflow_id);

-- Agent schedules
CREATE TABLE IF NOT EXISTS agent_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL,
    schedule_type VARCHAR(50) CHECK (schedule_type IN ('cron', 'interval', 'manual', 'triggered')),
    cron_expression VARCHAR(255),
    interval_seconds INTEGER,
    enabled BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP,
    next_trigger TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_agent ON agent_schedules(agent_id);
CREATE INDEX idx_schedules_enabled ON agent_schedules(enabled);
CREATE INDEX idx_schedules_next ON agent_schedules(next_trigger);

-- System events
CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    source VARCHAR(100),
    severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_type ON system_events(event_type);
CREATE INDEX idx_events_severity ON system_events(severity);
CREATE INDEX idx_events_created ON system_events(created_at DESC);

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update trigger to relevant tables
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_schedules_updated_at BEFORE UPDATE ON agent_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW v_active_agents AS
SELECT 
    a.agent_id,
    a.name,
    a.type,
    a.status,
    a.last_run,
    COUNT(DISTINCT ae.id) as total_runs,
    AVG(ae.execution_time) as avg_execution_time,
    SUM(ae.changes_applied) as total_changes
FROM agents a
LEFT JOIN agent_executions ae ON a.agent_id = ae.agent_id
WHERE a.status != 'stopped'
GROUP BY a.agent_id, a.name, a.type, a.status, a.last_run;

CREATE OR REPLACE VIEW v_workflow_optimization_status AS
SELECT 
    w.workflow_id,
    w.name,
    w.last_optimized,
    COUNT(DISTINCT s.id) as total_suggestions,
    COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'applied') as applied_suggestions,
    COUNT(DISTINCT c.id) as total_changes,
    MAX(c.created_at) as last_change
FROM workflows w
LEFT JOIN optimization_suggestions s ON w.workflow_id = s.workflow_id
LEFT JOIN workflow_changes c ON w.workflow_id = c.workflow_id
WHERE w.optimization_enabled = true
GROUP BY w.workflow_id, w.name, w.last_optimized;

CREATE OR REPLACE VIEW v_recent_optimizations AS
SELECT 
    s.suggestion_id,
    s.workflow_id,
    w.name as workflow_name,
    s.agent_id,
    s.type,
    s.title,
    s.impact,
    s.status,
    s.created_at,
    s.applied_at
FROM optimization_suggestions s
JOIN workflows w ON s.workflow_id = w.workflow_id
ORDER BY s.created_at DESC
LIMIT 100;