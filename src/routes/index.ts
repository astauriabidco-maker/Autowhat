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
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);

// Public Config Routes (No Auth)
router.get('/api/config/legal', adminController.getLegalContent);

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
router.get('/api/expenses/stats', authenticateManager, expenseController.getExpenseStats);
router.get('/api/expenses/export', authenticateManager, expenseController.exportExpenses);
router.put('/api/expenses/:id', authenticateManager, expenseController.updateExpense);
router.patch('/api/expenses/:id/status', authenticateManager, expenseController.updateExpenseStatus);

// Document API Routes (Protected - Manager only)
router.get('/api/documents', authenticateManager, documentController.getDocuments);
router.get('/api/documents/employees', authenticateManager, documentController.getEmployees);
router.post('/api/documents', authenticateManager, documentController.upload.single('file'), documentController.uploadDocumentHandler);
router.delete('/api/documents/:id', authenticateManager, documentController.deleteDocument);
router.get('/api/employees/:id/documents', authenticateManager, documentController.getEmployeeDocuments);

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
router.get('/api/user/onboarding-status', authenticateManager, userController.getOnboardingStatus);
router.post('/api/user/complete-onboarding', authenticateManager, userController.completeOnboarding);

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
router.get('/api/billing/invoices', authenticateManager, billingController.getInvoices);

// WhatsApp Config API Routes - BYON (Protected - Manager only)
import * as whatsappConfigController from '../controllers/whatsappConfigController';
router.get('/api/whatsapp-config', authenticateManager, whatsappConfigController.getConfig);
router.post('/api/whatsapp-config', authenticateManager, whatsappConfigController.saveConfig);
router.post('/api/whatsapp-config/test', authenticateManager, whatsappConfigController.testConfig);
router.delete('/api/whatsapp-config', authenticateManager, whatsappConfigController.removeConfig);
router.patch('/api/whatsapp-config/toggle', authenticateManager, whatsappConfigController.toggleConfig);

// Subscription Plans API (Public + Admin)
import * as planController from '../controllers/planController';
router.get('/api/plans', planController.getPublicPlans); // Public - no auth needed

// Public Offer API (GeoIP-based pricing) - No auth needed
import * as publicController from '../controllers/publicController';
router.get('/api/public/offer', publicController.getOffer);
router.get('/api/public/countries', publicController.getSupportedCountries);

// Privacy Suite API (Protected - Manager only)
import * as privacyController from '../controllers/privacyController';
router.get('/api/privacy/settings', authenticateManager, privacyController.getPrivacySettings);
router.put('/api/privacy/settings', authenticateManager, privacyController.updatePrivacySettings);
router.get('/api/privacy/purge-estimate', authenticateManager, privacyController.getPurgeEstimateHandler);
router.get('/api/privacy/preview', authenticateManager, privacyController.getAnonymizationPreviewHandler);
router.post('/api/privacy/purge', authenticateManager, privacyController.triggerPurge);

// Admin Routes (Super Admin only)
router.post('/admin/login', adminController.adminLogin);
router.get('/admin/tenants', authenticateSuperAdmin, adminController.getAllTenants);
router.get('/admin/tenants/list', authenticateSuperAdmin, adminController.getTenantsWithDetails);
router.get('/admin/tenants/:id/invoices', authenticateSuperAdmin, billingController.getTenantInvoices);
router.post('/admin/tenants/:id/extend-trial', authenticateSuperAdmin, adminController.extendTrial);
router.post('/admin/tenants/:id/change-plan', authenticateSuperAdmin, adminController.changePlan);
router.post('/admin/tenants/:id/impersonate', authenticateSuperAdmin, adminController.impersonateTenant);
router.get('/admin/employees', authenticateSuperAdmin, adminController.getAllEmployees);
router.get('/admin/attendance', authenticateSuperAdmin, adminController.getAllAttendance);
router.get('/admin/stats', authenticateSuperAdmin, adminController.getGlobalStats);
router.get('/admin/analytics', authenticateSuperAdmin, adminController.getAnalytics);
router.get('/admin/logs', authenticateSuperAdmin, adminController.getActionLogs);
router.post('/admin/tenants/:id/suspend', authenticateSuperAdmin, adminController.suspendTenant);
router.delete('/admin/tenants/:id', authenticateSuperAdmin, adminController.deleteTenant);
router.get('/admin/sessions/active', authenticateSuperAdmin, adminController.getActiveSessions);

