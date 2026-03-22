import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const DEFAULT_VENUES = [
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
    isActive: true
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
    isActive: true
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
    isActive: true
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
    isActive: true
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
    isActive: true
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
    isActive: true
  }
] as const;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const ADMIN_EMAIL = 'sertfitadmin@gmail.com';
const ADMIN_PASSWORD = 'aNYTIMEaNYWHERE2@';

async function main() {
  const roles = ['USER', 'STAFF', 'ADMIN', 'COACH'];
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: 'ADMIN' }
  });

  if (!adminRole) {
    throw new Error('ADMIN role missing after seed');
  }

  const existingAdmin = await prisma.user.findFirst({
    where: {
      email: ADMIN_EMAIL,
      role: { name: 'ADMIN' }
    }
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL }
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
            deletedAt: null
          }
        })
      : await prisma.user.create({
          data: {
            email: ADMIN_EMAIL,
            password,
            roleId: adminRole.id,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            lastOtpVerifiedAt: new Date()
          }
        }));

  await prisma.userProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id }
  });

  for (const venue of DEFAULT_VENUES) {
    await prisma.venue.upsert({
      where: { slug: venue.slug },
      update: {
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
        isActive: venue.isActive
      },
      create: {
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
        isActive: venue.isActive
      }
    });
  }

  console.log(`[seed] admin ensured for ${ADMIN_EMAIL}`);
  console.log(`[seed] ensured ${DEFAULT_VENUES.length} default venues`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());