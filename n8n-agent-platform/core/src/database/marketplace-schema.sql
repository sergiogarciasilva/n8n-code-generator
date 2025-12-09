-- Marketplace Schema for n8n Agent Platform

-- Marketplace Templates Table
CREATE TABLE marketplace_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    tags JSONB DEFAULT '[]',
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    compatibility JSONB NOT NULL,
    workflow JSONB NOT NULL, -- Encrypted workflow definition
    documentation JSONB NOT NULL,
    screenshots JSONB DEFAULT '[]',
    icon TEXT,
    pricing JSONB DEFAULT '{"model": "free"}',
    featured BOOLEAN DEFAULT FALSE,
    certified BOOLEAN DEFAULT FALSE,
    quality_score DECIMAL(3,2) DEFAULT 0.00,
    downloads INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00,
    reviews INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    certification_date TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_category CHECK (category IN ('automation', 'integration', 'analytics', 'communication', 'utility', 'ai-ml', 'security', 'finance', 'hr', 'marketing')),
    CONSTRAINT valid_version CHECK (version ~ '^\d+\.\d+\.\d+$'),
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 1),
    CONSTRAINT valid_rating CHECK (rating >= 0 AND rating <= 5)
);

-- Marketplace Connectors Table
CREATE TABLE marketplace_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    version VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    authentication JSONB NOT NULL,
    operations JSONB NOT NULL, -- Encrypted connector code
    icon TEXT NOT NULL,
    color VARCHAR(7) NOT NULL,
    documentation TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requirements JSONB DEFAULT '{}',
    certified BOOLEAN DEFAULT FALSE,
    enterprise BOOLEAN DEFAULT FALSE,
    installs INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    certification_date TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_connector_type CHECK (type IN ('action', 'trigger', 'app', 'protocol')),
    CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT valid_connector_version CHECK (version ~ '^\d+\.\d+\.\d+$')
);

-- Template Versions History
CREATE TABLE template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    changes JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_template_version UNIQUE (template_id, version)
);

-- Connector Versions History
CREATE TABLE connector_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES marketplace_connectors(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    changes JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_connector_version UNIQUE (connector_id, version)
);

-- Template Installations
CREATE TABLE template_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    installed_version VARCHAR(50) NOT NULL,
    installation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_template_install UNIQUE (template_id, workspace_id)
);

-- Installed Connectors
CREATE TABLE installed_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES marketplace_connectors(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    version VARCHAR(50) NOT NULL,
    config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    installed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_connector_install UNIQUE (connector_id, workspace_id),
    CONSTRAINT valid_connector_status CHECK (status IN ('active', 'disabled', 'error', 'updating'))
);

-- Template Reviews
CREATE TABLE template_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    comment TEXT,
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_template_review UNIQUE (template_id, user_id),
    CONSTRAINT valid_review_rating CHECK (rating >= 1 AND rating <= 5)
);

-- Connector Reviews
CREATE TABLE connector_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES marketplace_connectors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL,
    comment TEXT,
    helpful_votes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_connector_review UNIQUE (connector_id, user_id),
    CONSTRAINT valid_connector_rating CHECK (rating >= 1 AND rating <= 5)
);

-- Marketplace Authors (Extended User Info)
CREATE TABLE marketplace_authors (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    bio TEXT,
    company VARCHAR(255),
    website VARCHAR(500),
    github_url VARCHAR(500),
    twitter_handle VARCHAR(100),
    verified BOOLEAN DEFAULT FALSE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    lifetime_earnings DECIMAL(10,2) DEFAULT 0.00,
    total_downloads INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_balance CHECK (balance >= 0)
);

-- Template Purchases
CREATE TABLE template_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES marketplace_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_purchase UNIQUE (template_id, user_id),
    CONSTRAINT valid_amount CHECK (amount >= 0)
);

-- Marketplace Transactions
CREATE TABLE marketplace_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES marketplace_templates(id) ON DELETE SET NULL,
    connector_id UUID REFERENCES marketplace_connectors(id) ON DELETE SET NULL,
    purchaser_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    author_revenue DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_processor VARCHAR(50),
    processor_transaction_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_transaction_status CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    CONSTRAINT has_item CHECK (template_id IS NOT NULL OR connector_id IS NOT NULL)
);

-- Certification Queue
CREATE TABLE certification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewer_id UUID REFERENCES users(id),
    review_notes TEXT,
    test_results JSONB,
    CONSTRAINT valid_item_type CHECK (item_type IN ('template', 'connector')),
    CONSTRAINT valid_cert_status CHECK (status IN ('pending', 'in_review', 'testing', 'approved', 'rejected'))
);

-- Template Categories
CREATE TABLE template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    parent_id UUID REFERENCES template_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Featured Collections
CREATE TABLE featured_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    slug VARCHAR(255) NOT NULL UNIQUE,
    items JSONB NOT NULL DEFAULT '[]', -- Array of template/connector IDs
    banner_image TEXT,
    active BOOLEAN DEFAULT TRUE,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Marketplace Search Index (for full-text search)
CREATE TABLE marketplace_search_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL,
    item_type VARCHAR(20) NOT NULL,
    search_vector tsvector,
    content TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_search_item UNIQUE (item_id, item_type)
);

