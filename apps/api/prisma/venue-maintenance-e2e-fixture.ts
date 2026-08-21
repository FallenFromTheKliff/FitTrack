import { readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  AmenityType,
  AuthProvider,
  BookingStatus,
  EquipmentStatus,
  MembershipCardSource,
  MembershipCardStatus,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import Queue from 'bull';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'db',
  'fittrack-db',
  'fittrack-db-local',
]);
const FIXTURE_PREFIX = 'E2E Maintenance';
const FIXTURE_EMAIL = 'e2e.venue.maintenance@fittrack.test';
const FIXTURE_PASSWORD = 'E2EMaintenance!2026';
const FIXTURE_PATH = resolve(
  process.cwd(),
  '..',
  '..',
  '.artifacts',
  'venue-maintenance-e2e-fixture.json',
);
const DYNAMIC_SEED_MANIFEST_PATH = resolve(
  process.cwd(),
  '..',
  '..',
  '.artifacts',
  'dynamic-seed-manifest.json',
);
const IDS = {
  authIdentity: '00000000-0000-4000-8000-00000000e208',
  bookingCancel: '00000000-0000-4000-8000-00000000e205',
  bookingReschedule: '00000000-0000-4000-8000-00000000e204',
  membershipCard: '00000000-0000-4000-8000-00000000e20a',
  paymentCancel: '00000000-0000-4000-8000-00000000e207',
  paymentReschedule: '00000000-0000-4000-8000-00000000e206',
  profile: '00000000-0000-4000-8000-00000000e209',
  replacementVenue: '00000000-0000-4000-8000-00000000e203',
  sourceVenue: '00000000-0000-4000-8000-00000000e202',
  user: '00000000-0000-4000-8000-00000000e201',
} as const;

type SeedCredential = {
  email: string;
  label: string;
  password: string;
  role: string;
};

type FixtureManifest = {
  admin: Pick<SeedCredential, 'email' | 'password'>;
  bookingCancelId: string;
  bookingRescheduleId: string;
  createdAt: string;
  member: Pick<SeedCredential, 'email' | 'password'>;
  paymentCancelId: string;
  paymentRescheduleId: string;
  replacementVenueId: string;
  replacementVenueName: string;
  sourceVenueId: string;
  sourceVenueName: string;
  userId: string;
};

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the maintenance E2E fixture.');
}

function assertLocalOnly() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The maintenance E2E fixture is disabled in production.');
  }
  const databaseUrl = new URL(process.env.DATABASE_URL!);
  if (!LOCAL_HOSTS.has(databaseUrl.hostname.toLowerCase())) {
    throw new Error(
      `Refusing to run the maintenance E2E fixture against non-local host ${databaseUrl.hostname}.`,
    );
  }
}

assertLocalOnly();

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function fixtureDate(daysFromToday: number, hour: number) {
  const manilaNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }),
  );
  return new Date(
    Date.UTC(
      manilaNow.getFullYear(),
      manilaNow.getMonth(),
      manilaNow.getDate() + daysFromToday,
      hour - 8,
      0,
      0,
    ),
  );
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function removeLifecycleJobs() {
  const queue = new Queue('booking-lifecycle', {
    redis: process.env.REDIS_URL
      ? process.env.REDIS_URL
      : {
          host: process.env.REDIS_HOST || '127.0.0.1',
          password: process.env.REDIS_PASSWORD || undefined,
          port: Number(process.env.REDIS_PORT || 6379),
          ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
        },
  });
  try {
    for (const bookingId of [IDS.bookingReschedule, IDS.bookingCancel]) {
      for (const jobName of ['send-booking-reminder', 'check-no-show']) {
        const job = await queue.getJob(`${jobName}:${bookingId}`);
        await job?.remove();
      }
    }
  } finally {
    await queue.close();
  }
}

