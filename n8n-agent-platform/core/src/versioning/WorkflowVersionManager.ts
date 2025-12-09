import { EventEmitter } from 'events';
import { DatabaseManager } from '../database/DatabaseManager';
import { RedisManager } from '../database/RedisManager';
import { AuthManager } from '../auth/AuthManager';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import * as diff from 'diff';
import semver from 'semver';

export interface WorkflowVersion {
    id: string;
    workflowId: string;
    version: string;
    name: string;
    description?: string;
    definition: any;
    changes: VersionChange[];
    author: {
        id: string;
        name: string;
    };
    tags: string[];
    status: 'draft' | 'published' | 'archived';
    metadata: {
        nodeCount: number;
        connectionCount: number;
        complexity: number;
        estimatedRunTime: number;
    };
    createdAt: Date;
    publishedAt?: Date;
}

export interface VersionChange {
    type: 'node_added' | 'node_removed' | 'node_modified' | 'connection_added' | 'connection_removed' | 'settings_changed';
    nodeId?: string;
    nodeName?: string;
    details: any;
}

export interface VersionComparison {
    fromVersion: string;
    toVersion: string;
    changes: VersionChange[];
    diff: string;
    breaking: boolean;
    compatibility: {
        backwardCompatible: boolean;
        forwardCompatible: boolean;
        migrationRequired: boolean;
    };
}

export interface RollbackOptions {
    preserveData?: boolean;
    createBackup?: boolean;
    notifyUsers?: boolean;
    reason?: string;
}

export interface BranchInfo {
    id: string;
    workflowId: string;
    name: string;
    description?: string;
    baseVersion: string;
    status: 'active' | 'merged' | 'abandoned';
    author: string;
    createdAt: Date;
    mergedAt?: Date;
}

export class WorkflowVersionManager extends EventEmitter {
    private versionCache: Map<string, WorkflowVersion[]> = new Map();
    private diffCache: Map<string, VersionComparison> = new Map();

    constructor(
        private database: DatabaseManager,
        private redis: RedisManager,
        private authManager: AuthManager
    ) {
        super();
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Workflow Version Manager...');
        await this.createVersioningSchema();
        await this.loadRecentVersions();
    }

    private async createVersioningSchema(): Promise<void> {
        const schemaExists = await this.database.query(
            "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'workflow_versions')"
        );

        if (!schemaExists.rows[0].exists) {
            await this.database.query(`
                CREATE TABLE workflow_versions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    version VARCHAR(50) NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    definition JSONB NOT NULL,
                    changes JSONB DEFAULT '[]',
                    author_id UUID NOT NULL REFERENCES users(id),
                    tags TEXT[] DEFAULT '{}',
                    status VARCHAR(20) DEFAULT 'draft',
                    metadata JSONB DEFAULT '{}',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    published_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT unique_workflow_version UNIQUE (workflow_id, version),
                    CONSTRAINT valid_version CHECK (version ~ '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9]+)?$'),
                    CONSTRAINT valid_status CHECK (status IN ('draft', 'published', 'archived'))
                );

                CREATE INDEX idx_workflow_versions_workflow ON workflow_versions(workflow_id);
                CREATE INDEX idx_workflow_versions_status ON workflow_versions(status);
                CREATE INDEX idx_workflow_versions_created ON workflow_versions(created_at DESC);
                CREATE INDEX idx_workflow_versions_author ON workflow_versions(author_id);

                CREATE TABLE workflow_branches (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    base_version VARCHAR(50) NOT NULL,
                    status VARCHAR(20) DEFAULT 'active',
                    author_id UUID NOT NULL REFERENCES users(id),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    merged_at TIMESTAMP WITH TIME ZONE,
                    merged_by UUID REFERENCES users(id),
                    CONSTRAINT unique_branch_name UNIQUE (workflow_id, name),
                    CONSTRAINT valid_branch_status CHECK (status IN ('active', 'merged', 'abandoned'))
                );

                CREATE TABLE version_rollbacks (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    from_version VARCHAR(50) NOT NULL,
                    to_version VARCHAR(50) NOT NULL,
                    reason TEXT,
                    backup_data JSONB,
                    rolled_back_by UUID NOT NULL REFERENCES users(id),
                    rolled_back_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE version_deployment_history (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
                    version VARCHAR(50) NOT NULL,
                    environment VARCHAR(50) NOT NULL,
                    deployed_by UUID NOT NULL REFERENCES users(id),
                    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    deployment_status VARCHAR(20) DEFAULT 'pending',
                    deployment_logs JSONB DEFAULT '[]',
                    CONSTRAINT valid_environment CHECK (environment IN ('development', 'staging', 'production')),
                    CONSTRAINT valid_deployment_status CHECK (deployment_status IN ('pending', 'in_progress', 'success', 'failed', 'rolled_back'))
                );
            `);
        }
    }

