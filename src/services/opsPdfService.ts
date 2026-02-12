/**
 * Operations PDF Service — Quote PDF & Intervention Report PDF
 * Uses PDFKit to generate professional A4 documents.
 */

import PDFDocument from 'pdfkit';
import prisma from '../lib/prisma';
import { Response } from 'express';

// ── helpers ────────────────────────────────────

const fmtDate = (d: Date | string | null): string => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtTime = (d: Date | string | null): string => {
    if (!d) return '—';
    return new Date(d).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
};

const fmtCurrency = (n: number): string => {
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
};

const drawHr = (doc: PDFKit.PDFDocument, y: number) => {
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, y).lineTo(545, y).stroke();
};

// ── colours ────────────────────────────────────

const COLORS = {
    primary: '#0f172a',
    accent: '#3b82f6',
    muted: '#64748b',
    light: '#f1f5f9',
    success: '#22c55e',
    white: '#ffffff',
};

// ══════════════════════════════════════════════════
// 1. QUOTE PDF
// ══════════════════════════════════════════════════

export const generateQuotePdf = async (quoteId: string, tenantId: string, res: Response): Promise<void> => {
    const quote = await prisma.quote.findFirst({
        where: { id: quoteId, tenantId },
        include: {
            customer: true,
            lineItems: { orderBy: { sortOrder: 'asc' } },
            tenant: { select: { name: true } },
        },
    });

    if (!quote) throw new Error('Devis introuvable');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const filename = `Devis_${quote.reference.replace(/\//g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    doc.pipe(res);

    // ── Header ──
    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text((quote as any).tenant?.name || 'Entreprise', 50, 50);

    doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted)
        .text(`Référence : ${quote.reference}`, 50, 80)
        .text(`Date : ${fmtDate(quote.createdAt)}`, 50, 95)
        .text(`Valide jusqu'au : ${fmtDate(quote.validUntil)}`, 50, 110);

    // Status badge
    const statusMap: Record<string, { label: string; color: string }> = {
        DRAFT: { label: 'Brouillon', color: '#94a3b8' },
        SENT: { label: 'Envoyé', color: '#f59e0b' },
        ACCEPTED: { label: 'Accepté', color: '#22c55e' },
        REJECTED: { label: 'Refusé', color: '#ef4444' },
        CONVERTED: { label: 'Converti', color: '#8b5cf6' },
    };
    const st = statusMap[quote.status] || statusMap.DRAFT;
    doc.roundedRect(440, 50, 100, 25, 4).fill(st.color);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.white)
        .text(st.label, 440, 57, { width: 100, align: 'center' });

    // ── CLIENT ──
    doc.fillColor(COLORS.primary);
    drawHr(doc, 135);

    doc.fontSize(11).font('Helvetica-Bold').text('CLIENT', 50, 145);
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.primary);
    const customer = (quote as any).customer;
    if (customer) {
        doc.text(customer.companyName || '', 50, 165);
        if (customer.contactName) doc.text(`À l'attention de ${customer.contactName}`, 50, 180);
        if (customer.address) doc.text(customer.address, 50, 195);
        if (customer.email) doc.text(customer.email, 50, 210);
        if (customer.phone) doc.text(customer.phone, 50, 225);
    }

    // ── SUBJECT ──
    const subjY = 250;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text('OBJET', 50, subjY);
    doc.fontSize(10).font('Helvetica')
        .text((quote as any).subject || '—', 50, subjY + 18, { width: 495 });

    // ── LINE ITEMS TABLE ──
    const tableTop = subjY + ((quote as any).subject ? 45 : 30);
    const cols = { desc: 50, qty: 310, unit: 370, total: 460 };
    const colWidths = { desc: 255, qty: 55, unit: 85, total: 85 };

    // Header row
    doc.rect(50, tableTop, 495, 22).fill(COLORS.primary);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white);
    doc.text('Description', cols.desc + 5, tableTop + 6, { width: colWidths.desc });
    doc.text('Qté', cols.qty, tableTop + 6, { width: colWidths.qty, align: 'center' });
    doc.text('P.U. HT', cols.unit, tableTop + 6, { width: colWidths.unit, align: 'right' });
    doc.text('Total HT', cols.total, tableTop + 6, { width: colWidths.total, align: 'right' });

    // Rows
    let rowY = tableTop + 25;
    const items = (quote as any).lineItems || [];
    items.forEach((li: any, i: number) => {
        if (rowY > 700) { doc.addPage(); rowY = 50; }
        if (i % 2 === 0) {
            doc.rect(50, rowY - 3, 495, 20).fill(COLORS.light);
        }
        doc.fillColor(COLORS.primary).fontSize(9).font('Helvetica');
        doc.text(li.description || '', cols.desc + 5, rowY, { width: colWidths.desc });
        doc.text(String(li.quantity), cols.qty, rowY, { width: colWidths.qty, align: 'center' });
        doc.text(fmtCurrency(li.unitPrice), cols.unit, rowY, { width: colWidths.unit, align: 'right' });
        doc.text(fmtCurrency(li.quantity * li.unitPrice), cols.total, rowY, { width: colWidths.total, align: 'right' });
        rowY += 20;
    });

    // ── TOTALS ──
    drawHr(doc, rowY + 5);
    const totY = rowY + 15;
    doc.fontSize(10).font('Helvetica').fillColor(COLORS.muted);
    doc.text('Sous-total HT', 350, totY, { width: 100, align: 'right' });
    doc.text(fmtCurrency(Number(quote.subtotal)), 460, totY, { width: 85, align: 'right' });

    if (Number(quote.discount) > 0) {
        doc.text(`Remise`, 350, totY + 18, { width: 100, align: 'right' });
        doc.text(`- ${fmtCurrency(Number(quote.discount))}`, 460, totY + 18, { width: 85, align: 'right' });
    }

    const taxLine = Number(quote.discount) > 0 ? 36 : 18;
    doc.text(`TVA (${quote.taxRate}%)`, 350, totY + taxLine, { width: 100, align: 'right' });
    doc.text(fmtCurrency(Number(quote.taxAmount)), 460, totY + taxLine, { width: 85, align: 'right' });

    const totalLine = taxLine + 20;
    doc.rect(340, totY + totalLine - 5, 205, 25).fill(COLORS.primary);
    doc.fontSize(12).font('Helvetica-Bold').fillColor(COLORS.white);
    doc.text('TOTAL TTC', 350, totY + totalLine, { width: 100, align: 'right' });
    doc.text(fmtCurrency(Number(quote.totalAmount)), 460, totY + totalLine, { width: 85, align: 'right' });

    // ── NOTES ──
    if (quote.notes) {
        const notesY = totY + totalLine + 40;
        if (notesY < 700) {
            doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.muted).text('Notes :', 50, notesY);
            doc.fontSize(9).font('Helvetica').fillColor(COLORS.primary).text(quote.notes, 50, notesY + 15, { width: 495 });
        }
    }

    // ── SIGNATURE ZONE ──
    const sigY = Math.min(doc.y + 40, 720);
    doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
        .text('Bon pour accord — Date et signature du client :', 50, sigY);
    doc.rect(50, sigY + 15, 250, 60).stroke(COLORS.muted);

    doc.end();
};

