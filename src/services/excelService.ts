import ExcelJS from 'exceljs';
import { Response } from 'express';
import prisma from '../lib/prisma';


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
 * Format date and time in Paris timezone
 */
const formatDateTimeInParis = (date: Date): string => {
    return `${formatDateInParis(date)} ${formatTimeInParis(date)}`;
};

/**
 * Calculate hours difference as decimal
 */
const calculateHoursDecimal = (checkIn: Date, checkOut: Date | null): number => {
    if (!checkOut) return 0;
    const diffMs = checkOut.getTime() - checkIn.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimals
};

const GPS_VERDICT_LABELS: Record<string, string> = {
    PENDING: 'En attente',
    APPROVED: 'Validé',
    WARNING: 'Sous réserve',
    REJECTED: 'Refusé',
    NOT_REQUIRED: 'Non requis',
    NOT_CONFIGURED: 'Non configuré'
};

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
    PRESENT: 'Présent',
    WARNING: 'Sous réserve',
    PENDING_GPS: 'GPS attendu',
    REJECTED: 'Refusé'
};

const DECISION_ACTION_LABELS: Record<string, string> = {
    APPROVE_EXCEPTION: 'Validation exceptionnelle',
    REJECT: 'Refus',
    CONFIRM: 'Confirmation'
};

const formatLabel = (value: string | null | undefined, labels: Record<string, string>): string => {
    if (!value) return '-';
    return labels[value] || value;
};

const formatStatusTransition = (
    previousStatus: string | null | undefined,
    nextStatus: string | null | undefined
): string => {
    if (!previousStatus && !nextStatus) return '-';
    return `${formatLabel(previousStatus, ATTENDANCE_STATUS_LABELS)} -> ${formatLabel(nextStatus, ATTENDANCE_STATUS_LABELS)}`;
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
        filter.OR = [
            { siteId },
            { siteId: null, employee: { siteId } }
        ];
    }

    // Fetch attendances with employee info
    const attendances = await prisma.attendance.findMany({
        where: filter,
        include: {
            employee: {
                select: { id: true, name: true, siteId: true }
            },
            decisionEvents: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                    action: true,
                    reason: true,
                    previousStatus: true,
                    nextStatus: true,
                    createdAt: true,
                    manager: {
                        select: {
                            name: true,
                            phoneNumber: true
                        }
                    }
                }
            }
        },
        orderBy: [
            { checkIn: 'asc' }
        ]
    });

    // Fetch sites for location names
    const siteIds = [
        ...new Set(attendances.map(a => a.siteId || a.employee.siteId).filter(Boolean))
    ] as string[];
    const sites = await prisma.site.findMany({
        where: { tenantId, id: { in: siteIds } },
        select: { id: true, name: true, radius: true }
    });
    const siteMap = new Map(sites.map(s => [s.id, s]));

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
        { header: 'Lieu', key: 'location', width: 20 },
        { header: 'Verdict GPS', key: 'gpsVerdict', width: 18 },
        { header: 'Raison', key: 'gpsReason', width: 45 },
        { header: 'Distance site (m)', key: 'distanceFromSite', width: 18 },
        { header: 'Rayon (m)', key: 'siteRadius', width: 12 },
        { header: 'Dernière décision manager', key: 'managerDecision', width: 28 },
        { header: 'Décidé par', key: 'decidedBy', width: 24 },
        { header: 'Date décision', key: 'decisionDate', width: 20 },
        { header: 'Statut avant -> après', key: 'statusTransition', width: 28 }
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
            const site = (att.siteId && siteMap.get(att.siteId)) ||
                (att.employee.siteId && siteMap.get(att.employee.siteId)) ||
                null;
            const latestDecision = att.decisionEvents[0];

            const location = site?.name ||
                (att.latitude && att.longitude
                    ? `GPS: ${att.latitude.toFixed(4)}, ${att.longitude.toFixed(4)}`
                    : 'Non spécifié');

            const status = att.status && att.status !== 'PRESENT'
                ? formatLabel(att.status, ATTENDANCE_STATUS_LABELS)
                : att.checkOut
                    ? 'Présent'
                    : 'Oubli de pointage';

            sheet.addRow({
                name: att.employee.name,
                date: formatDateInParis(att.checkIn),
                checkIn: formatTimeInParis(att.checkIn),
                checkOut: att.checkOut ? formatTimeInParis(att.checkOut) : '-',
                hours: hours > 0 ? hours : '-',
                status,
                location,
                gpsVerdict: formatLabel(att.gpsVerdict, GPS_VERDICT_LABELS),
                gpsReason: att.verdictReason || latestDecision?.reason || '-',
                distanceFromSite: att.distanceFromSite ?? '-',
                siteRadius: site?.radius ?? '-',
                managerDecision: formatLabel(latestDecision?.action, DECISION_ACTION_LABELS),
                decidedBy: latestDecision?.manager?.name || latestDecision?.manager?.phoneNumber || '-',
                decisionDate: latestDecision ? formatDateTimeInParis(latestDecision.createdAt) : '-',
                statusTransition: latestDecision
                    ? formatStatusTransition(latestDecision.previousStatus, latestDecision.nextStatus)
                    : '-'
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
