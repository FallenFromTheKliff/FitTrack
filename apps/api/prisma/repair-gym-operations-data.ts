import {
  AuthProvider,
  PayableType,
  PaymentStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';

const PASSWORD_HASH_ROUNDS = 12;
const COACH_PASSWORD = 'SeedCoach!2026';
const COACH_EMAIL_DOMAIN = 'fittrack.com';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to repair gym operations data.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type DirtyCoachProfile = NonNullable<
  Awaited<ReturnType<typeof findDirtyCoachProfiles>>
>[number];

const COACH_EMAIL_OVERRIDES = new Map<string, string>([
  ['casey floor', `seed.coach.casey@${COACH_EMAIL_DOMAIN}`],
  ['ivy navarro', `seed.coach.ivy@${COACH_EMAIL_DOMAIN}`],
  ['coach profile bravo', `seed.coach.bravo@${COACH_EMAIL_DOMAIN}`],
]);

function normalizeKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
}

function splitDisplayName(profile: DirtyCoachProfile) {
  const profileName = profile.display_name?.trim();
  const linkedProfile = profile.user?.profile;
  const fallbackName =
    [linkedProfile?.first_name, linkedProfile?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Coach Account';
  const sourceName = profileName || fallbackName;
  const [firstName, ...rest] = sourceName.split(/\s+/);

  return {
    displayName: sourceName,
    firstName: firstName || 'Coach',
    lastName: rest.join(' ') || 'Account',
  };
}

function repairQrToken(profileId: string) {
  return createHash('sha256')
    .update(`fittrack-coach-repair:${profileId}`)
    .digest('hex');
}

function preferredCoachEmail(profile: DirtyCoachProfile) {
  const { displayName } = splitDisplayName(profile);
  const override = COACH_EMAIL_OVERRIDES.get(normalizeKey(displayName));
  if (override) {
    return override;
  }

  const slug = slugify(displayName) || `profile.${profile.id.slice(0, 8)}`;
  return `seed.coach.${slug}@${COACH_EMAIL_DOMAIN}`;
}

async function findIdentityByEmail(email: string) {
  return prisma.authIdentity.findFirst({
    where: {
      provider: AuthProvider.email,
      identifier: email,
    },
    include: {
      user: {
        include: {
          coach_profile: true,
          profile: true,
        },
      },
    },
  });
}

async function findAvailableCoachEmail(profile: DirtyCoachProfile) {
  const baseEmail = preferredCoachEmail(profile);
  const [local, domain] = baseEmail.split('@');

  for (let index = 0; index < 20; index += 1) {
    const email =
      index === 0 ? baseEmail : `${local}.${index + 1}@${domain}`;
    const identity = await findIdentityByEmail(email);
    if (!identity) {
      return email;
    }

    if (
      identity.user.role === UserRole.coach &&
      (!identity.user.coach_profile ||
        identity.user.coach_profile.id === profile.id)
    ) {
      return email;
    }
  }

  throw new Error(`Unable to find a reusable coach email for ${baseEmail}.`);
}

async function ensureCoachUser(profile: DirtyCoachProfile) {
  const email = await findAvailableCoachEmail(profile);
  const identity = await findIdentityByEmail(email);
  if (identity?.user.role === UserRole.coach) {
    return { email, userId: identity.user.id };
  }

  const now = new Date();
  const { firstName, lastName } = splitDisplayName(profile);
  const credentialHash = await bcrypt.hash(COACH_PASSWORD, PASSWORD_HASH_ROUNDS);

  const user = await prisma.user.create({
    data: {
      role: UserRole.coach,
      status: UserStatus.active,
      email_verified_at: now,
      has_accepted_privacy: true,
      privacy_accepted_at: now,
      qr_code_token: repairQrToken(profile.id),
      auth_identities: {
        create: {
          provider: AuthProvider.email,
          identifier: email,
          credential_hash: credentialHash,
          is_primary: true,
          verified_at: now,
        },
      },
      profile: {
        create: {
          first_name: firstName,
          last_name: lastName,
          phone: profile.contact_phone ?? profile.user?.profile?.phone ?? null,
        },
      },
      notification_prefs: {
        create: {},
      },
    },
  });

  return { email, userId: user.id };
}

async function findDirtyCoachProfiles() {
  return prisma.coachProfile.findMany({
    where: {
      OR: [
        { user_id: null },
        {
          user: {
            role: {
              not: UserRole.coach,
            },
          },
        },
      ],
    },
    include: {
      user: {
        include: {
          auth_identities: true,
          profile: true,
        },
      },
    },
    orderBy: {
      created_at: 'asc',
    },
  });
}

async function repairCoachProfileOwnership() {
  const profiles = await findDirtyCoachProfiles();
  let repaired = 0;

  for (const profile of profiles) {
    const { displayName } = splitDisplayName(profile);
    const coachUser = await ensureCoachUser(profile);

    await prisma.coachProfile.update({
      where: { id: profile.id },
      data: {
        user_id: coachUser.userId,
        display_name: displayName,
        contact_email: coachUser.email,
      },
    });
    repaired += 1;
  }

  return repaired;
}

async function voidPaymentsCreatedBeforeCoachAcceptance() {
  return prisma.$executeRaw`
    UPDATE payments
       SET status = ${PaymentStatus.failed}::"PaymentStatus",
           rejection_reason = COALESCE(
             rejection_reason,
             'Voided by gym-operations repair: payment was created before coach/admin acceptance.'
           ),
           updated_at = NOW()
      FROM coach_appointments
     WHERE payments.payable_type = ${PayableType.coaching}::"PayableType"
       AND payments.payable_id = coach_appointments.id
       AND coach_appointments.status = 'pending_coach'::"AppointmentStatus"
       AND payments.status <> ${PaymentStatus.failed}::"PaymentStatus"
  `;
}

async function main() {
  const repairedCoachProfiles = await repairCoachProfileOwnership();
  const voidedPreApprovalPayments =
    await voidPaymentsCreatedBeforeCoachAcceptance();

  console.log(
    JSON.stringify(
      {
        repairedCoachProfiles,
        voidedPreApprovalPayments,
      },
      null,
      2,
    ),
  );
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
