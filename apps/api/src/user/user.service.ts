import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  CreateProfileDto,
  UpdateProfileDto,
  UpdateUserDto,
} from './dto/user.dto';
import { CreateDeletionRequestDto } from './dto/deletion-request.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        role: true,
        coach: {
          include: {
            availability: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async createProfile(userId: string, dto: CreateProfileDto) {
    // Check if profile already exists
    const existingProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException(
        'Profile already exists. Use PATCH to update.',
      );
    }

    const profile = await this.prisma.userProfile.create({
      data: {
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        currentWeightKg: dto.currentWeightKg,
        heightCm: dto.heightCm,
        fitnessGoal: dto.fitnessGoal,
      },
    });

    return {
      message: 'Profile created successfully',
      profile,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found. Create one first.');
    }

    const updated = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.currentWeightKg && { currentWeightKg: dto.currentWeightKg }),
        ...(dto.heightCm && { heightCm: dto.heightCm }),
        ...(dto.fitnessGoal && { fitnessGoal: dto.fitnessGoal }),
        ...(dto.membershipType && { membershipType: dto.membershipType }),
      },
    });

    return {
      message: 'Profile updated successfully',
      profile: updated,
    };
  }

  async updateAccount(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness if updating
    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already in use');
      }
    }

    // Check phone uniqueness if updating
    if (dto.phone_no && dto.phone_no !== user.phone_no) {
      const existingPhone = await this.prisma.user.findFirst({
        where: { phone_no: dto.phone_no },
      });

      if (existingPhone) {
        throw new ConflictException('Phone number already in use');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.email && { email: dto.email, emailVerified: false }), // Require re-verification
        ...(dto.phone_no && { phone_no: dto.phone_no, phoneVerified: false }), // Require re-verification
      },
    });

    const { password, ...userWithoutPassword } = updated;

    return {
      message: 'Account updated successfully',
      user: userWithoutPassword,
    };
  }

  // Add after your existing methods, before the closing brace

  async requestAccountDeletion(userId: string, dto: CreateDeletionRequestDto) {
    // Check if user already has pending request
    const existing = await this.prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: 'pending',
      },
    });

    if (existing) {
      throw new ConflictException(
        'You already have a pending deletion request',
      );
    }

    const request = await this.prisma.accountDeletionRequest.create({
      data: {
        userId,
        reason: dto.reason,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            profile: true,
          },
        },
      },
    });

    return {
      message:
        'Account deletion request submitted. Admin/Staff will review shortly.',
      request,
    };
  }

  async getUserDeletionRequest(userId: string) {
    return await this.prisma.accountDeletionRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelDeletionRequest(userId: string) {
    const request = await this.prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: 'pending',
      },
    });

    if (!request) {
      throw new NotFoundException('No pending deletion request found');
    }

    await this.prisma.accountDeletionRequest.delete({
      where: { id: request.id },
    });

    return {
      message: 'Deletion request cancelled successfully',
    };
  }
}
