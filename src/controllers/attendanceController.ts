import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { signUploadUrlIfNeeded } from '../utils/signedFileUrl';

const ATTENDANCE_DECISION_ACTIONS = ['APPROVE_EXCEPTION', 'REJECT', 'CONFIRM'] as const;

type AttendanceDecisionAction = typeof ATTENDANCE_DECISION_ACTIONS[number];

function isAttendanceDecisionAction(action: unknown): action is AttendanceDecisionAction {
    return typeof action === 'string' && ATTENDANCE_DECISION_ACTIONS.includes(action as AttendanceDecisionAction);
}

function normalizeReason(reason: unknown): string | null {
    if (typeof reason !== 'string') {
        return null;
    }

    const trimmed = reason.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
}

function buildManagerReason(prefix: string, reason: string | null, fallback: string | null): string {
    if (reason) {
        return `${prefix}: ${reason}`;
    }

    if (fallback) {
        return `${prefix}: ${fallback}`;
    }

    return prefix;
}

function gpsVerdictFromStatus(status: string): string {
    if (status === 'REJECTED') return 'REJECTED';
    if (status === 'WARNING') return 'WARNING';
    if (status === 'PENDING_GPS') return 'PENDING';
    return 'APPROVED';
}

/**
 * PATCH /api/attendance/:id/verdict
 * Allows a manager to decide a GPS attendance verdict without changing proof data.
 */
export const updateAttendanceVerdict = async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.user?.tenantId;
        const attendanceId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const action = req.body?.action;
        const reason = normalizeReason(req.body?.reason);

        if (!tenantId) {
            res.status(401).json({ error: 'Non autorisé - tenantId manquant' });
            return;
        }

        if (!isAttendanceDecisionAction(action)) {
            res.status(400).json({
                error: 'Action invalide. Utilisez APPROVE_EXCEPTION, REJECT ou CONFIRM.'
            });
            return;
        }

        const attendance = await prisma.attendance.findFirst({
            where: { id: attendanceId, tenantId },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        workProfile: true
                    }
                }
            }
        });

        if (!attendance) {
            res.status(404).json({ error: 'Pointage non trouvé' });
            return;
        }

        if (action === 'CONFIRM' && attendance.status === 'PENDING_GPS') {
            res.status(400).json({
                error: 'Impossible de confirmer un pointage en attente GPS. Validez exceptionnellement ou refusez.'
            });
            return;
        }

        const decidedAt = new Date();
        const data = (() => {
            if (action === 'APPROVE_EXCEPTION') {
                return {
                    status: 'PRESENT',
                    locationWarning: false,
                    gpsVerdict: 'APPROVED',
                    verdictReason: buildManagerReason(
                        'Validation exceptionnelle manager',
                        reason,
                        attendance.verdictReason || 'présence acceptée malgré le verdict GPS'
                    ),
                    gpsCheckedAt: attendance.gpsCheckedAt || decidedAt
                };
            }

            if (action === 'REJECT') {
                return {
                    status: 'REJECTED',
                    locationWarning: true,
                    gpsVerdict: 'REJECTED',
                    verdictReason: buildManagerReason(
                        'Refus manager',
                        reason,
                        attendance.verdictReason || 'présence refusée après contrôle'
                    ),
                    gpsCheckedAt: attendance.gpsCheckedAt || decidedAt
                };
            }

            return {
                status: attendance.status,
                locationWarning: attendance.locationWarning,
                gpsVerdict: attendance.gpsVerdict || gpsVerdictFromStatus(attendance.status),
                verdictReason: buildManagerReason(
                    'Verdict confirmé par le manager',
                    reason,
                    attendance.verdictReason || null
                ),
                gpsCheckedAt: attendance.gpsCheckedAt || decidedAt
            };
        })();

        const updated = await prisma.attendance.update({
            where: { id: attendance.id },
            data
        });

        res.status(200).json({
            success: true,
            attendance: {
                id: updated.id,
                employee: attendance.employee,
                status: updated.status,
                gpsVerdict: updated.gpsVerdict,
                verdictReason: updated.verdictReason,
                gpsCheckedAt: updated.gpsCheckedAt,
                proofReceivedAt: updated.proofReceivedAt,
                photoUrl: signUploadUrlIfNeeded(updated.photoUrl),
                latitude: updated.latitude,
                longitude: updated.longitude,
                distanceFromSite: updated.distanceFromSite,
                locationWarning: updated.locationWarning,
                siteId: updated.siteId
            }
        });
    } catch (error) {
        console.error('Error updating attendance verdict:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
};