async function cleanupFixture() {
  await removeLifecycleJobs();

  const fixtureUser = await prisma.user.findUnique({
    where: { id: IDS.user },
    include: { auth_identities: true, profile: true },
  });
  const fixtureVenues = await prisma.amenity.findMany({
    where: { id: { in: [IDS.sourceVenue, IDS.replacementVenue] } },
  });
  if (
    fixtureUser &&
    (!fixtureUser.auth_identities.some(
      (identity) => identity.identifier === FIXTURE_EMAIL,
    ) ||
      fixtureUser.profile?.first_name !== 'E2E')
  ) {
    throw new Error(
      'Refusing to clean a user outside the maintenance fixture.',
    );
  }
  if (fixtureVenues.some((venue) => !venue.name.startsWith(FIXTURE_PREFIX))) {
    throw new Error(
      'Refusing to clean a venue outside the maintenance fixture.',
    );
  }

  await prisma.$transaction(async (transaction) => {
    const bookingIds = [IDS.bookingReschedule, IDS.bookingCancel];
    const venueIds = [IDS.sourceVenue, IDS.replacementVenue];
    await transaction.notification.deleteMany({ where: { user_id: IDS.user } });
    await transaction.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'AmenityBooking', entity_id: { in: bookingIds } },
          { entity_id: { in: venueIds } },
        ],
      },
    });
    await transaction.commerceCheckoutHold.deleteMany({
      where: {
        OR: [
          { user_id: IDS.user },
          { amenity_id: { in: venueIds } },
          { booking_id: { in: bookingIds } },
        ],
      },
    });
    await transaction.payment.deleteMany({
      where: {
        OR: [
          { id: { in: [IDS.paymentReschedule, IDS.paymentCancel] } },
          { user_id: IDS.user },
          { payable_type: PayableType.booking, payable_id: { in: bookingIds } },
        ],
      },
    });
    await transaction.amenityBooking.deleteMany({
      where: { id: { in: bookingIds }, user_id: IDS.user },
    });
    await transaction.membershipCard.deleteMany({
      where: { id: IDS.membershipCard, user_id: IDS.user },
    });
    await transaction.authIdentity.deleteMany({ where: { user_id: IDS.user } });
    await transaction.userProfile.deleteMany({ where: { user_id: IDS.user } });
    await transaction.notificationPreference.deleteMany({
      where: { user_id: IDS.user },
    });
    await transaction.user.deleteMany({ where: { id: IDS.user } });
    await transaction.amenity.deleteMany({ where: { id: { in: venueIds } } });
  });
  await rm(FIXTURE_PATH, { force: true });
}

async function seedAdminCredential() {
  const seed = await readJson<{ credentials: SeedCredential[] }>(
    DYNAMIC_SEED_MANIFEST_PATH,
  );
  const admin = seed?.credentials.find(
    (credential) => credential.role.toLowerCase() === 'admin',
  );
  if (!admin) {
    throw new Error(
      'Dynamic seed admin credential is missing. Run the local test seed first.',
    );
  }
  return { email: admin.email, password: admin.password };
}

async function applyFixture() {
  await cleanupFixture();
  const admin = await seedAdminCredential();
  const credentialHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);
  const now = new Date();
  const firstStart = fixtureDate(4, 10);
  const secondStart = fixtureDate(4, 12);
  const sourceVenueName = `${FIXTURE_PREFIX} Source`;
  const replacementVenueName = `${FIXTURE_PREFIX} Replacement`;

  await prisma.$transaction(async (transaction) => {
    await transaction.user.create({
      data: {
        id: IDS.user,
        email_verified_at: now,
        has_accepted_privacy: true,
        privacy_accepted_at: now,
        role: UserRole.member,
        status: UserStatus.active,
      },
    });
    await transaction.authIdentity.create({
      data: {
        credential_hash: credentialHash,
        id: IDS.authIdentity,
        identifier: FIXTURE_EMAIL,
        is_primary: true,
        provider: AuthProvider.email,
        user_id: IDS.user,
        verified_at: now,
      },
    });
    await transaction.userProfile.create({
      data: {
        first_name: 'E2E',
        id: IDS.profile,
        last_name: 'Maintenance Member',
        user_id: IDS.user,
      },
    });
    await transaction.notificationPreference.create({
      data: {
        booking_cancelled_email: false,
        booking_confirmed_email: false,
        booking_no_show_email: false,
        system_email: false,
        user_id: IDS.user,
        venue_booking_reminder_email: false,
      },
    });
    await transaction.membershipCard.create({
      data: {
        activated_at: now,
        id: IDS.membershipCard,
        price: new Prisma.Decimal(0),
        source: MembershipCardSource.admin_grant,
        status: MembershipCardStatus.active,
        user_id: IDS.user,
        verified_at: now,
      },
    });
    await transaction.amenity.createMany({
      data: [
        {
          capacity: 2,
          description: 'Disposable local-only maintenance workflow fixture.',
          display_order: 980,
          floor_id: 'floor-1',
          grid_column: 1,
          grid_height: 1,
          grid_row: 8,
          grid_width: 2,
          hourly_rate: new Prisma.Decimal(700),
          id: IDS.sourceVenue,
          is_active: true,
          is_mapped: true,
          is_reservable: true,
          name: sourceVenueName,
          requires_subscription: false,
          status: EquipmentStatus.available,
          type: AmenityType.other,
        },
        {
          capacity: 2,
          description: 'Disposable local-only replacement venue fixture.',
          display_order: 981,
          floor_id: 'floor-1',
          grid_column: 4,
          grid_height: 1,
          grid_row: 8,
          grid_width: 2,
          hourly_rate: new Prisma.Decimal(950),
          id: IDS.replacementVenue,
          is_active: true,
          is_mapped: true,
          is_reservable: true,
          name: replacementVenueName,
          requires_subscription: false,
          status: EquipmentStatus.available,
          type: AmenityType.other,
        },
      ],
    });
    await transaction.amenityBooking.createMany({
      data: [
        {
          amenity_id: IDS.sourceVenue,
          balance_amount: new Prisma.Decimal(0),
          balance_paid_at: now,
          downpayment_amount: new Prisma.Decimal(700),
          downpayment_paid_at: now,
          ends_at: new Date(firstStart.getTime() + 60 * 60 * 1000),
          id: IDS.bookingReschedule,
          notes: 'E2E maintenance reschedule fixture',
          starts_at: firstStart,
          status: BookingStatus.confirmed,
          total_amount: new Prisma.Decimal(700),
          user_id: IDS.user,
        },
        {
          amenity_id: IDS.sourceVenue,
          balance_amount: new Prisma.Decimal(0),
          balance_paid_at: now,
          downpayment_amount: new Prisma.Decimal(700),
          downpayment_paid_at: now,
          ends_at: new Date(secondStart.getTime() + 60 * 60 * 1000),
          id: IDS.bookingCancel,
          notes: 'E2E maintenance cancellation fixture',
          starts_at: secondStart,
          status: BookingStatus.confirmed,
          total_amount: new Prisma.Decimal(700),
          user_id: IDS.user,
        },
      ],
    });
    await transaction.payment.createMany({
      data: [
        {
          amount: new Prisma.Decimal(700),
          currency: 'PHP',
          id: IDS.paymentReschedule,
          idempotency_key: 'e2e-maintenance-reschedule-payment',
          payable_id: IDS.bookingReschedule,
          payable_type: PayableType.booking,
          payment_stage: PaymentStage.full,
          provider: PaymentProvider.paymongo,
          provider_ref: 'e2e-maintenance-reschedule-provider-ref',
          status: PaymentStatus.completed,
          user_id: IDS.user,
          verified_at: now,
        },
        {
          amount: new Prisma.Decimal(700),
          currency: 'PHP',
          id: IDS.paymentCancel,
          idempotency_key: 'e2e-maintenance-cancel-payment',
          payable_id: IDS.bookingCancel,
          payable_type: PayableType.booking,
          payment_stage: PaymentStage.full,
          provider: PaymentProvider.paymongo,
          provider_ref: 'e2e-maintenance-cancel-provider-ref',
          status: PaymentStatus.completed,
          user_id: IDS.user,
          verified_at: now,
        },
      ],
    });
  });

  const manifest: FixtureManifest = {
    admin,
    bookingCancelId: IDS.bookingCancel,
    bookingRescheduleId: IDS.bookingReschedule,
    createdAt: now.toISOString(),
    member: { email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD },
    paymentCancelId: IDS.paymentCancel,
    paymentRescheduleId: IDS.paymentReschedule,
    replacementVenueId: IDS.replacementVenue,
    replacementVenueName,
    sourceVenueId: IDS.sourceVenue,
    sourceVenueName,
    userId: IDS.user,
  };
  await writeFile(
    FIXTURE_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify({ status: 'APPLIED', ...manifest }));
}

