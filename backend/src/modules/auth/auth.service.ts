import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole, OrgStatus } from '@prisma/client';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultAdminUser();
  }

  /**
   * Automatically initializes the default admin user in PostgreSQL if no users exist.
   */
  async ensureDefaultAdminUser() {
    try {
      const userCount = await this.prisma.user.count();
      if (userCount === 0) {
        this.logger.log('🔐 No users found in PostgreSQL. Initializing primary admin credentials...');
        const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@petsfolio.in').toLowerCase().trim();
        const defaultPassword = process.env.ADMIN_PASSWORD || 'Admin@Petsfolio2026!';
        const defaultOrgName = process.env.DEFAULT_ORG_NAME || 'Petsfolio Marketing';

        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        await this.prisma.$transaction(async (tx) => {
          let org = await tx.organization.findFirst();
          if (!org) {
            org = await tx.organization.create({
              data: {
                name: defaultOrgName,
                status: OrgStatus.ACTIVE,
              },
            });
          }

          const adminUser = await tx.user.create({
            data: {
              organizationId: org.id,
              email: defaultEmail,
              passwordHash,
              role: UserRole.OWNER,
            },
          });

          // Initialize wallet if not present
          const existingWallet = await tx.wallet.findFirst({ where: { organizationId: org.id } });
          if (!existingWallet) {
            await tx.wallet.create({
              data: {
                organizationId: org.id,
                currency: 'INR',
                balancePaise: 100000n, // 1000.00 INR
                reservedPaise: 0n,
              },
            });
          }

          this.logger.log(`✅ Default admin successfully created: ${adminUser.email}`);
        });
      } else {
        this.logger.log(`🔐 PostgreSQL User Directory active (${userCount} registered user(s)).`);
      }
    } catch (err: any) {
      this.logger.warn(`Database user verification deferred: ${err.message}`);
    }
  }

  /**
   * Registers a brand-new organization and owner user in PostgreSQL.
   */
  async registerOrganization(dto: {
    orgName: string;
    email: string;
    password: string;
  }) {
    const cleanEmail = dto.email.trim().toLowerCase();
    if (!cleanEmail || !dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long and email must be valid.');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email: cleanEmail },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.orgName?.trim() || 'My Organization',
          status: OrgStatus.ACTIVE,
        },
      });

      const user = await tx.user.create({
        data: {
          organizationId: org.id,
          email: cleanEmail,
          passwordHash,
          role: UserRole.OWNER,
        },
      });

      await tx.wallet.create({
        data: {
          organizationId: org.id,
          currency: 'INR',
          balancePaise: 100000n, // Default 1000 INR
          reservedPaise: 0n,
        },
      });

      const token = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        organizationId: org.id,
        role: user.role,
      });

      return {
        accessToken: token,
        organization: { id: org.id, name: org.name },
        user: { id: user.id, email: user.email, name: user.email.split('@')[0], role: user.role },
      };
    });
  }

  /**
   * Authenticates user against PostgreSQL with bcrypt hash comparison and issues real signed JWT.
   */
  async login(dto: { email: string; password: string }) {
    const cleanEmail = (dto.email || '').trim().toLowerCase();
    if (!cleanEmail || !dto.password) {
      throw new UnauthorizedException('Please enter both email and password.');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: cleanEmail },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });

    return {
      accessToken: token,
      organization: { id: user.organization.id, name: user.organization.name },
      user: {
        id: user.id,
        email: user.email,
        name: user.email.split('@')[0],
        role: user.role,
      },
    };
  }

  /**
   * Returns current authenticated user and organization.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true },
    });

    if (!user) {
      throw new UnauthorizedException('User session not found.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.email.split('@')[0],
      role: user.role,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
      },
    };
  }

  /**
   * Securely changes the user's password in PostgreSQL.
   */
  async changePassword(userId: string, oldPass: string, newPass: string) {
    if (!newPass || newPass.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters long.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const isMatch = await bcrypt.compare(oldPass, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match.');
    }

    const newHash = await bcrypt.hash(newPass, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { success: true, message: 'Password updated successfully.' };
  }
}
