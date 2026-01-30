import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'AutoWhats API',
            version: '1.0.0',
            description: `
## API Documentation for AutoWhats

AutoWhats is a multi-tenant SaaS platform for workforce management via WhatsApp.

### Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

### Roles
- **Employee**: Regular workforce member (interacts via WhatsApp)
- **Manager**: Company administrator (web dashboard access)
- **SuperAdmin**: Platform administrator (god mode access)
            `,
            contact: {
                name: 'AutoWhats Support',
                email: 'support@autowhats.com'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            },
            {
                url: 'https://api.autowhats.com',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT token obtained from /auth/login'
                },
                superAdminAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'SuperAdmin JWT token from /admin/login'
                }
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Error message' }
                    }
                },
                Success: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Operation successful' }
                    }
                },
                Employee: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string', example: 'Jean Dupont' },
                        phoneNumber: { type: 'string', example: '+33612345678' },
                        role: { type: 'string', enum: ['EMPLOYEE', 'MANAGER'] },
                        language: { type: 'string', enum: ['fr', 'en', 'es'] },
                        workProfile: { type: 'string', enum: ['MOBILE', 'SEDENTARY'] },
                        siteId: { type: 'string', format: 'uuid', nullable: true }
                    }
                },
                Site: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string', example: 'Paris HQ' },
                        address: { type: 'string', example: '15 rue de la Paix, 75001 Paris' },
                        latitude: { type: 'number', example: 48.8566 },
                        longitude: { type: 'number', example: 2.3522 },
                        radius: { type: 'integer', example: 200, description: 'Geofencing radius in meters' }
                    }
                },
                Attendance: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        checkIn: { type: 'string', format: 'date-time' },
                        checkOut: { type: 'string', format: 'date-time', nullable: true },
                        status: { type: 'string', enum: ['PRESENT', 'LATE', 'ABSENT'] },
                        latitude: { type: 'number', nullable: true },
                        longitude: { type: 'number', nullable: true },
                        locationWarning: { type: 'boolean' }
                    }
                },
                Expense: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        date: { type: 'string', format: 'date-time' },
                        amount: { type: 'number', example: 45.50 },
                        category: { type: 'string', enum: ['REPAS', 'ESSENCE', 'HOTEL', 'MATERIEL'] },
                        photoUrl: { type: 'string' },
                        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] }
                    }
                },
                Tenant: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string', example: 'Acme Corp' },
                        plan: { type: 'string', enum: ['TRIAL', 'PRO', 'ENTERPRISE'] },
                        status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
                        trialEndsAt: { type: 'string', format: 'date-time', nullable: true },
                        maxEmployees: { type: 'integer', example: 50 }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['phoneNumber', 'password'],
                    properties: {
                        phoneNumber: { type: 'string', example: '+33612345678' },
                        password: { type: 'string', example: 'securepassword' }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        token: { type: 'string', description: 'JWT token' },
                        user: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                role: { type: 'string' }
                            }
                        }
                    }
                },
                RegisterRequest: {
                    type: 'object',
                    required: ['name', 'phoneNumber', 'password', 'companyName'],
                    properties: {
                        name: { type: 'string', example: 'Jean Dupont' },
                        phoneNumber: { type: 'string', example: '+33612345678' },
                        password: { type: 'string', minLength: 6 },
                        companyName: { type: 'string', example: 'Acme Corp' },
                        country: { type: 'string', example: 'FR', default: 'FR' }
                    }
                }
            }
        },
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Dashboard', description: 'Dashboard and statistics' },
            { name: 'Employees', description: 'Employee management' },
            { name: 'Sites', description: 'Site/Location management' },
            { name: 'Attendance', description: 'Attendance tracking' },
            { name: 'Expenses', description: 'Expense management' },
            { name: 'Documents', description: 'Document management' },
            { name: 'Notifications', description: 'In-app notifications' },
            { name: 'Billing', description: 'Subscription and billing' },
            { name: 'Settings', description: 'Tenant settings' },
            { name: 'Import', description: 'Bulk data import' },
            { name: 'Export', description: 'Data export (Excel/PDF)' },
            { name: 'SuperAdmin', description: 'Platform administration (God Mode)' },
            { name: 'Webhook', description: 'WhatsApp webhook handlers' }
        ]
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