    // Create new version
    async createVersion(
        workflowId: string,
        definition: any,
        options: {
            name: string;
            description?: string;
            authorId: string;
            tags?: string[];
            publish?: boolean;
            versionType?: 'major' | 'minor' | 'patch';
            prerelease?: string;
        }
    ): Promise<WorkflowVersion> {
        // Get current version
        const currentVersion = await this.getCurrentVersion(workflowId);
        
        // Calculate new version
        let newVersion: string;
        if (currentVersion) {
            const type = options.versionType || 'patch';
            newVersion = semver.inc(currentVersion.version, type, options.prerelease) || '1.0.0';
        } else {
            newVersion = '1.0.0';
        }

        // Detect changes
        const changes = currentVersion 
            ? await this.detectChanges(currentVersion.definition, definition)
            : [];

        // Calculate metadata
        const metadata = this.calculateMetadata(definition);

        // Store version
        const result = await this.database.query(
            `INSERT INTO workflow_versions 
             (workflow_id, version, name, description, definition, changes, 
              author_id, tags, status, metadata, published_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                workflowId,
                newVersion,
                options.name,
                options.description,
                JSON.stringify(definition),
                JSON.stringify(changes),
                options.authorId,
                options.tags || [],
                options.publish ? 'published' : 'draft',
                JSON.stringify(metadata),
                options.publish ? new Date() : null
            ]
        );

        const version = this.mapVersion(result.rows[0]);

        // Update workflow current version if published
        if (options.publish) {
            await this.database.query(
                'UPDATE workflows SET current_version = $1, definition = $2 WHERE id = $3',
                [newVersion, JSON.stringify(definition), workflowId]
            );
        }

        // Clear cache
        this.versionCache.delete(workflowId);

        // Emit event
        this.emit('version:created', {
            workflowId,
            version: newVersion,
            authorId: options.authorId
        });

        return version;
    }

    // Get workflow versions
    async getVersions(
        workflowId: string,
        options?: {
            status?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<WorkflowVersion[]> {
        // Check cache
        if (!options && this.versionCache.has(workflowId)) {
            return this.versionCache.get(workflowId)!;
        }

        let query = `
            SELECT v.*, u.username as author_name
            FROM workflow_versions v
            JOIN users u ON v.author_id = u.id
            WHERE v.workflow_id = $1
        `;
        const params: any[] = [workflowId];

        if (options?.status) {
            query += ' AND v.status = $2';
            params.push(options.status);
        }

        query += ' ORDER BY v.created_at DESC';

        if (options?.limit) {
            query += ` LIMIT ${options.limit}`;
            if (options.offset) {
                query += ` OFFSET ${options.offset}`;
            }
        }

        const result = await this.database.query(query, params);
        const versions = result.rows.map((row: any) => this.mapVersion(row));

        // Cache if no filters
        if (!options) {
            this.versionCache.set(workflowId, versions);
        }

        return versions;
    }

    // Get specific version
    async getVersion(workflowId: string, version: string): Promise<WorkflowVersion | null> {
        const result = await this.database.query(
            `SELECT v.*, u.username as author_name
             FROM workflow_versions v
             JOIN users u ON v.author_id = u.id
             WHERE v.workflow_id = $1 AND v.version = $2`,
            [workflowId, version]
        );

        return result.rows.length > 0 ? this.mapVersion(result.rows[0]) : null;
    }

    // Compare versions
    async compareVersions(
        workflowId: string,
        fromVersion: string,
        toVersion: string
    ): Promise<VersionComparison> {
        const cacheKey = `${workflowId}:${fromVersion}:${toVersion}`;
        
        // Check cache
        if (this.diffCache.has(cacheKey)) {
            return this.diffCache.get(cacheKey)!;
        }

        const from = await this.getVersion(workflowId, fromVersion);
        const to = await this.getVersion(workflowId, toVersion);

        if (!from || !to) {
            throw new Error('Version not found');
        }

        const changes = await this.detectChanges(from.definition, to.definition);
        const diffText = this.createDiff(from.definition, to.definition);
        const breaking = this.isBreakingChange(changes);
        const compatibility = await this.checkCompatibility(from.definition, to.definition);

        const comparison: VersionComparison = {
            fromVersion,
            toVersion,
            changes,
            diff: diffText,
            breaking,
            compatibility
        };

        // Cache result
        this.diffCache.set(cacheKey, comparison);

        return comparison;
    }

    // Rollback to version
    async rollbackToVersion(
        workflowId: string,
        targetVersion: string,
        userId: string,
        options: RollbackOptions = {}
    ): Promise<void> {
        const current = await this.getCurrentVersion(workflowId);
        if (!current) {
            throw new Error('No current version found');
        }

        const target = await this.getVersion(workflowId, targetVersion);
        if (!target) {
            throw new Error('Target version not found');
        }

        // Create backup if requested
        let backupData = null;
        if (options.createBackup) {
            backupData = {
                version: current.version,
                definition: current.definition,
                metadata: current.metadata
            };
        }

        // Record rollback
        await this.database.query(
            `INSERT INTO version_rollbacks 
             (workflow_id, from_version, to_version, reason, backup_data, rolled_back_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                workflowId,
                current.version,
                targetVersion,
                options.reason,
                backupData ? JSON.stringify(backupData) : null,
                userId
            ]
        );

        // Update workflow
        await this.database.query(
            'UPDATE workflows SET current_version = $1, definition = $2 WHERE id = $3',
            [targetVersion, JSON.stringify(target.definition), workflowId]
        );

        // Clear cache
        this.versionCache.delete(workflowId);

        // Emit event
        this.emit('version:rollback', {
            workflowId,
            fromVersion: current.version,
            toVersion: targetVersion,
            userId,
            reason: options.reason
        });

        // Notify users if requested
        if (options.notifyUsers) {
            await this.notifyUsersOfRollback(workflowId, current.version, targetVersion);
        }
    }

