import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PENDING_STATE = 'WAITING_MANAGER_SITE_GPS_APPROVAL';

type Action = 'create' | 'age';

type Options = {
    action?: Action;
    tenantId?: string;
    tenantName?: string;
    managerId?: string;
    managerPhone?: string;
    siteId?: string;
    siteName?: string;
    employeeId?: string;
    employeePhone?: string;
    latitude?: number;
    longitude?: number;
    detectedCountry?: string;
    ageHours?: number;
    apply: boolean;
    force: boolean;
};

function usage(): string {
    return [
        'QA helper for the site GPS proposal lifecycle (non-production only).',
        '',
        'Dry-run create:',
        '  npx ts-node scripts/qa-gps-proposal-lifecycle.ts --action create --tenant-id <id> --manager-id <id> --site-id <id> --employee-id <id> --lat 48.8584 --lng 2.2945',
        '',
        'Apply create aged enough for reminder:',
        '  npx ts-node scripts/qa-gps-proposal-lifecycle.ts --action create --tenant-id <id> --manager-id <id> --site-id <id> --employee-id <id> --lat 48.8584 --lng 2.2945 --age-hours 2 --apply',
        '',
        'Apply age existing pending proposal enough for expiration:',
        '  npx ts-node scripts/qa-gps-proposal-lifecycle.ts --action age --tenant-id <id> --manager-id <id> --age-hours 25 --apply',
        '',
        'Selectors may also use --tenant-name, --manager-phone, --site-name, --employee-phone.',
        'Environment fallbacks: QA_GPS_ACTION, QA_GPS_TENANT_ID, QA_GPS_MANAGER_ID, QA_GPS_SITE_ID, QA_GPS_EMPLOYEE_ID, QA_GPS_LAT, QA_GPS_LNG, QA_GPS_AGE_HOURS.',
        '',
        'Safety: dry-run by default, requires --apply to write, refuses NODE_ENV=production.'
    ].join('\n');
}

function readArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const inline = process.argv.find(arg => arg.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);

    const index = process.argv.indexOf(`--${name}`);
    if (index >= 0) return process.argv[index + 1];

    return undefined;
}

function hasFlag(name: string): boolean {
    return process.argv.includes(`--${name}`);
}

