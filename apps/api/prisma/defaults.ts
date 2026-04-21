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
    minimum_hours: 1,
    icon_key: 'basketball',
    grid_column: 9,
    grid_row: 1,
    grid_width: 6,
    grid_height: 4,
    is_reservable: true,
    display_order: 3,
    floor_id: 'floor-1',
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
    minimum_hours: 1,
    icon_key: 'boxing',
    grid_column: 3,
    grid_row: 3,
    grid_width: 5,
    grid_height: 4,
    is_reservable: true,
    display_order: 1,
    floor_id: 'floor-2',
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
    minimum_hours: 1,
    icon_key: 'yoga',
    grid_column: 4,
    grid_row: 2,
    grid_width: 8,
    grid_height: 6,
    is_reservable: true,
    display_order: 1,
    floor_id: 'floor-3',
    requires_subscription: true,
    is_active: true,
  },
] as const satisfies ReadonlyArray<Prisma.AmenityCreateInput>;

const ADMIN_EMAIL = 'sertfitadmin@gmail.com';
const ADMIN_PASSWORD = 'aNYTIMEaNYWHERE2@';
const ADMIN_FIRST_NAME = 'FitTrack';
const ADMIN_LAST_NAME = 'Admin';
const DEMO_MEMBER_EMAIL = 'member.demo.fittrack@gmail.com';
const DEMO_MEMBER_PASSWORD = 'Password1!';
const DEMO_MEMBER_FIRST_NAME = 'Demo';
const DEMO_MEMBER_LAST_NAME = 'Member';

type DefaultAmenity = (typeof DEFAULT_AMENITIES)[number];

type SeededEmailUser = {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  status?: UserStatus;
};

async function ensureEmailUser(prisma: PrismaClient, user: SeededEmailUser) {
  const credentialHash = await bcrypt.hash(user.password, 10);
  const verifiedAt = new Date();
  const existingIdentity = await prisma.authIdentity.findFirst({
    where: {
      provider: AuthProvider.email,
      identifier: user.email,
    },
    select: {
      id: true,
      user_id: true,
    },
  });

  if (existingIdentity) {
    const ensuredUser = await prisma.user.update({
      where: { id: existingIdentity.user_id },
      data: {
        role: user.role,
        status: user.status ?? UserStatus.active,
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
      where: { user_id: ensuredUser.id },
      update: {
        first_name: user.firstName,
        last_name: user.lastName,
      },
      create: {
        user_id: ensuredUser.id,
        first_name: user.firstName,
        last_name: user.lastName,
      },
    });

    await prisma.notificationPreference.upsert({
      where: { user_id: ensuredUser.id },
      update: {},
      create: { user_id: ensuredUser.id },
    });

    return ensuredUser;
  }

  return prisma.$transaction(async (tx) => {
    const ensuredUser = await tx.user.create({
      data: {
        role: user.role,
        status: user.status ?? UserStatus.active,
        email_verified_at: verifiedAt,
        qr_code_token: randomUUID(),
      },
    });

    await tx.authIdentity.create({
      data: {
        user_id: ensuredUser.id,
        provider: AuthProvider.email,
        identifier: user.email,
        credential_hash: credentialHash,
        verified_at: verifiedAt,
        is_primary: true,
      },
    });

    await tx.userProfile.create({
      data: {
        user_id: ensuredUser.id,
        first_name: user.firstName,
        last_name: user.lastName,
      },
    });

    await tx.notificationPreference.create({
      data: { user_id: ensuredUser.id },
    });

    return ensuredUser;
  });
}

async function ensureAdmin(prisma: PrismaClient) {
  return ensureEmailUser(prisma, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    role: UserRole.admin,
    firstName: ADMIN_FIRST_NAME,
    lastName: ADMIN_LAST_NAME,
  });
}

async function ensureDemoMember(prisma: PrismaClient) {
  return ensureEmailUser(prisma, {
    email: DEMO_MEMBER_EMAIL,
    password: DEMO_MEMBER_PASSWORD,
    role: UserRole.member,
    firstName: DEMO_MEMBER_FIRST_NAME,
    lastName: DEMO_MEMBER_LAST_NAME,
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
        data: {
          ...amenity,
          is_active: true,
        },
      });
      reactivatedCount += 1;
      continue;
    }

    await prisma.amenity.update({
      where: { id: existingAmenity.id },
      data: amenity,
    });
    existingCount += 1;
  }

  return { createdCount, existingCount, reactivatedCount };
}

export async function bootstrapDefaults(prisma: PrismaClient) {
  await ensureAdmin(prisma);
  await ensureDemoMember(prisma);
  const amenitySummary = await ensureDefaultAmenities(prisma);

  return {
    adminEmail: ADMIN_EMAIL,
    demoMemberEmail: DEMO_MEMBER_EMAIL,
    defaultAmenityCount: DEFAULT_AMENITIES.length,
    ...amenitySummary,
  };
}