    // Branch management
    async createBranch(
        workflowId: string,
        branchName: string,
        authorId: string,
        description?: string
    ): Promise<BranchInfo> {
        const current = await this.getCurrentVersion(workflowId);
        if (!current) {
            throw new Error('No current version to branch from');
        }

        const result = await this.database.query(
            `INSERT INTO workflow_branches 
             (workflow_id, name, description, base_version, author_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [workflowId, branchName, description, current.version, authorId]
        );

        return this.mapBranch(result.rows[0]);
    }

    async mergeBranch(
        workflowId: string,
        branchName: string,
        mergedBy: string,
        options?: {
            conflictResolution?: 'theirs' | 'ours' | 'manual';
            createMergeCommit?: boolean;
        }
    ): Promise<WorkflowVersion> {
        const branch = await this.database.query(
            'SELECT * FROM workflow_branches WHERE workflow_id = $1 AND name = $2 AND status = $3',
            [workflowId, branchName, 'active']
        );

        if (branch.rows.length === 0) {
            throw new Error('Branch not found or not active');
        }

        // Get branch versions
        const branchVersions = await this.database.query(
            `SELECT * FROM workflow_versions 
             WHERE workflow_id = $1 AND created_at > (
                SELECT created_at FROM workflow_branches WHERE id = $2
             )
             ORDER BY created_at`,
            [workflowId, branch.rows[0].id]
        );

        // Create merge version
        const mergeVersion = await this.createVersion(workflowId, branchVersions.rows[0].definition, {
            name: `Merge branch '${branchName}'`,
            description: `Merged ${branchVersions.rows.length} changes from branch ${branchName}`,
            authorId: mergedBy,
            tags: ['merge'],
            publish: true
        });

        // Update branch status
        await this.database.query(
            'UPDATE workflow_branches SET status = $1, merged_at = $2, merged_by = $3 WHERE id = $4',
            ['merged', new Date(), mergedBy, branch.rows[0].id]
        );

        this.emit('branch:merged', {
            workflowId,
            branchName,
            mergeVersion: mergeVersion.version,
            mergedBy
        });

        return mergeVersion;
    }

    // Environment deployment
    async deployVersion(
        workflowId: string,
        version: string,
        environment: 'development' | 'staging' | 'production',
        deployedBy: string
    ): Promise<string> {
        const deploymentId = crypto.randomUUID();

        await this.database.query(
            `INSERT INTO version_deployment_history 
             (id, workflow_id, version, environment, deployed_by, deployment_status)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [deploymentId, workflowId, version, environment, deployedBy, 'in_progress']
        );

        // Simulate deployment process
        setTimeout(async () => {
            try {
                // Deploy to environment
                await this.performDeployment(workflowId, version, environment);

                await this.database.query(
                    `UPDATE version_deployment_history 
                     SET deployment_status = $1, deployment_logs = $2 
                     WHERE id = $3`,
                    [
                        'success',
                        JSON.stringify([{
                            timestamp: new Date(),
                            message: `Successfully deployed version ${version} to ${environment}`
                        }]),
                        deploymentId
                    ]
                );

                this.emit('version:deployed', {
                    workflowId,
                    version,
                    environment,
                    deploymentId
                });
            } catch (error: any) {
                await this.database.query(
                    `UPDATE version_deployment_history 
                     SET deployment_status = $1, deployment_logs = $2 
                     WHERE id = $3`,
                    [
                        'failed',
                        JSON.stringify([{
                            timestamp: new Date(),
                            message: `Deployment failed: ${error.message}`
                        }]),
                        deploymentId
                    ]
                );
            }
        }, 5000);

        return deploymentId;
    }

