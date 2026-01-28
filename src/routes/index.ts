import { Router } from 'express';
import * as webhookController from '../controllers/webhookController';
import * as authController from '../controllers/authController';
import * as dashboardController from '../controllers/dashboardController';
import * as adminController from '../controllers/adminController';
import * as expenseController from '../controllers/expenseController';
import * as documentController from '../controllers/documentController';
import * as tenantController from '../controllers/tenantController';
import { authenticateManager } from '../middlewares/authMiddleware';
import { authenticateSuperAdmin } from '../middlewares/adminMiddleware';
import debugRoutes from './debugRoutes';

const router = Router();

// Webhook Routes
router.get('/webhook', webhookController.verifyWebhook);
router.post('/webhook', webhookController.handleMessage);

// Auth Routes (Public)
router.post('/auth/login', authController.login);

// Dashboard API Routes (Protected - Manager only)
router.get('/api/attendance', authenticateManager, dashboardController.getAttendance);
router.get('/api/attendance/stats', authenticateManager, dashboardController.getAttendanceStats);

// Expense API Routes (Protected - Manager only)
router.get('/api/expenses', authenticateManager, expenseController.getExpenses);
router.patch('/api/expenses/:id/status', authenticateManager, expenseController.updateExpenseStatus);

// Document API Routes (Protected - Manager only)
router.get('/api/documents', authenticateManager, documentController.getDocuments);
router.get('/api/documents/employees', authenticateManager, documentController.getEmployees);
router.post('/api/documents', authenticateManager, documentController.upload.single('file'), documentController.uploadDocumentHandler);
router.delete('/api/documents/:id', authenticateManager, documentController.deleteDocument);

// Settings API Routes (Protected - Manager only)
router.get('/api/settings', authenticateManager, tenantController.getSettings);
router.put('/api/settings', authenticateManager, tenantController.updateSettings);

// Admin Routes (Super Admin only)
router.post('/admin/login', adminController.adminLogin);
router.get('/admin/tenants', authenticateSuperAdmin, adminController.getAllTenants);
router.get('/admin/employees', authenticateSuperAdmin, adminController.getAllEmployees);
router.get('/admin/attendance', authenticateSuperAdmin, adminController.getAllAttendance);
router.get('/admin/stats', authenticateSuperAdmin, adminController.getGlobalStats);

// Debug Routes
router.use('/debug', debugRoutes);

export default router;

