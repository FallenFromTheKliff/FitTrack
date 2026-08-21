# FitTrack Backend Integration Report

## Port Map
| Service | Port | Command |
|---|---|---|
| NestJS API | 3001 | pnpm dev:api |
| Next.js Web | 8080 | pnpm dev:web |
| Expo Mobile | 8081 | pnpm dev:mobile |
| Prisma Studio | 5555 | pnpm db:studio |

## pnpm Commands
| Command | What it does |
|---|---|
| pnpm install | Install all workspace dependencies from monorepo root |
| pnpm dev | Start all apps in parallel via Turborepo |
| pnpm dev:api | Start NestJS API on :3001 with hot-reload |
| pnpm dev:web | Start Next.js web on :8080 |
| pnpm dev:mobile | Start Expo on :8081 |
| pnpm db:generate | Generate Prisma client from schema.prisma |
| pnpm db:migrate | Run pending Prisma migrations against the database |
| pnpm db:seed | Seed Role table: USER, STAFF, ADMIN, COACH |
| pnpm db:studio | Open Prisma Studio GUI at localhost:5555 |
| pnpm build | Build all apps via Turborepo |
| pnpm --filter @fittrack/web lint | Lint web app only |
| pnpm --filter @fittrack/web typecheck | Typecheck web app only |
| pnpm --filter @fittrack/mobile typecheck | Typecheck mobile app only |

## Prisma Tables (Partial Integration Scope)

### Role
| Column | Type | Notes |
|---|---|---|
| id | Int | Auto-increment PK |
| name | String | UNIQUE: USER, STAFF, ADMIN, COACH |

### User
| Column | Type | Notes |
|---|---|---|
| id | String | UUID PK |
| email | String | UNIQUE |
| password | String | bcrypt hashed, never returned to clients |
| phone_no | String? | nullable, Philippine format |
| roleId | Int | FK → Role.id |
| emailVerified | Boolean | default false |
| emailVerifiedAt | DateTime? | set on OTP success |
| phoneVerified | Boolean | default false |
| lastOtpVerifiedAt | DateTime? | OTP re-verification every 7 days |
| deletedAt | DateTime? | soft delete — null means active |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### UserProfile
| Column | Type | Notes |
|---|---|---|
| id | String | UUID PK |
| userId | String | UNIQUE FK → User.id |
| firstName | String? | |
| lastName | String? | |
| dateOfBirth | DateTime? | |
| gender | String? | |
| currentWeightKg | Float? | |
| heightCm | Float? | |
| fitnessGoal | String? | |
| membershipType | String | default "member" |

### OTP
| Column | Type | Notes |
|---|---|---|
| id | String | UUID PK |
| userId | String | FK → User.id |
| code | String | 6-digit numeric string |
| type | String | "email" or "phone" |
| expiresAt | DateTime | driven by OTP_EXPIRY_MINUTES env var |
| verified | Boolean | default false |
| createdAt | DateTime | |

### RefreshToken
| Column | Type | Notes |
|---|---|---|
| id | String | UUID PK |
| token | String | UNIQUE UUID v4 |
| userId | String | FK → User.id |
| expiresAt | DateTime | 7 days from creation |
| createdAt | DateTime | |

### Venue (mobile bookings)
| Column | Type | Notes |
|---|---|---|
| id | Int | Auto-increment PK |
| name | String | |
| description | String? | |
| capacity | Int | |
| hourlyRate | Float? | |
| minimumHours | Int | default 1 |
| amenities | String[] | PostgreSQL array |
| isActive | Boolean | default true |

### VenueBooking (mobile bookings)
| Column | Type | Notes |
|---|---|---|
| id | String | UUID PK |
| userId | String | FK → User.id |
| venueId | Int | FK → Venue.id |
| startTime | DateTime | ISO string from client |
| endTime | DateTime | computed by backend |
| durationHours | Int | minimum 1 |
| status | String | pending / confirmed / cancelled / completed |
| purpose | String? | optional |
| participants | Int? | optional |
| cancelledAt | DateTime? | |
| cancelReason | String? | |

## Access Control Summary
| Role | Web Access | Mobile Access |
|---|---|---|
| ADMIN | Full: login, member CRUD | Blocked — redirected to login |
| STAFF | Full: login, member read-only | Allowed: all tabs |
| USER | Blocked — redirected to login | Allowed: all tabs |
| COACH | Blocked — redirected to login | Allowed: all tabs |