    // Helper methods
    private async detectChanges(oldDef: any, newDef: any): Promise<VersionChange[]> {
        const changes: VersionChange[] = [];

        // Compare nodes
        const oldNodes = new Map(oldDef.nodes?.map((n: any) => [n.id, n]) || []);
        const newNodes = new Map(newDef.nodes?.map((n: any) => [n.id, n]) || []);

        // Find added nodes
        for (const [id, node] of newNodes) {
            if (!oldNodes.has(id)) {
                changes.push({
                    type: 'node_added',
                    nodeId: id as string,
                    nodeName: (node as any).name,
                    details: { node }
                });
            }
        }

        // Find removed nodes
        for (const [id, node] of oldNodes) {
            if (!newNodes.has(id)) {
                changes.push({
                    type: 'node_removed',
                    nodeId: id as string,
                    nodeName: (node as any).name,
                    details: { node }
                });
            }
        }

        // Find modified nodes
        for (const [id, newNode] of newNodes) {
            if (oldNodes.has(id)) {
                const oldNode = oldNodes.get(id);
                if (JSON.stringify(oldNode) !== JSON.stringify(newNode)) {
                    changes.push({
                        type: 'node_modified',
                        nodeId: id as string,
                        nodeName: (newNode as any).name,
                        details: {
                            old: oldNode,
                            new: newNode
                        }
                    });
                }
            }
        }

        // Compare connections
        const oldConnections = new Set(oldDef.connections?.map((c: any) => JSON.stringify(c)) || []);
        const newConnections = new Set(newDef.connections?.map((c: any) => JSON.stringify(c)) || []);

        for (const conn of newConnections) {
            if (!oldConnections.has(conn)) {
                changes.push({
                    type: 'connection_added',
                    details: { connection: JSON.parse(conn as string) }
                });
            }
        }

        for (const conn of oldConnections) {
            if (!newConnections.has(conn)) {
                changes.push({
                    type: 'connection_removed',
                    details: { connection: JSON.parse(conn as string) }
                });
            }
        }

        // Compare settings
        if (JSON.stringify(oldDef.settings) !== JSON.stringify(newDef.settings)) {
            changes.push({
                type: 'settings_changed',
                details: {
                    old: oldDef.settings,
                    new: newDef.settings
                }
            });
        }

        return changes;
    }

    private createDiff(oldDef: any, newDef: any): string {
        const oldStr = JSON.stringify(oldDef, null, 2);
        const newStr = JSON.stringify(newDef, null, 2);
        return diff.createPatch('workflow.json', oldStr, newStr);
    }

    private isBreakingChange(changes: VersionChange[]): boolean {
        return changes.some(change => 
            change.type === 'node_removed' || 
            (change.type === 'node_modified' && this.isBreakingNodeChange(change.details))
        );
    }

    private isBreakingNodeChange(details: any): boolean {
        // Check if inputs/outputs changed
        const oldInputs = details.old.inputs || [];
        const newInputs = details.new.inputs || [];
        
        return oldInputs.length !== newInputs.length ||
               !oldInputs.every((input: any, i: number) => 
                   input.type === newInputs[i]?.type
               );
    }

    private async checkCompatibility(oldDef: any, newDef: any): Promise<any> {
        const changes = await this.detectChanges(oldDef, newDef);
        const breaking = this.isBreakingChange(changes);

        return {
            backwardCompatible: !breaking,
            forwardCompatible: !changes.some((c: any) => c.type === 'node_added'),
            migrationRequired: breaking
        };
    }

