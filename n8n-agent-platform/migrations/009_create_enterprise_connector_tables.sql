-- Create enterprise connectors table
CREATE TABLE IF NOT EXISTS enterprise_connectors (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    category VARCHAR(50) NOT NULL CHECK (category IN ('crm', 'erp', 'hr', 'finance', 'custom')),
    type VARCHAR(50) DEFAULT 'built-in' CHECK (type IN ('built-in', 'custom')),
    enabled BOOLEAN DEFAULT true,
    config_schema JSONB DEFAULT '{}',
    documentation_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create enterprise connections table
CREATE TABLE IF NOT EXISTS enterprise_connections (
    id VARCHAR(100) PRIMARY KEY,
    connector_id VARCHAR(50) NOT NULL REFERENCES enterprise_connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    encrypted_credentials TEXT NOT NULL,
    encryption_key VARCHAR(128) NOT NULL,
    metadata JSONB DEFAULT '{}',
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);

-- Create enterprise connection logs table for tracking
CREATE TABLE IF NOT EXISTS enterprise_connection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id VARCHAR(100) NOT NULL REFERENCES enterprise_connections(id) ON DELETE CASCADE,
    operation VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'partial')),
    duration_ms INTEGER,
    api_calls INTEGER DEFAULT 1,
    bytes_transferred BIGINT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create enterprise connector usage table
CREATE TABLE IF NOT EXISTS enterprise_connector_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id VARCHAR(50) NOT NULL REFERENCES enterprise_connectors(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    api_calls INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    data_transferred_bytes BIGINT DEFAULT 0,
    unique_connections INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connector_id, organization_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_enterprise_connections_org ON enterprise_connections(organization_id);
CREATE INDEX idx_enterprise_connections_connector ON enterprise_connections(connector_id);
CREATE INDEX idx_enterprise_connections_last_used ON enterprise_connections(last_used DESC);
CREATE INDEX idx_enterprise_connection_logs_connection ON enterprise_connection_logs(connection_id);
CREATE INDEX idx_enterprise_connection_logs_created ON enterprise_connection_logs(created_at DESC);
CREATE INDEX idx_enterprise_connector_usage_date ON enterprise_connector_usage(date DESC);
CREATE INDEX idx_enterprise_connector_usage_org ON enterprise_connector_usage(organization_id);

-- Insert default connectors
INSERT INTO enterprise_connectors (id, name, description, icon, category, type, enabled, documentation_url)
VALUES 
    ('salesforce', 'Salesforce', 'Connect to Salesforce CRM for customer data management', '☁️', 'crm', 'built-in', true, 'https://docs.n8n-agent-platform.com/connectors/salesforce'),
    ('sap', 'SAP', 'Connect to SAP ERP systems for enterprise resource planning', '🏢', 'erp', 'built-in', true, 'https://docs.n8n-agent-platform.com/connectors/sap')
ON CONFLICT (id) DO NOTHING;

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_enterprise_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_enterprise_connectors_updated_at
    BEFORE UPDATE ON enterprise_connectors
    FOR EACH ROW
    EXECUTE FUNCTION update_enterprise_updated_at();

CREATE TRIGGER update_enterprise_connections_updated_at
    BEFORE UPDATE ON enterprise_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_enterprise_updated_at();