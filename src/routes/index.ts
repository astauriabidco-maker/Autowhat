import { Router } from 'express';
import * as webhookController from '../controllers/webhookController';
import * as authController from '../controllers/authController';
import * as dashboardController from '../controllers/dashboardController';
import * as adminController from '../controllers/adminController';
import * as expenseController from '../controllers/expenseController';
import * as documentController from '../controllers/documentController';
import * as tenantController from '../controllers/tenantController';
import * as employeeController from '../controllers/employeeController';
import * as siteController from '../controllers/siteController';
import * as exportController from '../controllers/exportController';
import * as notificationController from '../controllers/notificationController';
import * as userController from '../controllers/userController';
import * as importController from '../controllers/importController';
import * as billingController from '../controllers/billingController';
import * as webhookStripe from '../controllers/webhookStripe';
import * as integrationController from '../controllers/integrationController';
import { authenticateManager } from '../middlewares/authMiddleware';
import { authenticateSuperAdmin } from '../middlewares/adminMiddleware';
import debugRoutes from './debugRoutes';

const router = Router();

// Webhook Routes
router.get('/webhook', webhookController.verifyWebhook);
router.post('/webhook', webhookController.handleMessage);

// Auth Routes (Public)
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);

// Dashboard API Routes (Protected - Manager only)
router.get('/api/attendance', authenticateManager, dashboardController.getAttendance);
router.get('/api/attendance/stats', authenticateManager, dashboardController.getAttendanceStats);
router.get('/api/dashboard/stats', authenticateManager, dashboardController.getDashboardStats);

// Site API Routes (Protected - Manager only)
router.get('/api/sites', authenticateManager, siteController.getSites);
router.post('/api/sites', authenticateManager, siteController.createSite);
router.put('/api/sites/:id', authenticateManager, siteController.updateSite);
router.delete('/api/sites/:id', authenticateManager, siteController.deleteSite);

// Employee API Routes (Protected - Manager only)
router.get('/api/employees', authenticateManager, employeeController.getEmployees);
router.post('/api/employees', authenticateManager, employeeController.createEmployee);
router.patch('/api/employees/:id', authenticateManager, employeeController.updateEmployee);
router.delete('/api/employees/:id', authenticateManager, employeeController.deleteEmployee);

// Tenant API Routes (Protected - Manager only)
router.get('/api/tenant/info', authenticateManager, tenantController.getTenantInfo);

// Expense API Routes (Protected - Manager only)
router.get('/api/expenses', authenticateManager, expenseController.getExpenses);
router.patch('/api/expenses/:id/status', authenticateManager, expenseController.updateExpenseStatus);

// Document API Routes (Protected - Manager only)
router.get('/api/documents', authenticateManager, documentController.getDocuments);
router.get('/api/documents/employees', authenticateManager, documentController.getEmployees);
router.post('/api/documents', authenticateManager, documentController.upload.single('file'), documentController.uploadDocumentHandler);
router.delete('/api/documents/:id', authenticateManager, documentController.deleteDocument);

// Export API Routes (Protected - Manager only)
router.get('/api/exports/excel', authenticateManager, exportController.exportExcel);
router.get('/api/exports/pdf/:employeeId', authenticateManager, exportController.exportPdf);

// Notification API Routes (Protected - Manager only)
router.get('/api/notifications', authenticateManager, notificationController.getNotifications);
router.get('/api/notifications/unread-count', authenticateManager, notificationController.getUnreadCount);
router.patch('/api/notifications/read-all', authenticateManager, notificationController.markAllAsRead);
router.patch('/api/notifications/:id/read', authenticateManager, notificationController.markAsRead);

// User API Routes (Protected - Manager only)
router.get('/api/users/me', authenticateManager, userController.getCurrentUser);
router.patch('/api/users/me', authenticateManager, userController.updateCurrentUser);

// Settings API Routes (Protected - Manager only)
router.get('/api/settings', authenticateManager, tenantController.getSettings);
router.put('/api/settings', authenticateManager, tenantController.updateSettings);

// Import API Routes (Protected - Manager only)
router.get('/api/import/template', authenticateManager, importController.downloadTemplate);
router.post('/api/import/employees', authenticateManager, importController.upload.single('file'), importController.importEmployees);

// Billing API Routes (Protected - Manager only)
router.post('/api/billing/checkout', authenticateManager, billingController.createCheckout);
router.post('/api/billing/portal', authenticateManager, billingController.createPortal);
router.get('/api/billing/status', authenticateManager, billingController.getStatus);

// Admin Routes (Super Admin only)
router.post('/admin/login', adminController.adminLogin);
router.get('/admin/tenants', authenticateSuperAdmin, adminController.getAllTenants);
router.get('/admin/tenants/list', authenticateSuperAdmin, adminController.getTenantsWithDetails);
router.post('/admin/tenants/:id/extend-trial', authenticateSuperAdmin, adminController.extendTrial);
router.post('/admin/tenants/:id/change-plan', authenticateSuperAdmin, adminController.changePlan);
router.post('/admin/tenants/:id/impersonate', authenticateSuperAdmin, adminController.impersonateTenant);
router.get('/admin/employees', authenticateSuperAdmin, adminController.getAllEmployees);
router.get('/admin/attendance', authenticateSuperAdmin, adminController.getAllAttendance);
router.get('/admin/stats', authenticateSuperAdmin, adminController.getGlobalStats);
router.get('/admin/logs', authenticateSuperAdmin, adminController.getActionLogs);
router.post('/admin/tenants/:id/suspend', authenticateSuperAdmin, adminController.suspendTenant);
router.delete('/admin/tenants/:id', authenticateSuperAdmin, adminController.deleteTenant);
router.get('/admin/sessions/active', authenticateSuperAdmin, adminController.getActiveSessions);

// Platform Configuration & Admin Team
router.get('/admin/config', authenticateSuperAdmin, adminController.getConfig);
router.put('/admin/config', authenticateSuperAdmin, adminController.updateConfig);
router.get('/admin/admins', authenticateSuperAdmin, adminController.getAdmins);
router.post('/admin/admins', authenticateSuperAdmin, adminController.createAdmin);
router.get('/admin/health', authenticateSuperAdmin, adminController.getHealth);

// Integrations Vault
router.get('/admin/integrations', authenticateSuperAdmin, integrationController.getIntegrations);
router.put('/admin/integrations', authenticateSuperAdmin, integrationController.upsertIntegration);
router.delete('/admin/integrations', authenticateSuperAdmin, integrationController.deleteIntegration);

// Debug Routes
router.use('/debug', debugRoutes);

export default router;

