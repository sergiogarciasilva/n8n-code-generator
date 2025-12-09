import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    subcategory: string;
    tags: string[];
    difficulty: string;
    n8n_version: string;
    workflow: any;
    metadata: any;
    created_at: Date;
    updated_at: Date;
    usage_count: number;
    rating: number;
}

export interface SimilaritySearchResult {
    template: WorkflowTemplate;
    similarity_score: number;
    match_reasons: string[];
}

export class WorkflowKnowledgeBase {
    private db: Pool;
    private knowledgeBasePath: string;

    constructor(database: Pool, knowledgeBasePath: string) {
        this.db = database;
        this.knowledgeBasePath = knowledgeBasePath;
    }

    async initialize(): Promise<void> {
        try {
            await this.createTables();
            await this.loadInitialTemplates();
            logger.info('WorkflowKnowledgeBase initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize WorkflowKnowledgeBase', { error: error.message });
            throw error;
        }
    }

    private async createTables(): Promise<void> {
        const createTemplatesTable = `
            CREATE TABLE IF NOT EXISTS workflow_templates (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category VARCHAR(100) NOT NULL,
                subcategory VARCHAR(100),
                tags JSONB DEFAULT '[]',
                difficulty VARCHAR(50) DEFAULT 'intermediate',
                n8n_version VARCHAR(50) DEFAULT 'v1.x.x',
                workflow JSONB NOT NULL,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                usage_count INTEGER DEFAULT 0,
                rating DECIMAL(3,2) DEFAULT 0.0
            );
        `;

        const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_templates_category ON workflow_templates(category);
            CREATE INDEX IF NOT EXISTS idx_templates_difficulty ON workflow_templates(difficulty);
            CREATE INDEX IF NOT EXISTS idx_templates_tags ON workflow_templates USING GIN(tags);
            CREATE INDEX IF NOT EXISTS idx_templates_usage ON workflow_templates(usage_count DESC);
            CREATE INDEX IF NOT EXISTS idx_templates_rating ON workflow_templates(rating DESC);
        `;

        const createFullTextSearch = `
            CREATE INDEX IF NOT EXISTS idx_templates_search 
            ON workflow_templates USING GIN(to_tsvector('english', name || ' ' || description));
        `;

        await this.db.query(createTemplatesTable);
        await this.db.query(createIndexes);
        await this.db.query(createFullTextSearch);
    }

    private async loadInitialTemplates(): Promise<void> {
        try {
            // Check if templates are already loaded
            const { rows } = await this.db.query('SELECT COUNT(*) as count FROM workflow_templates');
            if (parseInt(rows[0].count) > 0) {
                logger.info('Templates already loaded, skipping initial load');
                return;
            }

            // Load templates from knowledge base directory
            const workflowsDir = path.join(this.knowledgeBasePath, 'workflows');
            await this.loadTemplatesFromDirectory(workflowsDir);

            logger.info('Initial templates loaded successfully');
        } catch (error) {
            logger.error('Failed to load initial templates', { error: error.message });
        }
    }

    private async loadTemplatesFromDirectory(dir: string): Promise<void> {
        try {
            const versions = await fs.readdir(dir);
            
            for (const version of versions) {
                const versionPath = path.join(dir, version);
                const categories = await fs.readdir(versionPath);
                
                for (const category of categories) {
                    const categoryPath = path.join(versionPath, category);
                    const files = await fs.readdir(categoryPath);
                    
                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            await this.loadTemplateFile(path.join(categoryPath, file));
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Failed to load templates from directory', { dir, error: error.message });
        }
    }

    private async loadTemplateFile(filePath: string): Promise<void> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const template = JSON.parse(content);

            await this.addTemplate({
                id: template.id,
                name: template.name,
                description: template.description,
                category: template.category,
                subcategory: template.subcategory,
                tags: template.tags || [],
                difficulty: template.difficulty || 'intermediate',
                n8n_version: template.n8n_version || 'v1.x.x',
                workflow: template.workflow,
                metadata: template,
                usage_count: 0,
                rating: 0.0
            });

            logger.debug('Template loaded', { file: path.basename(filePath), id: template.id });
        } catch (error) {
            logger.error('Failed to load template file', { filePath, error: error.message });
        }
    }

    async addTemplate(template: Omit<WorkflowTemplate, 'created_at' | 'updated_at'>): Promise<void> {
        const query = `
            INSERT INTO workflow_templates 
            (id, name, description, category, subcategory, tags, difficulty, n8n_version, workflow, metadata, usage_count, rating)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                workflow = EXCLUDED.workflow,
                metadata = EXCLUDED.metadata,
                updated_at = CURRENT_TIMESTAMP
        `;

        await this.db.query(query, [
            template.id,
            template.name,
            template.description,
            template.category,
            template.subcategory,
            JSON.stringify(template.tags),
            template.difficulty,
            template.n8n_version,
            JSON.stringify(template.workflow),
            JSON.stringify(template.metadata),
            template.usage_count,
            template.rating
        ]);
    }

    async findSimilarWorkflows(
        description: string, 
        category?: string, 
        limit: number = 5
    ): Promise<SimilaritySearchResult[]> {
        try {
            let query = `
                SELECT *, 
                ts_rank_cd(to_tsvector('english', name || ' ' || description), plainto_tsquery('english', $1)) as text_rank
                FROM workflow_templates
                WHERE to_tsvector('english', name || ' ' || description) @@ plainto_tsquery('english', $1)
            `;
            
            const params: any[] = [description];

            if (category) {
                query += ` AND category = $${params.length + 1}`;
                params.push(category);
            }

            query += ` ORDER BY text_rank DESC, usage_count DESC, rating DESC LIMIT $${params.length + 1}`;
            params.push(limit);

            const { rows } = await this.db.query(query, params);

            return rows.map(row => ({
                template: {
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    category: row.category,
                    subcategory: row.subcategory,
                    tags: row.tags,
                    difficulty: row.difficulty,
                    n8n_version: row.n8n_version,
                    workflow: row.workflow,
                    metadata: row.metadata,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    usage_count: row.usage_count,
                    rating: row.rating
                },
                similarity_score: parseFloat(row.text_rank) || 0,
                match_reasons: this.generateMatchReasons(description, row)
            }));

        } catch (error) {
            logger.error('Similarity search failed', { error: error.message, description, category });
            return [];
        }
    }

    private generateMatchReasons(query: string, template: any): string[] {
        const reasons: string[] = [];
        const queryLower = query.toLowerCase();
        const nameLower = template.name.toLowerCase();
        const descLower = template.description.toLowerCase();

        if (nameLower.includes(queryLower) || queryLower.includes(nameLower)) {
            reasons.push('Name similarity');
        }

        if (descLower.includes(queryLower)) {
            reasons.push('Description match');
        }

        const queryWords = queryLower.split(' ');
        const matchingTags = template.tags.filter((tag: string) => 
            queryWords.some(word => tag.toLowerCase().includes(word))
        );

        if (matchingTags.length > 0) {
            reasons.push(`Matching tags: ${matchingTags.join(', ')}`);
        }

        if (template.usage_count > 10) {
            reasons.push('Popular template');
        }

        if (template.rating > 4.0) {
            reasons.push('High rated');
        }

        return reasons.length > 0 ? reasons : ['General relevance'];
    }

    async getTemplatesByCategory(category: string, limit: number = 20): Promise<WorkflowTemplate[]> {
        const query = `
            SELECT * FROM workflow_templates 
            WHERE category = $1 
            ORDER BY usage_count DESC, rating DESC 
            LIMIT $2
        `;

        const { rows } = await this.db.query(query, [category, limit]);
        return rows.map(this.mapRowToTemplate);
    }

    async getPopularTemplates(limit: number = 10): Promise<WorkflowTemplate[]> {
        const query = `
            SELECT * FROM workflow_templates 
            ORDER BY usage_count DESC, rating DESC 
            LIMIT $1
        `;

        const { rows } = await this.db.query(query, [limit]);
        return rows.map(this.mapRowToTemplate);
    }

    async getRecentTemplates(limit: number = 10): Promise<WorkflowTemplate[]> {
        const query = `
            SELECT * FROM workflow_templates 
            ORDER BY created_at DESC 
            LIMIT $1
        `;

        const { rows } = await this.db.query(query, [limit]);
        return rows.map(this.mapRowToTemplate);
    }

    async incrementUsageCount(templateId: string): Promise<void> {
        const query = `
            UPDATE workflow_templates 
            SET usage_count = usage_count + 1 
            WHERE id = $1
        `;

        await this.db.query(query, [templateId]);
    }

    async rateTemplate(templateId: string, rating: number): Promise<void> {
        // Simple rating update - in production, you'd want to track individual ratings
        const query = `
            UPDATE workflow_templates 
            SET rating = (rating + $2) / 2 
            WHERE id = $1
        `;

        await this.db.query(query, [templateId, rating]);
    }

    async searchTemplates(
        searchQuery: string,
        filters: {
            category?: string;
            difficulty?: string;
            tags?: string[];
            n8n_version?: string;
        } = {},
        limit: number = 20
    ): Promise<WorkflowTemplate[]> {
        let query = `
            SELECT * FROM workflow_templates
            WHERE to_tsvector('english', name || ' ' || description) @@ plainto_tsquery('english', $1)
        `;
        
        const params: any[] = [searchQuery];
        let paramCount = 1;

        if (filters.category) {
            query += ` AND category = $${++paramCount}`;
            params.push(filters.category);
        }

        if (filters.difficulty) {
            query += ` AND difficulty = $${++paramCount}`;
            params.push(filters.difficulty);
        }

        if (filters.n8n_version) {
            query += ` AND n8n_version = $${++paramCount}`;
            params.push(filters.n8n_version);
        }

        if (filters.tags && filters.tags.length > 0) {
            query += ` AND tags @> $${++paramCount}`;
            params.push(JSON.stringify(filters.tags));
        }

        query += ` ORDER BY ts_rank_cd(to_tsvector('english', name || ' ' || description), plainto_tsquery('english', $1)) DESC LIMIT $${++paramCount}`;
        params.push(limit);

        const { rows } = await this.db.query(query, params);
        return rows.map(this.mapRowToTemplate);
    }

    async getStatistics(): Promise<any> {
        const totalQuery = 'SELECT COUNT(*) as total FROM workflow_templates';
        const categoryQuery = `
            SELECT category, COUNT(*) as count 
            FROM workflow_templates 
            GROUP BY category 
            ORDER BY count DESC
        `;
        const difficultyQuery = `
            SELECT difficulty, COUNT(*) as count 
            FROM workflow_templates 
            GROUP BY difficulty 
            ORDER BY count DESC
        `;

        const [totalResult, categoryResult, difficultyResult] = await Promise.all([
            this.db.query(totalQuery),
            this.db.query(categoryQuery),
            this.db.query(difficultyQuery)
        ]);

        return {
            total_templates: parseInt(totalResult.rows[0].total),
            by_category: categoryResult.rows,
            by_difficulty: difficultyResult.rows,
            last_updated: new Date().toISOString()
        };
    }

    private mapRowToTemplate(row: any): WorkflowTemplate {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            category: row.category,
            subcategory: row.subcategory,
            tags: row.tags,
            difficulty: row.difficulty,
            n8n_version: row.n8n_version,
            workflow: row.workflow,
            metadata: row.metadata,
            created_at: row.created_at,
            updated_at: row.updated_at,
            usage_count: row.usage_count,
            rating: row.rating
        };
    }
}