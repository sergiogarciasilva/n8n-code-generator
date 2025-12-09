import { Router, Request, Response } from 'express';
import { WorkflowVersionManager } from '../versioning/WorkflowVersionManager';
import { SecurityMiddleware, AuthenticatedRequest } from '../middleware/SecurityMiddleware';
import { AuthManager } from '../auth/AuthManager';
import { PermissionManager } from '../auth/PermissionManager';
import { DatabaseManager } from '../database/DatabaseManager';
import Joi from 'joi';

export class VersioningRouter {
    private router: Router;
    private security: SecurityMiddleware;

    constructor(
        private versionManager: WorkflowVersionManager,
        private authManager: AuthManager,
        private permissionManager: PermissionManager,
        private database: DatabaseManager
    ) {
        this.router = Router();
        this.security = new SecurityMiddleware(authManager, permissionManager, database);
        this.setupRoutes();
    }

    getRouter(): Router {
        return this.router;
    }

    private setupRoutes(): void {
        // All routes require authentication
        this.router.use(this.security.authenticate());

        // Version management routes
        this.setupVersionRoutes();
        
        // Branch management routes
        this.setupBranchRoutes();
        
        // Deployment routes
        this.setupDeploymentRoutes();
        
        // Comparison and diff routes
        this.setupComparisonRoutes();
    }

