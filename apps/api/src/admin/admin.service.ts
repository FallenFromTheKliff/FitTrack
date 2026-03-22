import {BadRequestException, ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from 'prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import {CreateAdminDto, CreateStaffDto, CreateVenueDto, UpdateVenueDto, UpgradeToCoachDto} from './dto/admin.dto';

function toVenueSlug(value: string) {
    return value.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

@Injectable()
export class AdminService {
    constructor(private prisma: PrismaService) {}

    async createAdmin(dto: CreateAdminDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email }
        });

        if (existing) {
            throw new ConflictException('Email already exists');
        }

        const adminRole = await this.prisma.role.findUnique({
            where: { name: 'ADMIN' }
        });

        if (!adminRole) {
            throw new NotFoundException('ADMIN role not found');
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const admin = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                roleId: adminRole.id,
                emailVerified: true,
                emailVerifiedAt: new Date(),
                lastOtpVerifiedAt: new Date()
            }
        });

        await this.prisma.userProfile.create({
            data: { userId: admin.id },
        });

        const { password, ...adminWithoutPassword } = admin;

        return {
            message: 'Admin created successfully',
            admin: adminWithoutPassword
        };
    }

    async upgradeUserToCoach(dto: UpgradeToCoachDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: dto.userId },
            include: { coach: true, role: true }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.coach) {
            throw new ConflictException('User is already a coach');
        }

        const coachRole = await this.prisma.role.findUnique({
            where: { name: 'COACH' }
        });

        if (!coachRole) {
            throw new NotFoundException('COACH role not found');
        }

        await this.prisma.user.update({
            where: { id: dto.userId },
            data: { roleId: coachRole.id }
        });

        const coach = await this.prisma.coach.create({
            data: {
                userId: dto.userId,
                specialties: dto.specialties,
                bio: dto.bio,
                certifications: dto.certifications || [],
                yearsExperience: dto.yearsExperience,
                hourlyRate: dto.hourlyRate
            }
        });

        return {
            message: 'User upgraded to coach successfully',
            coach
        };
    }

    async softDeleteUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.deletedAt) {
            throw new BadRequestException('User is already deleted');
        }

        const deleted = await this.prisma.user.update({
            where: { id: userId },
            data: {
                deletedAt: new Date(),
            },
            select: {
                id: true,
                email: true,
                phone_no: true,
                deletedAt: true
            }
        });

        return {
            message: 'User soft deleted successfully',
            user: deleted
        };
    }

    async getAllDeletionRequests(status?: string) {
        const where = status ? { status } : {};

        const requests = await this.prisma.accountDeletionRequest.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone_no: true,
                        createdAt: true,
                        profile: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return {
            total: requests.length,
            requests,
        };
    }

    async approveDeletionRequest(
        requestId: string,
        reviewedBy: string,
        reviewNotes?: string,
    ) {
        const request = await this.prisma.accountDeletionRequest.findUnique({
            where: { id: requestId },
            include: { user: true },
        });

        if (!request) {
            throw new NotFoundException('Deletion request not found');
        }

        if (request.status !== 'PENDING') {
            throw new BadRequestException('Request already processed');
        }

        await this.prisma.accountDeletionRequest.update({
            where: { id: requestId },
            data: {
                status: 'APPROVED',
                reviewedBy,
                reviewedAt: new Date(),
                reviewNotes,
            },
        });

        await this.prisma.user.update({
            where: { id: request.userId },
            data: { deletedAt: new Date() },
        });

        return {
            message: 'User account deleted successfully',
            email: request.user.email,
        };
    }

    async rejectDeletionRequest(
        requestId: string,
        reviewedBy: string,
        reviewNotes?: string,
    ) {
        const request = await this.prisma.accountDeletionRequest.findUnique({
            where: { id: requestId },
        });

        if (!request) {
            throw new NotFoundException('Deletion request not found');
        }

        if (request.status !== 'PENDING') {
            throw new BadRequestException('Request already processed');
        }

        await this.prisma.accountDeletionRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                reviewedBy,
                reviewedAt: new Date(),
                reviewNotes: reviewNotes || 'Request rejected',
            },
        });

        return {
            message: 'Deletion request rejected',
        };
    }

    async getAllUsers() {
        const users = await this.prisma.user.findMany({
            include: {
                role: true,
                profile: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return users.map(({ password, ...user }) => user);
    }

    async getAllCoaches() {
        return await this.prisma.coach.findMany({
            include: {
                user: {
                    include: {
                        profile: true
                    }
                },
                availability: true
            },
            orderBy: {createdAt: 'desc'},
        });
    }

    async getAllStaff() {
        const staffRole = await this.prisma.role.findUnique({
            where: { name: 'STAFF' },
        });

        if (!staffRole) {
            return { total: 0, staff: [] };
        }

        const staff = await this.prisma.user.findMany({
            where: {
                roleId: staffRole.id,
                deletedAt: null,
            },
            select: {
                id: true,
                email: true,
                phone_no: true,
                emailVerified: true,
                phoneVerified: true,
                createdAt: true,
                role: true,
                profile: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return {
            total: staff.length,
            staff,
        };
    }

    async createStaff(dto: CreateStaffDto) {
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (existing) {
            throw new ConflictException('Email already registered');
        }

        const staffRole = await this.prisma.role.findUnique({
            where: { name: 'STAFF' },
        });

        if (!staffRole) {
            throw new NotFoundException(
                'STAFF role not found in database. Please run database seeding.',
            );
        }

        const hashedPassword = await bcrypt.hash(dto.password, 10);

        const staff = await this.prisma.user.create({
            data: {
                email: dto.email,
                password: hashedPassword,
                phone_no: dto.phone_no,
                roleId: staffRole.id,
                emailVerified: true,
                emailVerifiedAt: new Date(),
                lastOtpVerifiedAt: new Date(),
                phoneVerified: !!dto.phone_no,
            },
        });

        await this.prisma.userProfile.upsert({
            where: { userId: staff.id },
            update: {
                ...(dto.firstName && { firstName: dto.firstName }),
                ...(dto.lastName && { lastName: dto.lastName }),
            },
            create: {
                userId: staff.id,
                firstName: dto.firstName ?? null,
                lastName: dto.lastName ?? null,
            },
        });

        const staffWithProfile = await this.prisma.user.findUnique({
            where: { id: staff.id },
            include: { role: true, profile: true },
        });

        const { password, ...staffWithoutPassword } = staffWithProfile!;

        return {
            message: 'Staff account created successfully',
            staff: staffWithoutPassword,
        };
    }

    async upgradeStaffToAdmin(staffId: string) {
        const staff = await this.prisma.user.findUnique({
            where: { id: staffId },
            include: { role: true },
        });

        if (!staff) {
            throw new NotFoundException('Staff user not found');
        }

        if (staff.role.name !== 'STAFF') {
            throw new BadRequestException('User is not a staff member');
        }

        const adminRole = await this.prisma.role.findUnique({
            where: { name: 'ADMIN' },
        });

        if (!adminRole) {
            throw new NotFoundException('ADMIN role not found');
        }

        const updated = await this.prisma.user.update({
            where: { id: staffId },
            data: { roleId: adminRole.id },
            include: {
                role: true,
                profile: true,
            },
        });

        const { password, ...userWithoutPassword } = updated;

        return {
            message: 'Staff upgraded to admin successfully',
            user: userWithoutPassword,
        };
    }

    async downgradeAdminToStaff(adminId: string) {
        const admin = await this.prisma.user.findUnique({
            where: { id: adminId },
            include: { role: true },
        });

        if (!admin) {
            throw new NotFoundException('Admin user not found');
        }

        if (admin.role.name !== 'ADMIN') {
            throw new BadRequestException('User is not an admin');
        }

        const staffRole = await this.prisma.role.findUnique({
            where: { name: 'STAFF' },
        });

        if (!staffRole) {
            throw new NotFoundException('STAFF role not found');
        }

        const updated = await this.prisma.user.update({
            where: { id: adminId },
            data: { roleId: staffRole.id },
            include: {
                role: true,
                profile: true,
            },
        });

        const { password, ...userWithoutPassword } = updated;

        return {
            message: 'Admin downgraded to staff successfully',
            user: userWithoutPassword,
        };
    }

    async createVenue(dto: CreateVenueDto) {
        const venue = await this.prisma.venue.create({
            data: {
                name: dto.name,
                slug: dto.slug?.trim() || toVenueSlug(dto.name),
                description: dto.description,
                capacity: dto.capacity,
                hourlyRate: dto.hourlyRate,
                minimumHours: dto.minimumHours || 1,
                amenities: dto.amenities || [],
                iconKey: dto.iconKey || 'dumbbell',
                gridColumn: dto.gridColumn || 1,
                gridRow: dto.gridRow || 1,
                gridWidth: dto.gridWidth || 2,
                gridHeight: dto.gridHeight || 2,
                isReservable: dto.isReservable ?? true,
                isSystem: dto.isSystem ?? false,
                displayOrder: dto.displayOrder || 0
            }
        });

        return {
            message: 'Venue created successfully',
            venue,
        };
    }

    async updateVenue(id: number, dto: UpdateVenueDto) {
        const venue = await this.prisma.venue.findUnique({
            where: { id },
        });

        if (!venue) {
            throw new NotFoundException('Venue not found');
        }

        const updated = await this.prisma.venue.update({
            where: { id },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.slug && { slug: dto.slug.trim() || toVenueSlug(dto.name ?? venue.name) }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.capacity && { capacity: dto.capacity }),
                ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
                ...(dto.minimumHours && { minimumHours: dto.minimumHours }),
                ...(dto.amenities && { amenities: dto.amenities }),
                ...(dto.iconKey && { iconKey: dto.iconKey }),
                ...(dto.gridColumn !== undefined && { gridColumn: dto.gridColumn }),
                ...(dto.gridRow !== undefined && { gridRow: dto.gridRow }),
                ...(dto.gridWidth !== undefined && { gridWidth: dto.gridWidth }),
                ...(dto.gridHeight !== undefined && { gridHeight: dto.gridHeight }),
                ...(dto.isReservable !== undefined && { isReservable: dto.isReservable }),
                ...(dto.isSystem !== undefined && { isSystem: dto.isSystem }),
                ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            }
        });

        return {
            message: 'Venue updated successfully',
            venue: updated,
        };
    }

    async deleteVenue(id: number) {
        const venue = await this.prisma.venue.findUnique({
            where: { id }
        });

        if (!venue) {
            throw new NotFoundException('Venue not found');
        }

        if (venue.isSystem) {
            throw new BadRequestException('This venue is part of the core floor plan and cannot be removed');
        }

        await this.prisma.venue.update({
            where: { id },
            data: { isActive: false }
        });

        return {
            message: 'Venue deleted (marked inactive) successfully',
        };
    }

    async getPendingBookings() {
        return await this.prisma.venueBooking.findMany({
            where: {status: 'pending'},
            include: {
                user: {
                    include: {profile: true}
                },
                venue: true
            },
            orderBy: {createdAt: 'desc'}
        });
    }

    async confirmBooking(bookingId: string) {
        const booking = await this.prisma.venueBooking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.status !== 'pending') {
            throw new BadRequestException('Booking is not pending');
        }

        const updated = await this.prisma.venueBooking.update({
            where: { id: bookingId },
            data: { status: 'confirmed' },
        });

        return {
            message: 'Booking confirmed successfully',
            booking: updated,
        };
    }

    async rejectBooking(bookingId: string, reason?: string) {
        const booking = await this.prisma.venueBooking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.status !== 'pending') {
            throw new BadRequestException('Booking is not pending');
        }

        const updated = await this.prisma.venueBooking.update({
            where: { id: bookingId },
            data: { status: 'cancelled' },
        });

        return {
            message: 'Booking rejected successfully',
            booking: updated,
        };
    }
}