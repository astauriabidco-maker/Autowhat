import { Request, Response } from 'express';
import { generatePayrollExcel } from '../services/excelService';
import { generateIndividualTimesheet } from '../services/pdfService';

/**
 * GET /api/exports/excel
 * Generate and download Excel payroll report
 * Query params: start, end, siteId (optional)
 */
export const exportExcel = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const { start, end, siteId } = req.query;

        if (!start || !end) {
            return res.status(400).json({ error: 'Les dates de début et fin sont requises' });
        }

        // Parse dates
        const startDate = new Date(start as string);
        startDate.setUTCHours(0, 0, 0, 0);

        const endDate = new Date(end as string);
        endDate.setUTCHours(23, 59, 59, 999);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Format de date invalide' });
        }

        console.log(`📊 Generating Excel export for tenant ${tenantId} from ${startDate} to ${endDate}`);

        await generatePayrollExcel(
            tenantId,
            siteId as string | null,
            startDate,
            endDate,
            res
        );

    } catch (error) {
        console.error('❌ Error generating Excel:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel' });
        }
    }
};

/**
 * GET /api/exports/pdf/:employeeId
 * Generate and download PDF timesheet for an employee
 * Query params: month, year
 */
export const exportPdf = async (req: Request, res: Response): Promise<any> => {
    try {
        const tenantId = (req as any).user?.tenantId;
        if (!tenantId) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        const employeeId = req.params.employeeId as string;
        const { month, year } = req.query;

        if (!employeeId) {
            return res.status(400).json({ error: 'ID employé requis' });
        }

        if (month === undefined || year === undefined) {
            return res.status(400).json({ error: 'Mois et année requis' });
        }

        const monthNum = parseInt(month as string, 10);
        const yearNum = parseInt(year as string, 10);

        if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 0 || monthNum > 11) {
            return res.status(400).json({ error: 'Format de mois/année invalide' });
        }

        console.log(`📄 Generating PDF timesheet for employee ${employeeId}, ${monthNum + 1}/${yearNum}`);

        await generateIndividualTimesheet(
            employeeId,
            monthNum,
            yearNum,
            tenantId,
            res
        );

    } catch (error: any) {
        console.error('❌ Error generating PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message || 'Erreur lors de la génération du fichier PDF' });
        }
    }
};
