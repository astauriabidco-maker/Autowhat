import PDFDocument from 'pdfkit';
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
 * Get French month name
 */
const getFrenchMonth = (month: number): string => {
    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[month];
};

/**
 * Calculate duration string
 */
const calculateDuration = (checkIn: Date, checkOut: Date | null): string => {
    if (!checkOut) return '-';
    const diffMs = checkOut.getTime() - checkIn.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
};

/**
 * Generate Individual Timesheet PDF
 * @param employeeId - Employee ID
 * @param month - Month (0-11)
 * @param year - Year
 * @param tenantId - Tenant ID for security
 * @param res - Express Response to stream the file
 */
export const generateIndividualTimesheet = async (
    employeeId: string,
    month: number,
    year: number,
    tenantId: string,
    res: Response
): Promise<void> => {
    // Get employee with tenant info
    const employee = await prisma.employee.findFirst({
        where: { id: employeeId, tenantId },
        include: {
            tenant: {
                select: { name: true }
            }
        }
    });

    if (!employee) {
        throw new Error('Employé non trouvé');
    }

    // Calculate date range
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    // Fetch attendances for this month
    const attendances = await prisma.attendance.findMany({
        where: {
            employeeId,
            tenantId,
            checkIn: {
                gte: startDate,
                lte: endDate
            }
        },
        orderBy: { checkIn: 'asc' }
    });

    // Create attendance map by day
    const attendanceByDay: Map<number, typeof attendances[0]> = new Map();
    for (const att of attendances) {
        const day = new Date(att.checkIn).getDate();
        attendanceByDay.set(day, att);
    }

    // Create PDF document
    const doc = new PDFDocument({
        margin: 50,
        size: 'A4'
    });

    // Set response headers
    const employeeName = employee.name || 'Employe';
    const filename = `Feuille_${employeeName.replace(/\s+/g, '_')}_${getFrenchMonth(month)}_${year}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // Pipe to response
    doc.pipe(res);

    // ===== HEADER =====
    doc.fontSize(20)
        .font('Helvetica-Bold')
        .text(employee.tenant.name, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(14)
        .font('Helvetica')
        .text(`Feuille de temps - ${getFrenchMonth(month)} ${year}`, { align: 'center' });

    doc.moveDown(1.5);

    // ===== EMPLOYEE INFO =====
    doc.fontSize(11)
        .font('Helvetica-Bold')
        .text('Informations Salarié', { underline: true });

    doc.moveDown(0.3);
    doc.font('Helvetica')
        .text(`Nom : ${employee.name || 'Non spécifié'}`);
    doc.text(`Rôle : ${employee.role || 'Employé'}`);
    doc.text(`Téléphone : ${employee.phoneNumber}`);

    doc.moveDown(1);

    // ===== TABLE =====
    const tableTop = doc.y;
    const colWidths = [60, 80, 80, 80, 80, 100];
    const rowHeight = 20;

    // Table headers
    const headers = ['Date', 'Arrivée', 'Départ', 'Pause', 'Total', 'Commentaires'];

    doc.font('Helvetica-Bold').fontSize(9);
    let x = 50;

    // Header background
    doc.rect(50, tableTop - 5, 480, rowHeight).fill('#e5e7eb');
    doc.fillColor('#000000');

    headers.forEach((header, i) => {
        doc.text(header, x + 2, tableTop, { width: colWidths[i], align: 'center' });
        x += colWidths[i];
    });

    // Table rows
    doc.font('Helvetica').fontSize(9);
    let y = tableTop + rowHeight;

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let totalHours = 0;
    let totalMinutes = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        x = 50;
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const attendance = attendanceByDay.get(day);

        // Zebra striping
        if (day % 2 === 0) {
            doc.rect(50, y - 3, 480, rowHeight).fill('#f9fafb');
            doc.fillColor('#000000');
        }

        // Date cell
        const dateStr = `${day.toString().padStart(2, '0')}/${(month + 1).toString().padStart(2, '0')}`;
        doc.text(dateStr, x + 2, y, { width: colWidths[0], align: 'center' });
        x += colWidths[0];

        if (attendance) {
            // Arrivée
            doc.text(formatTimeInParis(attendance.checkIn), x + 2, y, { width: colWidths[1], align: 'center' });
            x += colWidths[1];

            // Départ
            doc.text(attendance.checkOut ? formatTimeInParis(attendance.checkOut) : '-', x + 2, y, { width: colWidths[2], align: 'center' });
            x += colWidths[2];

            // Pause (placeholder)
            doc.text('-', x + 2, y, { width: colWidths[3], align: 'center' });
            x += colWidths[3];

            // Total
            const duration = calculateDuration(attendance.checkIn, attendance.checkOut);
            doc.text(duration, x + 2, y, { width: colWidths[4], align: 'center' });
            x += colWidths[4];

            // Calculate total
            if (attendance.checkOut) {
                const diffMs = attendance.checkOut.getTime() - attendance.checkIn.getTime();
                totalMinutes += Math.floor(diffMs / (1000 * 60));
            }

            // Commentaires
            const comment = !attendance.checkOut ? 'Oubli pointage' : '';
            doc.text(comment, x + 2, y, { width: colWidths[5], align: 'left' });
        } else {
            // No attendance
            doc.text('-', x + 2, y, { width: colWidths[1], align: 'center' });
            x += colWidths[1];
            doc.text('-', x + 2, y, { width: colWidths[2], align: 'center' });
            x += colWidths[2];
            doc.text('-', x + 2, y, { width: colWidths[3], align: 'center' });
            x += colWidths[3];
            doc.text('-', x + 2, y, { width: colWidths[4], align: 'center' });
            x += colWidths[4];
            doc.text(isWeekend ? 'Repos' : 'Absence', x + 2, y, { width: colWidths[5], align: 'left' });
        }

        y += rowHeight;

        // New page if needed
        if (y > 700) {
            doc.addPage();
            y = 50;
        }
    }

    // Total row
    totalHours = Math.floor(totalMinutes / 60);
    const remainingMins = totalMinutes % 60;

    doc.rect(50, y + 5, 480, rowHeight + 5).fill('#d1d5db');
    doc.fillColor('#000000');
    doc.font('Helvetica-Bold');
    doc.text('TOTAL', 52, y + 10, { width: 300 });
    doc.text(`${totalHours}h${remainingMins.toString().padStart(2, '0')}`, 52 + 300, y + 10, { width: 80, align: 'center' });

    // ===== SIGNATURES =====
    const signatureY = Math.min(y + 80, 720);

    doc.font('Helvetica').fontSize(10);

    // Employee signature box
    doc.rect(50, signatureY, 200, 60).stroke();
    doc.text('Signature Employé :', 55, signatureY + 5);
    doc.text(`Date : __/__/____`, 55, signatureY + 40);

    // Manager signature box
    doc.rect(310, signatureY, 200, 60).stroke();
    doc.text('Signature Manager :', 315, signatureY + 5);
    doc.text(`Date : __/__/____`, 315, signatureY + 40);

    // Finalize
    doc.end();
};