// Manual Tenant Management (CRM)
router.post('/admin/tenants/create', authenticateSuperAdmin, adminController.createTenant);
router.put('/admin/tenants/:id/plan-override', authenticateSuperAdmin, adminController.planOverride);
router.get('/admin/tenants/:id/full-details', authenticateSuperAdmin, adminController.getTenantFullDetails);

// Platform Configuration & Admin Team
router.get('/admin/config', authenticateSuperAdmin, adminController.getConfig);
router.put('/admin/config', authenticateSuperAdmin, adminController.updateConfig);
router.get('/admin/admins', authenticateSuperAdmin, adminController.getAdmins);
router.post('/admin/admins', authenticateSuperAdmin, adminController.createAdmin);
router.get('/admin/health', authenticateSuperAdmin, adminController.getHealth);

// CRM Leads / Sales
import * as crmController from '../controllers/superAdminCrmController';
router.get('/superadmin/leads', authenticateSuperAdmin, crmController.getLeads);
router.post('/superadmin/leads/:id/notes', authenticateSuperAdmin, crmController.addLeadNote);
router.get('/superadmin/leads/:id/notes', authenticateSuperAdmin, crmController.getLeadNotes);
router.post('/superadmin/leads/:id/relance', authenticateSuperAdmin, crmController.sendRelanceEmail);

// External Leads (Manual Prospects)
router.get('/superadmin/external-leads', authenticateSuperAdmin, crmController.getExternalLeads);
router.post('/superadmin/external-leads', authenticateSuperAdmin, crmController.createExternalLead);
router.put('/superadmin/external-leads/:id', authenticateSuperAdmin, crmController.updateExternalLead);
router.post('/superadmin/external-leads/:id/notes', authenticateSuperAdmin, crmController.addExternalLeadNote);
router.post('/superadmin/external-leads/:id/convert', authenticateSuperAdmin, crmController.convertExternalLead);
router.delete('/superadmin/external-leads/:id', authenticateSuperAdmin, crmController.deleteExternalLead);

// Automation Rules (Cockpit)
import * as automationController from '../controllers/automationController';
router.get('/superadmin/automations', authenticateSuperAdmin, automationController.getAutomationRules);
router.get('/superadmin/automations/stats', authenticateSuperAdmin, automationController.getAutomationStats);
router.post('/superadmin/automations', authenticateSuperAdmin, automationController.createAutomationRule);
router.put('/superadmin/automations/:id', authenticateSuperAdmin, automationController.updateAutomationRule);
router.patch('/superadmin/automations/:id/toggle', authenticateSuperAdmin, automationController.toggleAutomationRule);
router.delete('/superadmin/automations/:id', authenticateSuperAdmin, automationController.deleteAutomationRule);
router.get('/superadmin/automations/:id/logs', authenticateSuperAdmin, automationController.getAutomationLogs);

// SuperAdmin Expenses (Multi-tenant view)
router.get('/superadmin/expenses', authenticateSuperAdmin, expenseController.getSuperAdminExpenses);
router.get('/superadmin/expenses/stats', authenticateSuperAdmin, expenseController.getSuperAdminExpenseStats);

// SuperAdmin Documents (Multi-tenant view)
router.get('/superadmin/documents', authenticateSuperAdmin, documentController.getSuperAdminDocuments);
router.get('/superadmin/documents/stats', authenticateSuperAdmin, documentController.getSuperAdminDocumentStats);

// Integrations Vault
router.get('/admin/integrations', authenticateSuperAdmin, integrationController.getIntegrations);
router.put('/admin/integrations', authenticateSuperAdmin, integrationController.upsertIntegration);
router.delete('/admin/integrations', authenticateSuperAdmin, integrationController.deleteIntegration);

