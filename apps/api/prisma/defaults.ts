import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const DEFAULT_VENUES = [
  {
    slug: 'basketball',
    name: 'Basketball Court',
    description: 'Full-sized indoor basketball court with hardwood flooring and adjustable hoops.',
    capacity: 10,
    hourlyRate: 153,
    minimumHours: 1,
    amenities: ['court', 'scoreboard'],
    iconKey: 'basketball',
    gridColumn: 1,
    gridRow: 1,
    gridWidth: 4,
    gridHeight: 4,
    isReservable: true,
    isSystem: false,
    displayOrder: 1,
    isActive: true,
  },
  {
    slug: 'volleyball',
    name: 'Volleyball Court',
    description: 'Indoor volleyball court with regulation net height and padded flooring.',
    capacity: 12,
    hourlyRate: 120,
    minimumHours: 1,
    amenities: ['court', 'net'],
    iconKey: 'volleyball',
    gridColumn: 5,
    gridRow: 1,
    gridWidth: 4,
    gridHeight: 4,
    isReservable: true,
    isSystem: false,
    displayOrder: 2,
    isActive: true,
  },
  {
    slug: 'boxing',
    name: 'Boxing Ring',
    description: 'Professional boxing ring for sparring, pad work, and coached sessions.',
    capacity: 4,
    hourlyRate: 29,
    minimumHours: 1,
    amenities: ['ring', 'pads'],
    iconKey: 'boxing',
    gridColumn: 9,
    gridRow: 3,
    gridWidth: 3,
    gridHeight: 3,
    isReservable: true,
    isSystem: false,
    displayOrder: 3,
    isActive: true,
  },
  {
    slug: 'reception',
    name: 'Reception',
    description: 'Front desk for membership enquiries, towel service, and staff assistance.',
    capacity: 1,
    hourlyRate: null,
    minimumHours: 1,
    amenities: ['staffed', 'check-in'],
    iconKey: 'reception',
    gridColumn: 12,
    gridRow: 4,
    gridWidth: 3,
    gridHeight: 2,
    isReservable: false,
    isSystem: true,
    displayOrder: 4,
    isActive: true,
  },
  {
    slug: 'gym-front',
    name: 'Gym Area (Front)',
    description: 'Main strength floor with free weights, benches, and cable stations.',
    capacity: 30,
    hourlyRate: null,
    minimumHours: 1,
    amenities: ['strength', 'free-weights'],
    iconKey: 'gym-area',
    gridColumn: 1,
    gridRow: 7,
    gridWidth: 5,
    gridHeight: 3,
    isReservable: false,
    isSystem: true,
    displayOrder: 5,
    isActive: true,
  },
  {
    slug: 'gym-back',
    name: 'Gym Area (Back)',
    description: 'Functional training and conditioning zone for circuits and group work.',
    capacity: 30,
    hourlyRate: null,
    minimumHours: 1,
    amenities: ['functional', 'conditioning'],
    iconKey: 'gym-area',
    gridColumn: 6,
    gridRow: 7,
    gridWidth: 4,
    gridHeight: 3,
    isReservable: false,
    isSystem: true,
    displayOrder: 6,
    isActive: true,
  },
] as const satisfies ReadonlyArray<Prisma.VenueCreateInput>;

const ROLE_NAMES = ['USER', 'STAFF', 'ADMIN', 'COACH'] as const;
const ADMIN_EMAIL = 'sertfitadmin@gmail.com';
const ADMIN_PASSWORD = 'aNYTIMEaNYWHERE2@';

type VenueSeed = (typeof DEFAULT_VENUES)[number];

