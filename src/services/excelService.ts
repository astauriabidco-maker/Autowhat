import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { Response } from 'express';

const prisma = new PrismaClient();

/**
 * Format date in Paris timezone
 */
const formatDateInParis = (date: Date): string => {
    return date.toLocaleDateString('fr-FR', {
        timeZone: 'Europe/Paris',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};

/**
 * Format time in Paris timezone
 */
const formatTimeInParis = (date: Date): string => {
    return date.toLocaleTimeString('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Calculate hours difference as decimal
 */
const calculateHoursDecimal = (checkIn: Date, checkOut: Date | null): number => {
    if (!checkOut) return 0;
    const diffMs = checkOut.getTime() - checkIn.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
};

/**
 * Generate Payroll Excel for a tenant
 * @param tenantId - Tenant ID
 * @param siteId - Optional Site filter
 * @param startDate - Start of period
 * @param endDate - End of period
 * @param res - Express Response to stream the file
 */
export const generatePayrollExcel = async (
    tenantId: string,
    siteId: string | null,
    startDate: Date,
    endDate: Date,
    res: Response
): Promise<void> => {
    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true }
    });

    // Build filter
    const filter: any = {
        tenantId,
        checkIn: {
            gte: startDate,
            lte: endDate
        }
    };
    if (siteId) {
        filter.siteId = siteId;
    }

    // Fetch attendances with employee info
    const attendances = await prisma.attendance.findMany({
        where: filter,
        include: {
            employee: {
                select: { id: true, name: true }
            }
        },
        orderBy: [
            { checkIn: 'asc' }
        ]
    });

    // Fetch sites for location names
    const siteIds = [...new Set(attendances.map(a => a.siteId).filter(Boolean))] as string[];
    const sites = await prisma.site.findMany({
        where: { id: { in: siteIds } },
        select: { id: true, name: true }
    });
    const siteMap = new Map(sites.map(s => [s.id, s.name]));

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WhatsPoint';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Rapport de Paie');

    // Define columns
    sheet.columns = [
        { header: 'Nom Employé', key: 'name', width: 25 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Heure Arrivée', key: 'checkIn', width: 14 },
        { header: 'Heure Départ', key: 'checkOut', width: 14 },
        { header: 'Total Heures', key: 'hours', width: 12 },
        { header: 'Statut', key: 'status', width: 18 },
        { header: 'Lieu', key: 'location', width: 20 }
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 22;

    // Group by employee
    const groupedByEmployee: Map<string, typeof attendances> = new Map();
    for (const att of attendances) {
        const empId = att.employee.id;
        if (!groupedByEmployee.has(empId)) {
            groupedByEmployee.set(empId, []);
        }
        groupedByEmployee.get(empId)!.push(att);
    }

    // Add rows for each employee
    for (const [, employeeAttendances] of groupedByEmployee) {
        let employeeTotalHours = 0;

        for (const att of employeeAttendances) {
            const hours = calculateHoursDecimal(att.checkIn, att.checkOut);
            employeeTotalHours += hours;

            const location = (att.siteId && siteMap.get(att.siteId)) ||
                (att.latitude && att.longitude
                    ? `GPS: ${att.latitude.toFixed(4)}, ${att.longitude.toFixed(4)}`
                    : 'Non spécifié');

            const status = att.checkOut
                ? 'Présent'
                : 'Oubli de pointage';

            sheet.addRow({
                name: att.employee.name,
                date: formatDateInParis(att.checkIn),
                checkIn: formatTimeInParis(att.checkIn),
                checkOut: att.checkOut ? formatTimeInParis(att.checkOut) : '-',
                hours: hours > 0 ? hours : '-',
                status,
                location
            });
        }

        // Add total row for this employee
        const totalRow = sheet.addRow({
            name: `TOTAL ${employeeAttendances[0].employee.name}`,
            date: '',
            checkIn: '',
            checkOut: '',
            hours: Math.round(employeeTotalHours * 100) / 100,
            status: '',
            location: ''
        });
        totalRow.font = { bold: true };
        totalRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' }
        };

        // Add empty row as separator
        sheet.addRow({});
    }

    // Generate filename
    const monthYear = startDate.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Europe/Paris'
    });
    const safeTenantName = (tenant?.name || 'Export').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Paie_${safeTenantName}_${monthYear.replace(' ', '_')}.xlsx`;

    // Set response headers for download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // Stream to response
    await workbook.xlsx.write(res);
};
