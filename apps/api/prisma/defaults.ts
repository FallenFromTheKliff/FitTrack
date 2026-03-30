import {
  AmenityType,
  AuthProvider,
  Prisma,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const DEFAULT_AMENITIES = [
  {
    name: 'Basketball Court',
    type: AmenityType.basketball_court,
    description:
      'Full-sized indoor basketball court with hardwood flooring and adjustable hoops.',
    capacity: 10,
    hourly_rate: new Prisma.Decimal(153),
    requires_subscription: false,
    is_active: true,
  },
  {
    name: 'Boxing Ring',
    type: AmenityType.boxing_ring,
    description:
      'Professional boxing ring for sparring, pad work, and coached sessions.',
    capacity: 4,
    hourly_rate: new Prisma.Decimal(29),
    requires_subscription: false,
    is_active: true,
  },
  {
    name: 'Multi-Purpose Studio',
    type: AmenityType.other,
    description:
      'Flexible studio space for classes, warmups, and small-group training.',
    capacity: 16,
    hourly_rate: new Prisma.Decimal(75),
    requires_subscription: true,
    is_active: true,
  },
] as const satisfies ReadonlyArray<Prisma.AmenityCreateInput>;

const ADMIN_EMAIL = 'sertfitadmin@gmail.com';
const ADMIN_PASSWORD = 'aNYTIMEaNYWHERE2@';
const ADMIN_FIRST_NAME = 'FitTrack';
const ADMIN_LAST_NAME = 'Admin';

type DefaultAmenity = (typeof DEFAULT_AMENITIES)[number];

async function ensureAdmin(prisma: PrismaClient) {
  const credentialHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const verifiedAt = new Date();
  const existingIdentity = await prisma.authIdentity.findFirst({
    where: {
      provider: AuthProvider.email,
      identifier: ADMIN_EMAIL,
    },
    select: {
      id: true,
      user_id: true,
    },
  });

  if (existingIdentity) {
    const user = await prisma.user.update({
      where: { id: existingIdentity.user_id },
      data: {
        role: UserRole.admin,
        status: UserStatus.active,
        email_verified_at: verifiedAt,
        qr_code_token: randomUUID(),
      },
    });

    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        credential_hash: credentialHash,
        verified_at: verifiedAt,
        is_primary: true,
      },
    });

    await prisma.userProfile.upsert({
      where: { user_id: user.id },
      update: {
        first_name: ADMIN_FIRST_NAME,
        last_name: ADMIN_LAST_NAME,
      },
      create: {
        user_id: user.id,
        first_name: ADMIN_FIRST_NAME,
        last_name: ADMIN_LAST_NAME,
      },
    });

    await prisma.notificationPreference.upsert({
      where: { user_id: user.id },
      update: {},
      create: { user_id: user.id },
    });

    return user;
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        role: UserRole.admin,
        status: UserStatus.active,
        email_verified_at: verifiedAt,
        qr_code_token: randomUUID(),
      },
    });

    await tx.authIdentity.create({
      data: {
        user_id: user.id,
        provider: AuthProvider.email,
        identifier: ADMIN_EMAIL,
        credential_hash: credentialHash,
        verified_at: verifiedAt,
        is_primary: true,
      },
    });

    await tx.userProfile.create({
      data: {
        user_id: user.id,
        first_name: ADMIN_FIRST_NAME,
        last_name: ADMIN_LAST_NAME,
      },
    });

    await tx.notificationPreference.create({
      data: { user_id: user.id },
    });

    return user;
  });
}

async function ensureDefaultAmenities(prisma: PrismaClient) {
  const existingAmenities = await prisma.amenity.findMany({
    where: {
      name: {
        in: DEFAULT_AMENITIES.map((amenity) => amenity.name),
      },
    },
    select: {
      id: true,
      name: true,
      is_active: true,
    },
  });
  const existingAmenityByName = new Map(
    existingAmenities.map((amenity) => [amenity.name, amenity]),
  );

  let createdCount = 0;
  let existingCount = 0;
  let reactivatedCount = 0;

  for (const amenity of DEFAULT_AMENITIES) {
    const existingAmenity = existingAmenityByName.get(amenity.name);

    if (!existingAmenity) {
      await prisma.amenity.create({
        data: amenity,
      });
      createdCount += 1;
      continue;
    }

    if (!existingAmenity.is_active) {
      await prisma.amenity.update({
        where: { id: existingAmenity.id },
        data: { is_active: true },
      });
      reactivatedCount += 1;
      continue;
    }

    existingCount += 1;
  }

  return { createdCount, existingCount, reactivatedCount };
}

export async function bootstrapDefaults(prisma: PrismaClient) {
  await ensureAdmin(prisma);
  const amenitySummary = await ensureDefaultAmenities(prisma);

  return {
    adminEmail: ADMIN_EMAIL,
    defaultAmenityCount: DEFAULT_AMENITIES.length,
    ...amenitySummary,
  };
}