function arraysMatch(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasHeavyVenueCustomization(
  existingVenue: {
    name: string;
    description: string | null;
    capacity: number;
    hourlyRate: number | null;
    minimumHours: number;
    amenities: string[];
    iconKey: string;
    gridColumn: number;
    gridRow: number;
    gridWidth: number;
    gridHeight: number;
    isReservable: boolean;
    isSystem: boolean;
    displayOrder: number;
    isActive: boolean;
  },
  defaultVenue: VenueSeed,
) {
  let driftCount = 0;

  if (existingVenue.name !== defaultVenue.name) driftCount += 1;
  if ((existingVenue.description ?? null) !== (defaultVenue.description ?? null)) driftCount += 1;
  if (existingVenue.capacity !== defaultVenue.capacity) driftCount += 1;
  if ((existingVenue.hourlyRate ?? null) !== (defaultVenue.hourlyRate ?? null)) driftCount += 1;
  if (existingVenue.minimumHours !== defaultVenue.minimumHours) driftCount += 1;
  if (!arraysMatch(existingVenue.amenities, defaultVenue.amenities)) driftCount += 1;
  if (existingVenue.iconKey !== defaultVenue.iconKey) driftCount += 1;
  if (existingVenue.gridColumn !== defaultVenue.gridColumn) driftCount += 1;
  if (existingVenue.gridRow !== defaultVenue.gridRow) driftCount += 1;
  if (existingVenue.gridWidth !== defaultVenue.gridWidth) driftCount += 1;
  if (existingVenue.gridHeight !== defaultVenue.gridHeight) driftCount += 1;
  if (existingVenue.isReservable !== defaultVenue.isReservable) driftCount += 1;
  if (existingVenue.isSystem !== defaultVenue.isSystem) driftCount += 1;
  if (existingVenue.displayOrder !== defaultVenue.displayOrder) driftCount += 1;
  if (existingVenue.isActive !== defaultVenue.isActive) driftCount += 1;

  return driftCount >= 4;
}

async function ensureRoles(prisma: PrismaClient) {
  for (const name of ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function ensureAdmin(prisma: PrismaClient) {
  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' },
  });

  if (!adminRole) {
    throw new Error('ADMIN role missing after bootstrap');
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      email: ADMIN_EMAIL,
      role: { name: 'ADMIN' },
    },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const adminUser =
    existingAdmin ??
    (existingUser
      ? await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            password,
            roleId: adminRole.id,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            lastOtpVerifiedAt: new Date(),
            deletedAt: null,
          },
        })
      : await prisma.user.create({
          data: {
            email: ADMIN_EMAIL,
            password,
            roleId: adminRole.id,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            lastOtpVerifiedAt: new Date(),
          },
        }));

  await prisma.userProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id },
  });

  return adminUser;
}

async function ensureDefaultVenues(prisma: PrismaClient) {
  const existingVenues = await prisma.venue.findMany({
    where: {
      slug: {
        in: DEFAULT_VENUES.map((venue) => venue.slug),
      },
    },
  });

  const existingVenueBySlug = new Map(existingVenues.map((venue) => [venue.slug, venue]));

  let createdCount = 0;
  let preservedCount = 0;
  let customizedCount = 0;

  for (const venue of DEFAULT_VENUES) {
    const existingVenue = existingVenueBySlug.get(venue.slug);

    if (!existingVenue) {
      await prisma.venue.create({
        data: {
          slug: venue.slug,
          name: venue.name,
          description: venue.description,
          capacity: venue.capacity,
          hourlyRate: venue.hourlyRate,
          minimumHours: venue.minimumHours,
          amenities: [...venue.amenities],
          iconKey: venue.iconKey,
          gridColumn: venue.gridColumn,
          gridRow: venue.gridRow,
          gridWidth: venue.gridWidth,
          gridHeight: venue.gridHeight,
          isReservable: venue.isReservable,
          isSystem: venue.isSystem,
          displayOrder: venue.displayOrder,
          isActive: venue.isActive,
        },
      });
      createdCount += 1;
      continue;
    }

    if (hasHeavyVenueCustomization(existingVenue, venue)) {
      customizedCount += 1;
      continue;
    }

    preservedCount += 1;
  }

  return { createdCount, preservedCount, customizedCount };
}

export async function bootstrapDefaults(prisma: PrismaClient) {
  await ensureRoles(prisma);
  await ensureAdmin(prisma);
  const venueSummary = await ensureDefaultVenues(prisma);

  return {
    adminEmail: ADMIN_EMAIL,
    defaultVenueCount: DEFAULT_VENUES.length,
    ...venueSummary,
  };
}