// Subscription Plans Management (SuperAdmin)
router.get('/admin/plans', authenticateSuperAdmin, planController.getAllPlans);
router.get('/admin/plans/:id', authenticateSuperAdmin, planController.getPlanById);
router.post('/admin/plans', authenticateSuperAdmin, planController.createPlan);
router.put('/admin/plans/:id', authenticateSuperAdmin, planController.updatePlan);
router.delete('/admin/plans/:id', authenticateSuperAdmin, planController.deletePlan);

// Regional Pricing Management (SuperAdmin)
import * as regionalPricingController from '../controllers/regionalPricingController';
router.get('/admin/pricing/matrix', authenticateSuperAdmin, regionalPricingController.getPricingMatrix);
router.get('/admin/pricing/regions', authenticateSuperAdmin, regionalPricingController.getAvailableRegions);
router.put('/admin/pricing/regional', authenticateSuperAdmin, regionalPricingController.upsertRegionalPricing);
router.delete('/admin/pricing/regional/:id', authenticateSuperAdmin, regionalPricingController.deleteRegionalPricing);

// Outgoing Webhooks
import * as webhookConfigController from '../controllers/webhookConfigController';
router.get('/admin/webhooks', authenticateSuperAdmin, webhookConfigController.getWebhooks);
router.get('/admin/webhooks/events', authenticateSuperAdmin, webhookConfigController.getWebhookEvents);
router.get('/admin/webhooks/:id', authenticateSuperAdmin, webhookConfigController.getWebhook);
router.post('/admin/webhooks', authenticateSuperAdmin, webhookConfigController.createWebhook);
router.put('/admin/webhooks/:id', authenticateSuperAdmin, webhookConfigController.updateWebhook);
router.delete('/admin/webhooks/:id', authenticateSuperAdmin, webhookConfigController.deleteWebhook);
router.post('/admin/webhooks/:id/test', authenticateSuperAdmin, webhookConfigController.testWebhookEndpoint);

// Support Tickets - Client API (Protected - Manager only)
import * as supportController from '../controllers/supportController';
router.post('/api/tickets', authenticateManager, supportController.createTicket);
router.get('/api/tickets', authenticateManager, supportController.getTickets);
router.get('/api/tickets/:id', authenticateManager, supportController.getTicket);
router.post('/api/tickets/:id/reply', authenticateManager, supportController.replyToTicket);

// Support Tickets - SuperAdmin API
import * as superAdminSupportController from '../controllers/superAdminSupportController';
router.get('/admin/tickets', authenticateSuperAdmin, superAdminSupportController.getAllTickets);
router.get('/admin/tickets/stats', authenticateSuperAdmin, superAdminSupportController.getTicketStats);
router.get('/admin/tickets/:id', authenticateSuperAdmin, superAdminSupportController.getTicketDetails);
router.post('/admin/tickets/:id/reply', authenticateSuperAdmin, superAdminSupportController.adminReply);
router.patch('/admin/tickets/:id/status', authenticateSuperAdmin, superAdminSupportController.updateTicketStatus);

// Queue Management (SuperAdmin)
import * as queueController from '../controllers/queueController';
router.get('/admin/queue/stats', authenticateSuperAdmin, queueController.getStats);
router.get('/admin/queue/health', authenticateSuperAdmin, queueController.getHealth);
router.post('/admin/queue/pause', authenticateSuperAdmin, queueController.pause);
router.post('/admin/queue/resume', authenticateSuperAdmin, queueController.resume);

// Number Pool Management (SuperAdmin)
import * as numberPoolController from '../controllers/numberPoolController';
router.get('/admin/number-pool', authenticateSuperAdmin, numberPoolController.listNumbers);
router.get('/admin/number-pool/stats', authenticateSuperAdmin, numberPoolController.getPoolStats);
router.post('/admin/number-pool', authenticateSuperAdmin, numberPoolController.addNumber);
router.put('/admin/number-pool/:id', authenticateSuperAdmin, numberPoolController.updateNumber);
router.delete('/admin/number-pool/:id', authenticateSuperAdmin, numberPoolController.deleteNumber);
router.get('/admin/number-pool/:id/tenants', authenticateSuperAdmin, numberPoolController.getNumberTenants);

// Debug Routes
router.use('/debug', debugRoutes);

export default router;