    private calculateMetadata(definition: any): any {
        const nodes = definition.nodes || [];
        const connections = definition.connections || [];

        return {
            nodeCount: nodes.length,
            connectionCount: connections.length,
            complexity: this.calculateComplexity(nodes, connections),
            estimatedRunTime: this.estimateRunTime(nodes)
        };
    }

    private calculateComplexity(nodes: any[], connections: any[]): number {
        // Simple complexity calculation based on nodes and connections
        const nodeComplexity = nodes.reduce((sum, node) => {
            const typeComplexity = {
                'n8n-nodes-base.webhook': 1,
                'n8n-nodes-base.httpRequest': 2,
                'n8n-nodes-base.function': 3,
                'n8n-nodes-base.code': 4
            };
            return sum + (typeComplexity[node.type as keyof typeof typeComplexity] || 1);
        }, 0);

        const connectionComplexity = connections.length * 0.5;
        
        return Math.round(nodeComplexity + connectionComplexity);
    }

    private estimateRunTime(nodes: any[]): number {
        // Estimate run time based on node types
        return nodes.reduce((sum, node) => {
            const nodeTime = {
                'n8n-nodes-base.webhook': 10,
                'n8n-nodes-base.httpRequest': 500,
                'n8n-nodes-base.function': 50,
                'n8n-nodes-base.code': 100,
                'n8n-nodes-base.wait': 1000
            };
            return sum + (nodeTime[node.type as keyof typeof nodeTime] || 50);
        }, 0);
    }

    private async getCurrentVersion(workflowId: string): Promise<WorkflowVersion | null> {
        const result = await this.database.query(
            `SELECT v.*, u.username as author_name
             FROM workflow_versions v
             JOIN users u ON v.author_id = u.id
             WHERE v.workflow_id = $1 AND v.status = 'published'
             ORDER BY v.created_at DESC
             LIMIT 1`,
            [workflowId]
        );

        return result.rows.length > 0 ? this.mapVersion(result.rows[0]) : null;
    }

    private async performDeployment(
        workflowId: string,
        version: string,
        environment: string
    ): Promise<void> {
        // Simulate deployment to different environments
        logger.info(`Deploying workflow ${workflowId} version ${version} to ${environment}`);
        
        // In a real implementation, this would:
        // 1. Deploy to the appropriate n8n instance
        // 2. Update environment-specific configurations
        // 3. Run smoke tests
        // 4. Update monitoring
    }

    private async notifyUsersOfRollback(
        workflowId: string,
        fromVersion: string,
        toVersion: string
    ): Promise<void> {
        // Get workflow collaborators
        const collaborators = await this.database.query(
            `SELECT DISTINCT u.email, u.username
             FROM workflow_permissions wp
             JOIN users u ON wp.user_id = u.id
             WHERE wp.workflow_id = $1`,
            [workflowId]
        );

        // Send notifications (in real implementation)
        for (const user of collaborators.rows) {
            logger.info(`Notifying ${user.username} of rollback from ${fromVersion} to ${toVersion}`);
        }
    }

    private async loadRecentVersions(): Promise<void> {
        // Load recent versions into cache
        const recentVersions = await this.database.query(
            `SELECT DISTINCT ON (workflow_id) workflow_id
             FROM workflow_versions
             WHERE created_at > NOW() - INTERVAL '7 days'`
        );

        for (const row of recentVersions.rows) {
            const versions = await this.getVersions(row.workflow_id);
            this.versionCache.set(row.workflow_id, versions);
        }
    }

    private mapVersion(row: any): WorkflowVersion {
        return {
            id: row.id,
            workflowId: row.workflow_id,
            version: row.version,
            name: row.name,
            description: row.description,
            definition: row.definition,
            changes: row.changes || [],
            author: {
                id: row.author_id,
                name: row.author_name
            },
            tags: row.tags || [],
            status: row.status,
            metadata: row.metadata || {},
            createdAt: row.created_at,
            publishedAt: row.published_at
        };
    }

    private mapBranch(row: any): BranchInfo {
        return {
            id: row.id,
            workflowId: row.workflow_id,
            name: row.name,
            description: row.description,
            baseVersion: row.base_version,
            status: row.status,
            author: row.author_id,
            createdAt: row.created_at,
            mergedAt: row.merged_at
        };
    }
}