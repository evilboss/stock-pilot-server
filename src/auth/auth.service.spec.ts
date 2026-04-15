import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: { user: { findUnique: jest.Mock; update: jest.Mock } };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    isActive: true,
    role: { name: 'ADMIN' },
    refreshToken: null,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
        { provide: UsersService, useValue: {} },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw UnauthorizedException for invalid user', async () => {
    prismaService.user.findUnique.mockResolvedValue(null);
    await expect(service.validateUser('bad@email.com', 'pass')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException for wrong password', async () => {
    prismaService.user.findUnique.mockResolvedValue(mockUser);
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    await expect(service.validateUser(mockUser.email, 'wrongpass')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException for inactive user', async () => {
    prismaService.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
    await expect(service.validateUser(mockUser.email, 'pass')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
