import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { decryptSecretIfEncrypted, encrypt, isEncryptedSecret } from '../src/utils/crypto';

type TokenStorageFormat = 'gcm' | 'legacy-cbc' | 'plaintext';

type TokenRow = {
    id: string;
    accessToken: string;
};

type MigrationCandidate = {
    model: 'WhatsAppConfig' | 'SystemPhoneNumber';
    id: string;
    format: TokenStorageFormat;
};

type MigrationSummary = {
    scanned: number;
    alreadyGcm: number;
    candidates: MigrationCandidate[];
    updated: number;
    unchanged: number;
    failed: number;
};

const APPLY_FLAG = '--apply';

export function classifyWhatsappToken(accessToken: string): TokenStorageFormat {
    if (accessToken.startsWith('v2:') && isEncryptedSecret(accessToken)) {
        return 'gcm';
    }

    if (isEncryptedSecret(accessToken)) {
        return 'legacy-cbc';
    }

    return 'plaintext';
}

export function shouldMigrateWhatsappToken(accessToken: string): boolean {
    return classifyWhatsappToken(accessToken) !== 'gcm';
}

export function migrateWhatsappTokenToGcm(accessToken: string): string {
    if (!shouldMigrateWhatsappToken(accessToken)) {
        return accessToken;
    }

    const plaintext = decryptSecretIfEncrypted(accessToken);
    return encrypt(plaintext);
}

function createEmptySummary(): MigrationSummary {
    return {
        scanned: 0,
        alreadyGcm: 0,
        candidates: [],
        updated: 0,
        unchanged: 0,
        failed: 0,
    };
}

function printUsage(): void {
    console.log('Usage: npm run migrate:whatsapp-tokens -- [--apply]');
    console.log('');
    console.log('Default mode is dry-run and only reports WhatsApp tokens that need migration.');
    console.log('Pass --apply to rewrite plaintext or legacy AES-CBC tokens as AES-256-GCM.');
}

async function inspectRows(
    rows: TokenRow[],
    model: MigrationCandidate['model'],
    summary: MigrationSummary
): Promise<void> {
    for (const row of rows) {
        summary.scanned += 1;
        const format = classifyWhatsappToken(row.accessToken);

        if (format === 'gcm') {
            summary.alreadyGcm += 1;
            continue;
        }

        summary.candidates.push({ model, id: row.id, format });
    }
}

async function applyWhatsAppConfigMigration(
    prisma: PrismaClient,
    row: TokenRow,
    summary: MigrationSummary
): Promise<void> {
    try {
        const migratedToken = migrateWhatsappTokenToGcm(row.accessToken);
        const result = await prisma.whatsAppConfig.updateMany({
            where: {
                id: row.id,
                accessToken: row.accessToken,
            },
            data: {
                accessToken: migratedToken,
            },
        });

        if (result.count === 1) {
            summary.updated += 1;
        } else {
            summary.unchanged += 1;
        }
    } catch (error) {
        summary.failed += 1;
        console.error(`[failed] WhatsAppConfig ${row.id}:`, error);
    }
}

async function applySystemPhoneNumberMigration(
    prisma: PrismaClient,
    row: TokenRow,
    summary: MigrationSummary
): Promise<void> {
    try {
        const migratedToken = migrateWhatsappTokenToGcm(row.accessToken);
        const result = await prisma.systemPhoneNumber.updateMany({
            where: {
                id: row.id,
                accessToken: row.accessToken,
            },
            data: {
                accessToken: migratedToken,
            },
        });

        if (result.count === 1) {
            summary.updated += 1;
        } else {
            summary.unchanged += 1;
        }
    } catch (error) {
        summary.failed += 1;
        console.error(`[failed] SystemPhoneNumber ${row.id}:`, error);
    }
}

async function runMigration(apply: boolean): Promise<MigrationSummary> {
    const prisma = new PrismaClient();
    const summary = createEmptySummary();

    try {
        const [whatsAppConfigs, systemPhoneNumbers] = await Promise.all([
            prisma.whatsAppConfig.findMany({
                select: {
                    id: true,
                    accessToken: true,
                },
            }),
            prisma.systemPhoneNumber.findMany({
                select: {
                    id: true,
                    accessToken: true,
                },
            }),
        ]);

        await inspectRows(whatsAppConfigs, 'WhatsAppConfig', summary);
        await inspectRows(systemPhoneNumbers, 'SystemPhoneNumber', summary);

        if (!apply) {
            return summary;
        }

        for (const row of whatsAppConfigs) {
            if (shouldMigrateWhatsappToken(row.accessToken)) {
                await applyWhatsAppConfigMigration(prisma, row, summary);
            }
        }

        for (const row of systemPhoneNumbers) {
            if (shouldMigrateWhatsappToken(row.accessToken)) {
                await applySystemPhoneNumberMigration(prisma, row, summary);
            }
        }

        return summary;
    } finally {
        await prisma.$disconnect();
    }
}

function printSummary(summary: MigrationSummary, apply: boolean): void {
    const mode = apply ? 'APPLY' : 'DRY-RUN';
    console.log(`WhatsApp token AES-GCM migration (${mode})`);
    console.log(`Scanned: ${summary.scanned}`);
    console.log(`Already AES-GCM: ${summary.alreadyGcm}`);
    console.log(`Candidates: ${summary.candidates.length}`);

    const byFormat = summary.candidates.reduce<Record<TokenStorageFormat, number>>(
        (acc, candidate) => {
            acc[candidate.format] += 1;
            return acc;
        },
        { gcm: 0, 'legacy-cbc': 0, plaintext: 0 }
    );

    console.log(`  Plaintext: ${byFormat.plaintext}`);
    console.log(`  Legacy AES-CBC: ${byFormat['legacy-cbc']}`);

    for (const candidate of summary.candidates) {
        console.log(`  - ${candidate.model} ${candidate.id} (${candidate.format})`);
    }

    if (apply) {
        console.log(`Updated: ${summary.updated}`);
        console.log(`Unchanged due to concurrent update: ${summary.unchanged}`);
        console.log(`Failed: ${summary.failed}`);
    } else if (summary.candidates.length > 0) {
        console.log('');
        console.log('No database rows were changed. Re-run with --apply to migrate these tokens.');
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        return;
    }

    const unknownArgs = args.filter((arg) => arg !== APPLY_FLAG);
    if (unknownArgs.length > 0) {
        console.error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
        printUsage();
        process.exit(1);
    }

    const apply = args.includes(APPLY_FLAG);
    const summary = await runMigration(apply);
    printSummary(summary, apply);

    if (summary.failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