// ══════════════════════════════════════════════════
// 2. INTERVENTION REPORT PDF
// ══════════════════════════════════════════════════

export const generateInterventionReportPdf = async (
    interventionId: string,
    tenantId: string,
    res: Response
): Promise<void> => {
    const intervention = await prisma.intervention.findFirst({
        where: { id: interventionId, tenantId },
        include: {
            customer: true,
            customerSite: true,
            employee: { select: { id: true, name: true, phoneNumber: true } },
            interventionType: true,
            tenant: { select: { name: true } },
            parts: { include: { part: true } },
        },
    });

    if (!intervention) throw new Error('Intervention introuvable');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const filename = `Rapport_Intervention_${intervention.id.slice(0, 8)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    doc.pipe(res);

    // ── Header ──
    doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text((intervention as any).tenant?.name || 'Entreprise', 50, 50);
    doc.fontSize(14).font('Helvetica').fillColor(COLORS.accent)
        .text('RAPPORT D\'INTERVENTION', 50, 80);

    // Status badge
    const statusMap: Record<string, { label: string; color: string }> = {
        SCHEDULED: { label: 'Planifié', color: '#94a3b8' },
        EN_ROUTE: { label: 'En route', color: '#3b82f6' },
        IN_PROGRESS: { label: 'En cours', color: '#f59e0b' },
        COMPLETED: { label: 'Terminé', color: '#22c55e' },
        CANCELED: { label: 'Annulé', color: '#ef4444' },
    };
    const st = statusMap[intervention.status] || statusMap.SCHEDULED;
    doc.roundedRect(430, 50, 110, 25, 4).fill(st.color);
    doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.white)
        .text(st.label, 430, 57, { width: 110, align: 'center' });

    drawHr(doc, 110);

    // ── INTERVENTION INFO ──
    let y = 120;
    const left = 50;
    const right = 300;

    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text('INTERVENTION', left, y);
    y += 20;
    doc.fontSize(10).font('Helvetica');
    doc.text(`Titre : ${intervention.title}`, left, y);
    y += 15;
    if ((intervention as any).interventionType) {
        doc.text(`Type : ${(intervention as any).interventionType.name}`, left, y);
        y += 15;
    }
    if (intervention.description) {
        doc.text(`Description : ${intervention.description}`, left, y, { width: 230 });
        y += Math.ceil((intervention.description.length / 40)) * 12 + 5;
    }

    // ── DATES ──
    doc.fontSize(11).font('Helvetica-Bold').text('PLANNING', right, 140);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Prévu : ${fmtDate(intervention.scheduledStart)} ${fmtTime(intervention.scheduledStart)}`, right, 160);
    doc.text(`   à : ${fmtTime(intervention.scheduledEnd)}`, right, 175);
    if (intervention.realStart) {
        doc.text(`Début réel : ${fmtDate(intervention.realStart)} ${fmtTime(intervention.realStart)}`, right, 195);
    }
    if (intervention.realEnd) {
        doc.text(`Fin réelle : ${fmtDate(intervention.realEnd)} ${fmtTime(intervention.realEnd)}`, right, 210);
        // Duration
        const durationMs = new Date(intervention.realEnd).getTime() - new Date(intervention.realStart || intervention.scheduledStart).getTime();
        const hours = Math.floor(durationMs / 3600000);
        const mins = Math.floor((durationMs % 3600000) / 60000);
        doc.font('Helvetica-Bold').text(`Durée : ${hours}h${mins.toString().padStart(2, '0')}`, right, 225);
        doc.font('Helvetica');
    }

    y = Math.max(y, 250);
    drawHr(doc, y);
    y += 10;

    // ── CLIENT & SITE ──
    doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
        .text('CLIENT', left, y);
    y += 18;
    const cust = (intervention as any).customer;
    if (cust) {
        doc.fontSize(10).font('Helvetica');
        doc.text(cust.companyName || '', left, y);
        y += 15;
        if (cust.contactName) { doc.text(`Contact : ${cust.contactName}`, left, y); y += 15; }
        if (cust.phone) { doc.text(`Tél : ${cust.phone}`, left, y); y += 15; }
    }

    const site = (intervention as any).customerSite;
    if (site) {
        doc.fontSize(11).font('Helvetica-Bold').text('SITE', right, y - (cust ? 45 : 0));
        doc.fontSize(10).font('Helvetica');
        let siteY = y - (cust ? 27 : 0);
        doc.text(site.name || '', right, siteY); siteY += 15;
        if (site.address) { doc.text(site.address, right, siteY); siteY += 15; }
        if (site.city) { doc.text(`${site.postalCode || ''} ${site.city}`, right, siteY); siteY += 15; }
    }

    y += 10;
    drawHr(doc, y);
    y += 10;

    // ── TECHNICIEN ──
    doc.fontSize(11).font('Helvetica-Bold').text('TECHNICIEN', left, y);
    y += 18;
    doc.fontSize(10).font('Helvetica');
    doc.text((intervention as any).employee?.name || 'Non assigné', left, y);
    y += 25;
    drawHr(doc, y);
    y += 10;

    // ── REPORT CONTENT ──
    if (intervention.reportContent) {
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
            .text('COMPTE-RENDU', left, y);
        y += 18;
        doc.fontSize(10).font('Helvetica');
        doc.text(intervention.reportContent, left, y, { width: 495 });
        y = doc.y + 15;
        drawHr(doc, y);
        y += 10;
    }

    // ── PARTS ──
    const partsUsed = (intervention as any).parts || [];
    if (partsUsed.length > 0) {
        if (y > 650) { doc.addPage(); y = 50; }
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
            .text('PIÈCES & MATÉRIEL', left, y);
        y += 18;

        // Table header
        doc.rect(50, y, 495, 20).fill(COLORS.primary);
        doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.white);
        doc.text('Pièce', 55, y + 5, { width: 220 });
        doc.text('Qté', 280, y + 5, { width: 50, align: 'center' });
        doc.text('P.U.', 340, y + 5, { width: 80, align: 'right' });
        doc.text('Total', 430, y + 5, { width: 80, align: 'right' });
        y += 22;

        let partsTotal = 0;
        partsUsed.forEach((p: any, i: number) => {
            if (y > 720) { doc.addPage(); y = 50; }
            if (i % 2 === 0) doc.rect(50, y - 2, 495, 18).fill(COLORS.light);
            doc.fillColor(COLORS.primary).fontSize(9).font('Helvetica');
            const partName = p.part?.name || p.partId;
            doc.text(partName, 55, y, { width: 220 });
            doc.text(String(p.quantity), 280, y, { width: 50, align: 'center' });
            doc.text(fmtCurrency(p.unitPrice), 340, y, { width: 80, align: 'right' });
            const lineTotal = p.quantity * p.unitPrice;
            doc.text(fmtCurrency(lineTotal), 430, y, { width: 80, align: 'right' });
            partsTotal += lineTotal;
            y += 18;
        });

        doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.primary);
        doc.text('Total pièces :', 340, y + 5, { width: 80, align: 'right' });
        doc.text(fmtCurrency(partsTotal), 430, y + 5, { width: 80, align: 'right' });
        y += 30;
        drawHr(doc, y);
        y += 10;
    }

    // ── SIGNATURE ──
    if (intervention.signatureUrl) {
        if (y > 620) { doc.addPage(); y = 50; }
        doc.fontSize(11).font('Helvetica-Bold').fillColor(COLORS.primary)
            .text('SIGNATURE CLIENT', left, y);
        y += 18;
        try {
            const fs = require('fs');
            const path = require('path');
            const sigPath = path.join(process.cwd(), intervention.signatureUrl);
            if (fs.existsSync(sigPath)) {
                doc.image(sigPath, left, y, { width: 200 });
                y += 80;
            }
        } catch (_) {
            doc.fontSize(9).font('Helvetica').text('(signature enregistrée)', left, y);
            y += 15;
        }
    } else {
        if (y > 650) { doc.addPage(); y = 50; }
        doc.fontSize(9).font('Helvetica').fillColor(COLORS.muted)
            .text('Signature client :', left, y);
        doc.rect(left, y + 12, 250, 60).stroke(COLORS.muted);
    }

    // Footer
    const footerY = 780;
    doc.fontSize(8).font('Helvetica').fillColor(COLORS.muted)
        .text(`Document généré le ${fmtDate(new Date())} — ${(intervention as any).tenant?.name || ''}`, 50, footerY, { align: 'center', width: 495 });

    doc.end();
};