    private setupVersionRoutes(): void {
        // Get workflow versions
        this.router.get('/workflows/:workflowId/versions',
            this.security.requirePermission('workflows', 'read'),
            this.security.validateInput(Joi.object({
                status: Joi.string().valid('draft', 'published', 'archived').optional(),
                limit: Joi.number().min(1).max(100).default(20),
                offset: Joi.number().min(0).default(0)
            }).unknown(false)),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const versions = await this.versionManager.getVersions(
                        req.params.workflowId,
                        {
                            status: req.query.status as string,
                            limit: Number(req.query.limit),
                            offset: Number(req.query.offset)
                        }
                    );
                    res.json({ versions });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get specific version
        this.router.get('/workflows/:workflowId/versions/:version',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const version = await this.versionManager.getVersion(
                        req.params.workflowId,
                        req.params.version
                    );
                    
                    if (!version) {
                        return res.status(404).json({ error: 'Version not found' });
                    }
                    
                    res.json({ version });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Create new version
        this.router.post('/workflows/:workflowId/versions',
            this.security.requirePermission('workflows', 'update'),
            this.security.validateInput(Joi.object({
                name: Joi.string().required(),
                description: Joi.string().optional(),
                definition: Joi.object().required(),
                tags: Joi.array().items(Joi.string()).optional(),
                publish: Joi.boolean().default(false),
                versionType: Joi.string().valid('major', 'minor', 'patch').default('patch'),
                prerelease: Joi.string().optional()
            })),
            this.security.auditLog('create_version'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const version = await this.versionManager.createVersion(
                        req.params.workflowId,
                        req.body.definition,
                        {
                            name: req.body.name,
                            description: req.body.description,
                            authorId: req.user!.userId,
                            tags: req.body.tags,
                            publish: req.body.publish,
                            versionType: req.body.versionType,
                            prerelease: req.body.prerelease
                        }
                    );
                    res.status(201).json({ version });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Publish draft version
        this.router.put('/workflows/:workflowId/versions/:version/publish',
            this.security.requirePermission('workflows', 'publish'),
            this.security.auditLog('publish_version'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.database.query(
                        `UPDATE workflow_versions 
                         SET status = 'published', published_at = NOW() 
                         WHERE workflow_id = $1 AND version = $2 AND status = 'draft'`,
                        [req.params.workflowId, req.params.version]
                    );
                    
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Rollback to version
        this.router.post('/workflows/:workflowId/rollback',
            this.security.requirePermission('workflows', 'rollback'),
            this.security.validateInput(Joi.object({
                targetVersion: Joi.string().required(),
                reason: Joi.string().optional(),
                createBackup: Joi.boolean().default(true),
                notifyUsers: Joi.boolean().default(true)
            })),
            this.security.auditLog('rollback_version'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.versionManager.rollbackToVersion(
                        req.params.workflowId,
                        req.body.targetVersion,
                        req.user!.userId,
                        {
                            reason: req.body.reason,
                            createBackup: req.body.createBackup,
                            notifyUsers: req.body.notifyUsers
                        }
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Get rollback history
        this.router.get('/workflows/:workflowId/rollbacks',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const rollbacks = await this.database.query(
                        `SELECT r.*, u.username as rolled_back_by_name
                         FROM version_rollbacks r
                         JOIN users u ON r.rolled_back_by = u.id
                         WHERE r.workflow_id = $1
                         ORDER BY r.rolled_back_at DESC`,
                        [req.params.workflowId]
                    );
                    res.json({ rollbacks: rollbacks.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupBranchRoutes(): void {
        // Create branch
        this.router.post('/workflows/:workflowId/branches',
            this.security.requirePermission('workflows', 'branch'),
            this.security.validateInput(Joi.object({
                name: Joi.string().pattern(/^[a-zA-Z0-9-_]+$/).required(),
                description: Joi.string().optional()
            })),
            this.security.auditLog('create_branch'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const branch = await this.versionManager.createBranch(
                        req.params.workflowId,
                        req.body.name,
                        req.user!.userId,
                        req.body.description
                    );
                    res.status(201).json({ branch });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Get branches
        this.router.get('/workflows/:workflowId/branches',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const branches = await this.database.query(
                        `SELECT b.*, u.username as author_name
                         FROM workflow_branches b
                         JOIN users u ON b.author_id = u.id
                         WHERE b.workflow_id = $1
                         ORDER BY b.created_at DESC`,
                        [req.params.workflowId]
                    );
                    res.json({ branches: branches.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Merge branch
        this.router.post('/workflows/:workflowId/branches/:branchName/merge',
            this.security.requirePermission('workflows', 'merge'),
            this.security.validateInput(Joi.object({
                conflictResolution: Joi.string().valid('theirs', 'ours', 'manual').default('manual'),
                createMergeCommit: Joi.boolean().default(true)
            })),
            this.security.auditLog('merge_branch'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const mergeVersion = await this.versionManager.mergeBranch(
                        req.params.workflowId,
                        req.params.branchName,
                        req.user!.userId,
                        {
                            conflictResolution: req.body.conflictResolution,
                            createMergeCommit: req.body.createMergeCommit
                        }
                    );
                    res.json({ mergeVersion });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Abandon branch
        this.router.delete('/workflows/:workflowId/branches/:branchName',
            this.security.requirePermission('workflows', 'branch'),
            this.security.auditLog('abandon_branch'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.database.query(
                        `UPDATE workflow_branches 
                         SET status = 'abandoned' 
                         WHERE workflow_id = $1 AND name = $2 AND status = 'active'`,
                        [req.params.workflowId, req.params.branchName]
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupDeploymentRoutes(): void {
        // Deploy version
        this.router.post('/workflows/:workflowId/deploy',
            this.security.requirePermission('workflows', 'deploy'),
            this.security.validateInput(Joi.object({
                version: Joi.string().required(),
                environment: Joi.string().valid('development', 'staging', 'production').required()
            })),
            this.security.auditLog('deploy_version'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const deploymentId = await this.versionManager.deployVersion(
                        req.params.workflowId,
                        req.body.version,
                        req.body.environment,
                        req.user!.userId
                    );
                    res.json({ deploymentId });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Get deployment history
        this.router.get('/workflows/:workflowId/deployments',
            this.security.requirePermission('workflows', 'read'),
            this.security.validateInput(Joi.object({
                environment: Joi.string().valid('development', 'staging', 'production').optional(),
                status: Joi.string().valid('pending', 'in_progress', 'success', 'failed', 'rolled_back').optional()
            }).unknown(false)),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    let query = `
                        SELECT d.*, u.username as deployed_by_name
                        FROM version_deployment_history d
                        JOIN users u ON d.deployed_by = u.id
                        WHERE d.workflow_id = $1
                    `;
                    const params: any[] = [req.params.workflowId];
                    let paramCount = 1;

                    if (req.query.environment) {
                        paramCount++;
                        query += ` AND d.environment = $${paramCount}`;
                        params.push(req.query.environment);
                    }

                    if (req.query.status) {
                        paramCount++;
                        query += ` AND d.deployment_status = $${paramCount}`;
                        params.push(req.query.status);
                    }

                    query += ' ORDER BY d.deployed_at DESC';

                    const deployments = await this.database.query(query, params);
                    res.json({ deployments: deployments.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get deployment status
        this.router.get('/deployments/:deploymentId',
            this.security.requirePermission('workflows', 'read'),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const deployment = await this.database.query(
                        'SELECT * FROM version_deployment_history WHERE id = $1',
                        [req.params.deploymentId]
                    );
                    
                    if (deployment.rows.length === 0) {
                        return res.status(404).json({ error: 'Deployment not found' });
                    }
                    
                    res.json({ deployment: deployment.rows[0] });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupComparisonRoutes(): void {
        // Compare versions
        this.router.get('/workflows/:workflowId/compare',
            this.security.requirePermission('workflows', 'read'),
            this.security.validateInput(Joi.object({
                from: Joi.string().required(),
                to: Joi.string().required()
            }).unknown(false)),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const comparison = await this.versionManager.compareVersions(
                        req.params.workflowId,
                        req.query.from as string,
                        req.query.to as string
                    );
                    res.json({ comparison });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Get version diff
        this.router.get('/workflows/:workflowId/versions/:version/diff',
            this.security.requirePermission('workflows', 'read'),
            this.security.validateInput(Joi.object({
                compareWith: Joi.string().optional()
            }).unknown(false)),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    // If compareWith not specified, compare with previous version
                    let compareWith = req.query.compareWith as string;
                    
                    if (!compareWith) {
                        const versions = await this.versionManager.getVersions(req.params.workflowId);
                        const currentIndex = versions.findIndex(v => v.version === req.params.version);
                        
                        if (currentIndex > 0) {
                            compareWith = versions[currentIndex + 1].version;
                        } else {
                            return res.json({ diff: null, message: 'No previous version to compare' });
                        }
                    }

                    const comparison = await this.versionManager.compareVersions(
                        req.params.workflowId,
                        compareWith,
                        req.params.version
                    );
                    
                    res.json({ diff: comparison });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Check version compatibility
        this.router.post('/workflows/:workflowId/check-compatibility',
            this.security.requirePermission('workflows', 'read'),
            this.security.validateInput(Joi.object({
                fromVersion: Joi.string().required(),
                toVersion: Joi.string().required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const comparison = await this.versionManager.compareVersions(
                        req.params.workflowId,
                        req.body.fromVersion,
                        req.body.toVersion
                    );
                    
                    res.json({
                        compatible: comparison.compatibility.backwardCompatible,
                        compatibility: comparison.compatibility,
                        breaking: comparison.breaking,
                        changeCount: comparison.changes.length
                    });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );
    }
}