-- Create indexes for performance
CREATE INDEX idx_templates_category ON marketplace_templates(category);
CREATE INDEX idx_templates_author ON marketplace_templates(author_id);
CREATE INDEX idx_templates_featured ON marketplace_templates(featured) WHERE featured = TRUE;
CREATE INDEX idx_templates_certified ON marketplace_templates(certified) WHERE certified = TRUE;
CREATE INDEX idx_templates_created ON marketplace_templates(created_at DESC);
CREATE INDEX idx_templates_downloads ON marketplace_templates(downloads DESC);
CREATE INDEX idx_templates_rating ON marketplace_templates(rating DESC);
CREATE INDEX idx_templates_tags ON marketplace_templates USING gin(tags);

CREATE INDEX idx_connectors_category ON marketplace_connectors(category);
CREATE INDEX idx_connectors_type ON marketplace_connectors(type);
CREATE INDEX idx_connectors_author ON marketplace_connectors(author_id);
CREATE INDEX idx_connectors_enterprise ON marketplace_connectors(enterprise) WHERE enterprise = TRUE;
CREATE INDEX idx_connectors_certified ON marketplace_connectors(certified) WHERE certified = TRUE;

CREATE INDEX idx_installations_user ON template_installations(user_id);
CREATE INDEX idx_installations_workspace ON template_installations(workspace_id);
CREATE INDEX idx_installations_date ON template_installations(installation_date DESC);

CREATE INDEX idx_reviews_template ON template_reviews(template_id);
CREATE INDEX idx_reviews_user ON template_reviews(user_id);
CREATE INDEX idx_reviews_rating ON template_reviews(rating);

CREATE INDEX idx_transactions_author ON marketplace_transactions(author_id);
CREATE INDEX idx_transactions_purchaser ON marketplace_transactions(purchaser_id);
CREATE INDEX idx_transactions_status ON marketplace_transactions(status);
CREATE INDEX idx_transactions_created ON marketplace_transactions(created_at DESC);

CREATE INDEX idx_search_vector ON marketplace_search_index USING gin(search_vector);
CREATE INDEX idx_search_type ON marketplace_search_index(item_type);

-- Full-text search triggers
CREATE OR REPLACE FUNCTION update_marketplace_search() RETURNS trigger AS $$
BEGIN
    IF TG_TABLE_NAME = 'marketplace_templates' THEN
        INSERT INTO marketplace_search_index (item_id, item_type, content, search_vector)
        VALUES (
            NEW.id,
            'template',
            NEW.name || ' ' || NEW.description || ' ' || COALESCE(NEW.tags::text, ''),
            to_tsvector('english', NEW.name || ' ' || NEW.description || ' ' || COALESCE(NEW.tags::text, ''))
        )
        ON CONFLICT (item_id, item_type) DO UPDATE
        SET content = EXCLUDED.content,
            search_vector = EXCLUDED.search_vector,
            updated_at = CURRENT_TIMESTAMP;
    ELSIF TG_TABLE_NAME = 'marketplace_connectors' THEN
        INSERT INTO marketplace_search_index (item_id, item_type, content, search_vector)
        VALUES (
            NEW.id,
            'connector',
            NEW.name || ' ' || NEW.display_name || ' ' || NEW.description,
            to_tsvector('english', NEW.name || ' ' || NEW.display_name || ' ' || NEW.description)
        )
        ON CONFLICT (item_id, item_type) DO UPDATE
        SET content = EXCLUDED.content,
            search_vector = EXCLUDED.search_vector,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_template_search
    AFTER INSERT OR UPDATE ON marketplace_templates
    FOR EACH ROW EXECUTE FUNCTION update_marketplace_search();

CREATE TRIGGER update_connector_search
    AFTER INSERT OR UPDATE ON marketplace_connectors
    FOR EACH ROW EXECUTE FUNCTION update_marketplace_search();

-- Update timestamp triggers
CREATE TRIGGER update_marketplace_templates_updated_at
    BEFORE UPDATE ON marketplace_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_connectors_updated_at
    BEFORE UPDATE ON marketplace_connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_reviews_updated_at
    BEFORE UPDATE ON template_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connector_reviews_updated_at
    BEFORE UPDATE ON connector_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Default categories
INSERT INTO template_categories (name, display_name, description, icon, sort_order) VALUES
    ('automation', 'Automation', 'Automate repetitive tasks and processes', 'robot', 1),
    ('integration', 'Integration', 'Connect different services and APIs', 'link', 2),
    ('analytics', 'Analytics', 'Data analysis and reporting workflows', 'chart-line', 3),
    ('communication', 'Communication', 'Email, messaging, and notification workflows', 'message', 4),
    ('utility', 'Utility', 'General purpose utility workflows', 'tools', 5),
    ('ai-ml', 'AI & Machine Learning', 'AI-powered workflows and ML pipelines', 'brain', 6),
    ('security', 'Security', 'Security monitoring and compliance workflows', 'shield', 7),
    ('finance', 'Finance', 'Financial automation and reporting', 'dollar-sign', 8),
    ('hr', 'Human Resources', 'HR and employee management workflows', 'users', 9),
    ('marketing', 'Marketing', 'Marketing automation and campaign management', 'megaphone', 10);