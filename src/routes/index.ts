import { Router } from 'express';
import * as webhookController from '../controllers/webhookController';
import * as authController from '../controllers/authController';
import * as dashboardController from '../controllers/dashboardController';
import * as adminController from '../controllers/adminController';
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

// Admin Routes (Super Admin only)
router.post('/admin/login', adminController.adminLogin);
router.get('/admin/tenants', authenticateSuperAdmin, adminController.getAllTenants);
router.get('/admin/employees', authenticateSuperAdmin, adminController.getAllEmployees);
router.get('/admin/attendance', authenticateSuperAdmin, adminController.getAllAttendance);
router.get('/admin/stats', authenticateSuperAdmin, adminController.getGlobalStats);

// Debug Routes
router.use('/debug', debugRoutes);

export default router;

