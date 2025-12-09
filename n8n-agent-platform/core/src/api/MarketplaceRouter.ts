import { Router, Request, Response } from 'express';
import { MarketplaceManager } from '../marketplace/MarketplaceManager';
import { SecurityMiddleware, AuthenticatedRequest } from '../middleware/SecurityMiddleware';
import { AuthManager } from '../auth/AuthManager';
import { PermissionManager } from '../auth/PermissionManager';
import { DatabaseManager } from '../database/DatabaseManager';
import Joi from 'joi';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'marketplace');
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `${uuidv4()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

export class MarketplaceRouter {
    private router: Router;
    private security: SecurityMiddleware;

    constructor(
        private marketplaceManager: MarketplaceManager,
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
        // Public routes (no auth required)
        this.setupPublicRoutes();

        // Protected routes (auth required)
        this.router.use(this.security.authenticate());
        this.setupTemplateRoutes();
        this.setupConnectorRoutes();
        this.setupReviewRoutes();
        this.setupAuthorRoutes();
        this.setupAdminRoutes();
    }

    private setupPublicRoutes(): void {
        // Search templates
        this.router.get('/templates/search',
            this.security.validateInput(Joi.object({
                query: Joi.string().optional(),
                category: Joi.string().optional(),
                tags: Joi.array().items(Joi.string()).optional(),
                author: Joi.string().optional(),
                minPrice: Joi.number().min(0).optional(),
                maxPrice: Joi.number().min(0).optional(),
                minRating: Joi.number().min(0).max(5).optional(),
                sortBy: Joi.string().valid('popular', 'recent', 'rating', 'name').optional(),
                certified: Joi.boolean().optional(),
                page: Joi.number().min(1).default(1),
                limit: Joi.number().min(1).max(100).default(20)
            }).unknown(false)),
            async (req: Request, res: Response) => {
                try {
                    const result = await this.marketplaceManager.searchTemplates({
                        query: req.query.query as string,
                        category: req.query.category as string,
                        tags: req.query.tags as string[],
                        author: req.query.author as string,
                        priceRange: req.query.minPrice || req.query.maxPrice ? {
                            min: Number(req.query.minPrice) || 0,
                            max: Number(req.query.maxPrice) || Number.MAX_VALUE
                        } : undefined,
                        minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
                        sortBy: req.query.sortBy as any,
                        certified: req.query.certified === 'true',
                        page: Number(req.query.page) || 1,
                        limit: Number(req.query.limit) || 20
                    });
                    res.json(result);
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get template details
        this.router.get('/templates/:templateId',
            async (req: Request, res: Response) => {
                try {
                    const template = await this.database.query(
                        `SELECT t.*, 
                                u.username as author_name,
                                u.verified as author_verified,
                                ma.display_name as author_display_name,
                                ma.bio as author_bio,
                                ma.average_rating as author_rating
                         FROM marketplace_templates t
                         JOIN users u ON t.author_id = u.id
                         LEFT JOIN marketplace_authors ma ON u.id = ma.user_id
                         WHERE t.id = $1`,
                        [req.params.templateId]
                    );

                    if (template.rows.length === 0) {
                        return res.status(404).json({ error: 'Template not found' });
                    }

                    res.json({ template: template.rows[0] });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get featured templates
        this.router.get('/templates/featured',
            async (req: Request, res: Response) => {
                try {
                    const templates = await this.database.query(
                        `SELECT t.*, u.username as author_name
                         FROM marketplace_templates t
                         JOIN users u ON t.author_id = u.id
                         WHERE t.featured = true
                         ORDER BY t.downloads DESC
                         LIMIT 10`
                    );
                    res.json({ templates: templates.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get categories
        this.router.get('/categories',
            async (req: Request, res: Response) => {
                try {
                    const categories = await this.database.query(
                        'SELECT * FROM template_categories ORDER BY sort_order'
                    );
                    res.json({ categories: categories.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get featured collections
        this.router.get('/collections',
            async (req: Request, res: Response) => {
                try {
                    const collections = await this.database.query(
                        `SELECT * FROM featured_collections 
                         WHERE active = true 
                         AND (start_date IS NULL OR start_date <= NOW())
                         AND (end_date IS NULL OR end_date >= NOW())
                         ORDER BY created_at DESC`
                    );
                    res.json({ collections: collections.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupTemplateRoutes(): void {
        // Publish template
        this.router.post('/templates',
            this.security.requirePermission('marketplace', 'create'),
            upload.array('screenshots', 5),
            this.security.validateInput(Joi.object({
                name: Joi.string().min(3).max(255).required(),
                description: Joi.string().min(10).required(),
                category: Joi.string().required(),
                tags: Joi.array().items(Joi.string()).min(1).max(10).required(),
                version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
                compatibility: Joi.object({
                    minVersion: Joi.string().required(),
                    maxVersion: Joi.string().optional(),
                    requiredConnectors: Joi.array().items(Joi.string()).optional()
                }).required(),
                workflow: Joi.object().required(),
                documentation: Joi.object({
                    readme: Joi.string().required(),
                    changelog: Joi.string().optional(),
                    examples: Joi.array().items(Joi.object({
                        title: Joi.string().required(),
                        description: Joi.string().required(),
                        input: Joi.any().required(),
                        expectedOutput: Joi.any().required()
                    })).optional()
                }).required(),
                pricing: Joi.object({
                    model: Joi.string().valid('free', 'paid', 'freemium', 'subscription').required(),
                    price: Joi.number().min(0).when('model', {
                        is: 'paid',
                        then: Joi.required()
                    }),
                    currency: Joi.string().length(3).when('model', {
                        is: 'paid',
                        then: Joi.required()
                    }),
                    features: Joi.array().items(Joi.string()).optional()
                }).required(),
                certification: Joi.object({
                    requested: Joi.boolean().optional()
                }).optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const screenshots = (req.files as Express.Multer.File[])?.map(file => 
                        `/uploads/marketplace/${file.filename}`
                    ) || [];

                    const template = await this.marketplaceManager.publishTemplate({
                        ...req.body,
                        screenshots,
                        author: {
                            id: req.user!.userId,
                            name: req.user!.username,
                            verified: req.user!.verified || false
                        }
                    }, req.user!.userId);

                    res.status(201).json({ template });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Update template
        this.router.put('/templates/:templateId',
            this.security.requirePermission('marketplace', 'update'),
            upload.array('screenshots', 5),
            this.security.validateInput(Joi.object({
                name: Joi.string().min(3).max(255).optional(),
                description: Joi.string().min(10).optional(),
                version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).optional(),
                workflow: Joi.object().optional(),
                documentation: Joi.object().optional(),
                pricing: Joi.object().optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const updates = { ...req.body };
                    
                    if (req.files && (req.files as Express.Multer.File[]).length > 0) {
                        updates.screenshots = (req.files as Express.Multer.File[]).map(file => 
                            `/uploads/marketplace/${file.filename}`
                        );
                    }

                    const template = await this.marketplaceManager.updateTemplate(
                        req.params.templateId,
                        updates,
                        req.user!.userId
                    );

                    res.json({ template });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Install template
        this.router.post('/templates/:templateId/install',
            this.security.requirePermission('workflows', 'create'),
            this.security.validateInput(Joi.object({
                workspaceId: Joi.string().uuid().required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const result = await this.marketplaceManager.installTemplate(
                        req.params.templateId,
                        req.user!.userId,
                        req.body.workspaceId
                    );
                    res.json(result);
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Get user's templates
        this.router.get('/my-templates',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const templates = await this.database.query(
                        `SELECT * FROM marketplace_templates 
                         WHERE author_id = $1 
                         ORDER BY created_at DESC`,
                        [req.user!.userId]
                    );
                    res.json({ templates: templates.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get installed templates
        this.router.get('/installed-templates',
            this.security.validateInput(Joi.object({
                workspaceId: Joi.string().uuid().required()
            }).unknown(false)),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const installations = await this.database.query(
                        `SELECT ti.*, t.name, t.description, t.version as latest_version
                         FROM template_installations ti
                         JOIN marketplace_templates t ON ti.template_id = t.id
                         WHERE ti.user_id = $1 AND ti.workspace_id = $2
                         ORDER BY ti.installation_date DESC`,
                        [req.user!.userId, req.query.workspaceId]
                    );
                    res.json({ installations: installations.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupConnectorRoutes(): void {
        // Search connectors
        this.router.get('/connectors/search',
            this.security.validateInput(Joi.object({
                query: Joi.string().optional(),
                category: Joi.string().optional(),
                type: Joi.string().valid('action', 'trigger', 'app', 'protocol').optional(),
                enterprise: Joi.boolean().optional(),
                certified: Joi.boolean().optional(),
                page: Joi.number().min(1).default(1),
                limit: Joi.number().min(1).max(100).default(20)
            }).unknown(false)),
            async (req: Request, res: Response) => {
                try {
                    let query = `
                        SELECT c.*, 
                               u.username as author_name,
                               COUNT(*) OVER() as total_count
                        FROM marketplace_connectors c
                        JOIN users u ON c.author_id = u.id
                        WHERE 1=1
                    `;
                    const params: any[] = [];
                    let paramCount = 0;

                    if (req.query.query) {
                        paramCount++;
                        query += ` AND (
                            c.name ILIKE $${paramCount} OR 
                            c.display_name ILIKE $${paramCount} OR 
                            c.description ILIKE $${paramCount}
                        )`;
                        params.push(`%${req.query.query}%`);
                    }

                    if (req.query.category) {
                        paramCount++;
                        query += ` AND c.category = $${paramCount}`;
                        params.push(req.query.category);
                    }

                    if (req.query.type) {
                        paramCount++;
                        query += ` AND c.type = $${paramCount}`;
                        params.push(req.query.type);
                    }

                    if (req.query.enterprise !== undefined) {
                        paramCount++;
                        query += ` AND c.enterprise = $${paramCount}`;
                        params.push(req.query.enterprise === 'true');
                    }

                    if (req.query.certified !== undefined) {
                        paramCount++;
                        query += ` AND c.certified = $${paramCount}`;
                        params.push(req.query.certified === 'true');
                    }

                    query += ` ORDER BY c.installs DESC`;

                    const page = Number(req.query.page) || 1;
                    const limit = Number(req.query.limit) || 20;
                    const offset = (page - 1) * limit;
                    
                    query += ` LIMIT ${limit} OFFSET ${offset}`;

                    const result = await this.database.query(query, params);
                    
                    const total = result.rows[0]?.total_count || 0;
                    const pages = Math.ceil(total / limit);

                    res.json({
                        connectors: result.rows,
                        total,
                        page,
                        pages
                    });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Publish connector
        this.router.post('/connectors',
            this.security.requirePermission('marketplace', 'create'),
            upload.single('icon'),
            this.security.validateInput(Joi.object({
                name: Joi.string().pattern(/^[a-z0-9-]+$/).required(),
                displayName: Joi.string().required(),
                description: Joi.string().required(),
                version: Joi.string().pattern(/^\d+\.\d+\.\d+$/).required(),
                category: Joi.string().required(),
                type: Joi.string().valid('action', 'trigger', 'app', 'protocol').required(),
                authentication: Joi.object({
                    type: Joi.string().valid('oauth2', 'apiKey', 'basic', 'custom').required(),
                    config: Joi.object().required()
                }).required(),
                operations: Joi.array().items(Joi.object({
                    name: Joi.string().required(),
                    displayName: Joi.string().required(),
                    description: Joi.string().required(),
                    inputs: Joi.any().required(),
                    outputs: Joi.any().required(),
                    sample: Joi.any().optional()
                })).required(),
                color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required(),
                documentation: Joi.string().required(),
                requirements: Joi.object({
                    runtime: Joi.string().optional(),
                    memory: Joi.number().optional(),
                    permissions: Joi.array().items(Joi.string()).optional()
                }).optional(),
                enterprise: Joi.boolean().optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const icon = req.file ? `/uploads/marketplace/${req.file.filename}` : '/assets/default-connector.svg';

                    const connector = await this.marketplaceManager.publishConnector({
                        ...req.body,
                        icon,
                        author: {
                            id: req.user!.userId,
                            name: req.user!.username,
                            verified: req.user!.verified || false
                        }
                    }, req.user!.userId);

                    res.status(201).json({ connector });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Install connector
        this.router.post('/connectors/:connectorId/install',
            this.security.requirePermission('connectors', 'create'),
            this.security.validateInput(Joi.object({
                workspaceId: Joi.string().uuid().required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.marketplaceManager.installConnector(
                        req.params.connectorId,
                        req.body.workspaceId
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Get enterprise connectors
        this.router.get('/connectors/enterprise',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const connectors = await this.marketplaceManager.getEnterpriseConnectors();
                    res.json({ connectors });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupReviewRoutes(): void {
        // Add template review
        this.router.post('/templates/:templateId/reviews',
            this.security.validateInput(Joi.object({
                rating: Joi.number().min(1).max(5).required(),
                comment: Joi.string().min(10).max(1000).required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.marketplaceManager.addReview(
                        req.params.templateId,
                        req.user!.userId,
                        req.body.rating,
                        req.body.comment
                    );
                    res.status(201).json({ success: true });
                } catch (error: any) {
                    res.status(400).json({ error: error.message });
                }
            }
        );

        // Get template reviews
        this.router.get('/templates/:templateId/reviews',
            async (req: Request, res: Response) => {
                try {
                    const reviews = await this.database.query(
                        `SELECT r.*, u.username, u.profile_picture
                         FROM template_reviews r
                         JOIN users u ON r.user_id = u.id
                         WHERE r.template_id = $1
                         ORDER BY r.helpful_votes DESC, r.created_at DESC
                         LIMIT 50`,
                        [req.params.templateId]
                    );
                    res.json({ reviews: reviews.rows });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Vote on review
        this.router.post('/reviews/:reviewId/vote',
            this.security.validateInput(Joi.object({
                helpful: Joi.boolean().required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    if (req.body.helpful) {
                        await this.database.query(
                            'UPDATE template_reviews SET helpful_votes = helpful_votes + 1 WHERE id = $1',
                            [req.params.reviewId]
                        );
                    }
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupAuthorRoutes(): void {
        // Get author profile
        this.router.get('/authors/:userId',
            async (req: Request, res: Response) => {
                try {
                    const author = await this.database.query(
                        `SELECT u.id, u.username, u.created_at,
                                ma.display_name, ma.bio, ma.company, ma.website,
                                ma.github_url, ma.twitter_handle, ma.verified,
                                ma.total_downloads, ma.average_rating,
                                COUNT(DISTINCT t.id) as template_count,
                                COUNT(DISTINCT c.id) as connector_count
                         FROM users u
                         LEFT JOIN marketplace_authors ma ON u.id = ma.user_id
                         LEFT JOIN marketplace_templates t ON u.id = t.author_id
                         LEFT JOIN marketplace_connectors c ON u.id = c.author_id
                         WHERE u.id = $1
                         GROUP BY u.id, u.username, u.created_at, ma.display_name,
                                  ma.bio, ma.company, ma.website, ma.github_url,
                                  ma.twitter_handle, ma.verified, ma.total_downloads,
                                  ma.average_rating`,
                        [req.params.userId]
                    );

                    if (author.rows.length === 0) {
                        return res.status(404).json({ error: 'Author not found' });
                    }

                    res.json({ author: author.rows[0] });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Update author profile
        this.router.put('/authors/profile',
            this.security.validateInput(Joi.object({
                displayName: Joi.string().max(255).optional(),
                bio: Joi.string().max(1000).optional(),
                company: Joi.string().max(255).optional(),
                website: Joi.string().uri().optional(),
                githubUrl: Joi.string().uri().optional(),
                twitterHandle: Joi.string().pattern(/^@?[A-Za-z0-9_]+$/).optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.database.query(
                        `INSERT INTO marketplace_authors (user_id, display_name, bio, company, website, github_url, twitter_handle)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (user_id) DO UPDATE SET
                             display_name = EXCLUDED.display_name,
                             bio = EXCLUDED.bio,
                             company = EXCLUDED.company,
                             website = EXCLUDED.website,
                             github_url = EXCLUDED.github_url,
                             twitter_handle = EXCLUDED.twitter_handle`,
                        [
                            req.user!.userId,
                            req.body.displayName,
                            req.body.bio,
                            req.body.company,
                            req.body.website,
                            req.body.githubUrl,
                            req.body.twitterHandle
                        ]
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Get author earnings
        this.router.get('/authors/earnings',
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const earnings = await this.database.query(
                        `SELECT 
                            ma.balance,
                            ma.lifetime_earnings,
                            COUNT(DISTINCT mt.id) as total_sales,
                            SUM(mt.author_revenue) FILTER (WHERE mt.created_at >= NOW() - INTERVAL '30 days') as last_30_days,
                            SUM(mt.author_revenue) FILTER (WHERE mt.created_at >= NOW() - INTERVAL '7 days') as last_7_days
                         FROM marketplace_authors ma
                         LEFT JOIN marketplace_transactions mt ON ma.user_id = mt.author_id AND mt.status = 'completed'
                         WHERE ma.user_id = $1
                         GROUP BY ma.balance, ma.lifetime_earnings`,
                        [req.user!.userId]
                    );
                    res.json({ earnings: earnings.rows[0] || {} });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }

    private setupAdminRoutes(): void {
        // Submit for certification
        this.router.post('/admin/certification/:itemId',
            this.security.requirePermission('marketplace', 'certify'),
            this.security.validateInput(Joi.object({
                type: Joi.string().valid('template', 'connector').required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const result = await this.marketplaceManager.runCertificationTests(
                        req.params.itemId,
                        req.body.type
                    );
                    res.json(result);
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Feature template
        this.router.put('/admin/templates/:templateId/feature',
            this.security.requirePermission('marketplace', 'feature'),
            this.security.validateInput(Joi.object({
                featured: Joi.boolean().required()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    await this.database.query(
                        'UPDATE marketplace_templates SET featured = $1 WHERE id = $2',
                        [req.body.featured, req.params.templateId]
                    );
                    res.json({ success: true });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );

        // Create featured collection
        this.router.post('/admin/collections',
            this.security.requirePermission('marketplace', 'feature'),
            this.security.validateInput(Joi.object({
                name: Joi.string().required(),
                description: Joi.string().required(),
                slug: Joi.string().pattern(/^[a-z0-9-]+$/).required(),
                items: Joi.array().items(Joi.string().uuid()).required(),
                bannerImage: Joi.string().uri().optional(),
                startDate: Joi.date().optional(),
                endDate: Joi.date().optional()
            })),
            async (req: AuthenticatedRequest, res: Response) => {
                try {
                    const result = await this.database.query(
                        `INSERT INTO featured_collections 
                         (name, description, slug, items, banner_image, start_date, end_date, created_by)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                         RETURNING *`,
                        [
                            req.body.name,
                            req.body.description,
                            req.body.slug,
                            JSON.stringify(req.body.items),
                            req.body.bannerImage,
                            req.body.startDate,
                            req.body.endDate,
                            req.user!.userId
                        ]
                    );
                    res.status(201).json({ collection: result.rows[0] });
                } catch (error: any) {
                    res.status(500).json({ error: error.message });
                }
            }
        );
    }
}