async function inspectFixture() {
  const [sourceVenue, bookings, payments, audit, notifications] =
    await Promise.all([
      prisma.amenity.findUnique({ where: { id: IDS.sourceVenue } }),
      prisma.amenityBooking.findMany({
        where: { id: { in: [IDS.bookingReschedule, IDS.bookingCancel] } },
        orderBy: { id: 'asc' },
      }),
      prisma.payment.findMany({
        where: { id: { in: [IDS.paymentReschedule, IDS.paymentCancel] } },
        orderBy: { id: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: {
          entity: 'AmenityBooking',
          entity_id: { in: [IDS.bookingReschedule, IDS.bookingCancel] },
        },
        orderBy: { created_at: 'asc' },
      }),
      prisma.notification.findMany({
        where: { user_id: IDS.user },
        orderBy: { created_at: 'asc' },
      }),
    ]);
  console.log(
    JSON.stringify({
      audit: audit.map((entry) => ({
        action: entry.action,
        after: entry.after,
        entityId: entry.entity_id,
      })),
      bookings: bookings.map((booking) => ({
        amenityId: booking.amenity_id,
        cancellationReason: booking.cancellation_reason,
        endsAt: booking.ends_at,
        id: booking.id,
        startsAt: booking.starts_at,
        status: booking.status,
        totalAmount: booking.total_amount.toString(),
      })),
      notifications: notifications.map((notification) => ({
        title: notification.title,
        type: notification.type,
      })),
      payments: payments.map((payment) => ({
        amount: payment.amount.toString(),
        id: payment.id,
        payableId: payment.payable_id,
        status: payment.status,
      })),
      sourceVenueStatus: sourceVenue?.status ?? null,
    }),
  );
}

async function main() {
  const command = process.argv[2];
  if (command === 'apply') return applyFixture();
  if (command === 'cleanup') {
    await cleanupFixture();
    console.log(JSON.stringify({ status: 'CLEANED' }));
    return;
  }
  if (command === 'inspect') return inspectFixture();
  throw new Error(
    'Usage: venue-maintenance-e2e-fixture.ts <apply|inspect|cleanup>',
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
