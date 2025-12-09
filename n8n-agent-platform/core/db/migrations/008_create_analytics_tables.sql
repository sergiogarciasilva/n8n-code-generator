-- Analytics metrics table
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    value NUMERIC NOT NULL,
    labels JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX idx_metrics_labels ON metrics USING GIN(labels);
CREATE INDEX idx_metrics_metric_name ON metrics((labels->>'metric_name'));
CREATE INDEX idx_metrics_composite ON metrics(timestamp, (labels->>'metric_name'));

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    predicted_value NUMERIC NOT NULL,
    confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    upper_bound NUMERIC NOT NULL,
    lower_bound NUMERIC NOT NULL,
    model_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_predictions_metric_timestamp ON predictions(metric_name, timestamp);

-- Anomalies table
CREATE TABLE IF NOT EXISTS anomalies (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    value NUMERIC NOT NULL,
    expected_value NUMERIC,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    reason TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_anomalies_metric_timestamp ON anomalies(metric_name, timestamp);
CREATE INDEX idx_anomalies_severity ON anomalies(severity);
CREATE INDEX idx_anomalies_unresolved ON anomalies(resolved) WHERE resolved = FALSE;

-- Analytics reports table
CREATE TABLE IF NOT EXISTS analytics_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metrics TEXT[] NOT NULL,
    time_range JSONB NOT NULL,
    schedule VARCHAR(100), -- cron expression for scheduled reports
    format VARCHAR(20) NOT NULL CHECK (format IN ('pdf', 'csv', 'json')),
    recipients TEXT[], -- email addresses
    created_by UUID REFERENCES users(id),
    last_generated_at TIMESTAMPTZ,
    next_generation_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_reports_creator ON analytics_reports(created_by);
CREATE INDEX idx_analytics_reports_schedule ON analytics_reports(next_generation_at) WHERE schedule IS NOT NULL;

-- Report executions table
CREATE TABLE IF NOT EXISTS report_executions (
    id SERIAL PRIMARY KEY,
    report_id INTEGER REFERENCES analytics_reports(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_url TEXT,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_report_executions_report ON report_executions(report_id);
CREATE INDEX idx_report_executions_status ON report_executions(status);

-- Metric baselines table (for anomaly detection)
CREATE TABLE IF NOT EXISTS metric_baselines (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL UNIQUE,
    mean NUMERIC NOT NULL,
    std_dev NUMERIC NOT NULL,
    min_value NUMERIC NOT NULL,
    max_value NUMERIC NOT NULL,
    p50 NUMERIC NOT NULL,
    p95 NUMERIC NOT NULL,
    p99 NUMERIC NOT NULL,
    sample_count INTEGER NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Correlations cache table
CREATE TABLE IF NOT EXISTS metric_correlations (
    id SERIAL PRIMARY KEY,
    metric1 VARCHAR(255) NOT NULL,
    metric2 VARCHAR(255) NOT NULL,
    correlation NUMERIC NOT NULL CHECK (correlation >= -1 AND correlation <= 1),
    p_value NUMERIC,
    sample_count INTEGER NOT NULL,
    time_range JSONB NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric1, metric2, time_range)
);

CREATE INDEX idx_correlations_metrics ON metric_correlations(metric1, metric2);

-- ML model metadata table
CREATE TABLE IF NOT EXISTS ml_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    model_type VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    metrics JSONB NOT NULL, -- accuracy, loss, etc.
    parameters JSONB NOT NULL, -- hyperparameters
    training_data_info JSONB,
    model_path TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Business metrics aggregations (pre-computed for performance)
CREATE TABLE IF NOT EXISTS metric_aggregations_hourly (
    metric_name VARCHAR(255) NOT NULL,
    hour TIMESTAMPTZ NOT NULL,
    count INTEGER NOT NULL,
    sum NUMERIC NOT NULL,
    avg NUMERIC NOT NULL,
    min NUMERIC NOT NULL,
    max NUMERIC NOT NULL,
    p50 NUMERIC NOT NULL,
    p95 NUMERIC NOT NULL,
    p99 NUMERIC NOT NULL,
    labels JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (metric_name, hour, labels)
);

CREATE INDEX idx_metric_aggregations_hourly_time ON metric_aggregations_hourly(hour);

-- Daily aggregations
CREATE TABLE IF NOT EXISTS metric_aggregations_daily (
    metric_name VARCHAR(255) NOT NULL,
    day DATE NOT NULL,
    count INTEGER NOT NULL,
    sum NUMERIC NOT NULL,
    avg NUMERIC NOT NULL,
    min NUMERIC NOT NULL,
    max NUMERIC NOT NULL,
    p50 NUMERIC NOT NULL,
    p95 NUMERIC NOT NULL,
    p99 NUMERIC NOT NULL,
    labels JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (metric_name, day, labels)
);

CREATE INDEX idx_metric_aggregations_daily_time ON metric_aggregations_daily(day);

-- Optimization recommendations table
CREATE TABLE IF NOT EXISTS optimization_recommendations (
    id SERIAL PRIMARY KEY,
    workflow_id UUID REFERENCES workflows(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('performance', 'cost', 'reliability', 'security')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    expected_improvement VARCHAR(255),
    implementation_details JSONB,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed', 'failed')),
    applied_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    dismissed_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_optimization_recommendations_workflow ON optimization_recommendations(workflow_id);
CREATE INDEX idx_optimization_recommendations_status ON optimization_recommendations(status);
CREATE INDEX idx_optimization_recommendations_type ON optimization_recommendations(type);

-- Functions for analytics

-- Function to calculate percentile
CREATE OR REPLACE FUNCTION calculate_percentile(
    values NUMERIC[],
    percentile NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    n INTEGER := array_length(values, 1);
    k NUMERIC;
    f INTEGER;
    c INTEGER;
BEGIN
    IF n = 0 OR percentile < 0 OR percentile > 100 THEN
        RETURN NULL;
    END IF;
    
    -- Sort array
    values := array(SELECT unnest(values) ORDER BY 1);
    
    k := percentile * (n - 1) / 100.0;
    f := floor(k);
    c := ceiling(k);
    
    IF f = c THEN
        RETURN values[f + 1];
    ELSE
        RETURN values[f + 1] + (k - f) * (values[c + 1] - values[f + 1]);
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analytics_reports_updated_at
    BEFORE UPDATE ON analytics_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_models_updated_at
    BEFORE UPDATE ON ml_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Materialized view for real-time dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_dashboard_summary AS
SELECT
    'workflow_executions' as metric,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    AVG(execution_time) as avg_execution_time,
    MAX(created_at) as last_execution
FROM workflow_executions
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'

UNION ALL

SELECT
    'agent_activities' as metric,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
    AVG(duration_ms) as avg_execution_time,
    MAX(created_at) as last_execution
FROM agent_executions
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

CREATE INDEX idx_analytics_dashboard_summary ON analytics_dashboard_summary(metric);

-- Refresh materialized view every hour
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
    'refresh-analytics-dashboard',
    '0 * * * *', -- Every hour
    'REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_dashboard_summary;'
);