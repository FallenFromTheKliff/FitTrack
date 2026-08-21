import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Attaches required roles to a route for RolesGuard to enforce.
// Usage: @Roles(UserRole.admin, UserRole.staff)

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