function parseNumber(value: string | undefined, label: string): number | undefined {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${label} must be a finite number.`);
    }
    return parsed;
}

function env(name: string): string | undefined {
    const value = process.env[name];
    return value && value.trim() ? value.trim() : undefined;
}

function parseOptions(): Options {
    const rawAction = readArg('action') || env('QA_GPS_ACTION');
    const action = rawAction === 'create' || rawAction === 'age' ? rawAction : undefined;

    if (rawAction && !action) {
        throw new Error('--action must be "create" or "age".');
    }

    return {
        action,
        tenantId: readArg('tenant-id') || env('QA_GPS_TENANT_ID'),
        tenantName: readArg('tenant-name') || env('QA_GPS_TENANT_NAME'),
        managerId: readArg('manager-id') || env('QA_GPS_MANAGER_ID'),
        managerPhone: readArg('manager-phone') || env('QA_GPS_MANAGER_PHONE'),
        siteId: readArg('site-id') || env('QA_GPS_SITE_ID'),
        siteName: readArg('site-name') || env('QA_GPS_SITE_NAME'),
        employeeId: readArg('employee-id') || env('QA_GPS_EMPLOYEE_ID'),
        employeePhone: readArg('employee-phone') || env('QA_GPS_EMPLOYEE_PHONE'),
        latitude: parseNumber(readArg('lat') || env('QA_GPS_LAT'), '--lat'),
        longitude: parseNumber(readArg('lng') || readArg('lon') || env('QA_GPS_LNG'), '--lng'),
        detectedCountry: readArg('detected-country') || env('QA_GPS_DETECTED_COUNTRY'),
        ageHours: parseNumber(readArg('age-hours') || env('QA_GPS_AGE_HOURS'), '--age-hours'),
        apply: hasFlag('apply') || env('QA_GPS_APPLY') === '1',
        force: hasFlag('force') || env('QA_GPS_FORCE') === '1'
    };
}

function requireOne(label: string, first?: string, second?: string): void {
    if (!first && !second) {
        throw new Error(`Missing ${label}.`);
    }
}

function assertNonProduction(): void {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Refusing to run in production (NODE_ENV=production).');
    }
}

function sharedAtFromAge(ageHours: number | undefined): Date {
    const hours = ageHours ?? 0;
    if (hours < 0) {
        throw new Error('--age-hours must be >= 0.');
    }
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function jsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
}

async function findTenant(options: Options) {
    requireOne('tenant selector (--tenant-id or --tenant-name)', options.tenantId, options.tenantName);

    const tenant = options.tenantId
        ? await prisma.tenant.findUnique({ where: { id: options.tenantId } })
        : await prisma.tenant.findFirst({ where: { name: options.tenantName } });

    if (!tenant) throw new Error('Tenant not found.');
    return tenant;
}

async function findManager(tenantId: string, options: Options) {
    requireOne('manager selector (--manager-id or --manager-phone)', options.managerId, options.managerPhone);

    const manager = await prisma.employee.findFirst({
        where: {
            tenantId,
            role: 'MANAGER',
            ...(options.managerId ? { id: options.managerId } : { phoneNumber: options.managerPhone })
        }
    });

    if (!manager) throw new Error('Manager not found in tenant.');
    return manager;
}

async function findSite(tenantId: string, options: Options) {
    requireOne('site selector (--site-id or --site-name)', options.siteId, options.siteName);

    const site = await prisma.site.findFirst({
        where: {
            tenantId,
            ...(options.siteId ? { id: options.siteId } : { name: options.siteName })
        }
    });

    if (!site) throw new Error('Site not found in tenant.');
    return site;
}

async function findEmployee(tenantId: string, options: Options) {
    requireOne('employee selector (--employee-id or --employee-phone)', options.employeeId, options.employeePhone);

    const employee = await prisma.employee.findFirst({
        where: {
            tenantId,
            ...(options.employeeId ? { id: options.employeeId } : { phoneNumber: options.employeePhone })
        }
    });

    if (!employee) throw new Error('Employee not found in tenant.');
    return employee;
}

async function createProposal(options: Options): Promise<void> {
    if (options.latitude === undefined || options.longitude === undefined) {
        throw new Error('Create requires --lat and --lng.');
    }

    const tenant = await findTenant(options);
    const [manager, site, employee] = await Promise.all([
        findManager(tenant.id, options),
        findSite(tenant.id, options),
        findEmployee(tenant.id, options)
    ]);

    if (manager.conversationState && manager.conversationState !== PENDING_STATE && !options.force) {
        throw new Error(`Manager already has conversationState=${manager.conversationState}. Use --force to overwrite.`);
    }

    if (manager.conversationState === PENDING_STATE && !options.force) {
        throw new Error('Manager already has a pending GPS proposal. Use --force to overwrite.');
    }

    const sharedAt = sharedAtFromAge(options.ageHours);
    const proposal = {
        siteId: site.id,
        siteName: site.name,
        siteCountry: site.country,
        latitude: options.latitude,
        longitude: options.longitude,
        detectedCountry: options.detectedCountry || null,
        providerEmployeeId: employee.id,
        providerName: employee.name || null,
        providerPhone: employee.phoneNumber,
        sharedAt: sharedAt.toISOString()
    };

    console.log('Will create pending GPS proposal:');
    console.log(JSON.stringify({
        tenant: { id: tenant.id, name: tenant.name },
        manager: { id: manager.id, name: manager.name, phoneNumber: manager.phoneNumber },
        site: { id: site.id, name: site.name, country: site.country },
        employee: { id: employee.id, name: employee.name, phoneNumber: employee.phoneNumber },
        proposal
    }, null, 2));

    if (!options.apply) {
        console.log('\nDry-run only. Re-run with --apply to write.');
        return;
    }

    await prisma.$transaction([
        prisma.employee.update({
            where: { id: manager.id },
            data: {
                conversationState: PENDING_STATE,
                tempExpenseData: proposal
            }
        }),
        prisma.onboardingEvent.create({
            data: {
                tenantId: tenant.id,
                employeeId: employee.id,
                type: 'SITE_GPS_POSITION_SHARED',
                metadata: {
                    source: 'QA_SCRIPT',
                    siteId: site.id,
                    siteName: site.name,
                    managerId: manager.id,
                    latitude: options.latitude,
                    longitude: options.longitude,
                    siteCountry: site.country,
                    detectedCountry: options.detectedCountry || null,
                    sharedAt: sharedAt.toISOString()
                }
            }
        })
    ]);

    console.log('\nApplied. Pending proposal is ready.');
}

async function ageProposal(options: Options): Promise<void> {
    if (options.ageHours === undefined) {
        throw new Error('Age requires --age-hours.');
    }

    const tenant = await findTenant(options);
    const manager = await findManager(tenant.id, options);

    if (manager.conversationState !== PENDING_STATE) {
        throw new Error(`Manager is not pending GPS approval (conversationState=${manager.conversationState || 'null'}).`);
    }

    const current = jsonObject(manager.tempExpenseData);
    const sharedAt = sharedAtFromAge(options.ageHours);
    const aged = {
        ...current,
        sharedAt: sharedAt.toISOString()
    };

    console.log('Will age pending GPS proposal:');
    console.log(JSON.stringify({
        tenant: { id: tenant.id, name: tenant.name },
        manager: { id: manager.id, name: manager.name, phoneNumber: manager.phoneNumber },
        oldSharedAt: current.sharedAt || manager.updatedAt.toISOString(),
        newSharedAt: aged.sharedAt,
        pendingData: aged
    }, null, 2));

    if (!options.apply) {
        console.log('\nDry-run only. Re-run with --apply to write.');
        return;
    }

    await prisma.employee.update({
        where: { id: manager.id },
        data: {
            tempExpenseData: aged as Prisma.InputJsonObject
        }
    });

    console.log('\nApplied. Pending proposal sharedAt was aged.');
}

async function main(): Promise<void> {
    if (hasFlag('help') || hasFlag('h')) {
        console.log(usage());
        return;
    }

    assertNonProduction();

    const options = parseOptions();
    if (!options.action) {
        throw new Error('Missing --action create|age.\n\n' + usage());
    }

    if (options.action === 'create') {
        await createProposal(options);
        return;
    }

    await ageProposal(options);
}

main()
    .catch(error => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
