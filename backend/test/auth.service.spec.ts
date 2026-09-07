import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../src/email/email.service';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Module natif (propriétés non-configurables) : mocké via jest.mock,
// pas via spyOn (qui échoue avec "Cannot redefine property").
jest.mock('argon2', () => ({
  argon2id: 'argon2id',
  hash: jest.fn(),
  verify: jest.fn(),
}));
import * as argon2 from 'argon2';
const argon2Mock = argon2 as jest.Mocked<typeof argon2>;

/**
 * Tests unitaires de l'authentification (aucune base de données requise).
 */
describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: any;
    refreshToken: any;
    invitation: any;
    syndicSettings: any;
    residence: any;
  };
  let jwtService: JwtService;
  let emailService: EmailService;

  const now = new Date();
  const fakeUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'voisin@example.com',
    passwordHash: 'hash-argon2',
    firstName: 'Claire',
    lastName: 'Martin',
    neighborhood: 'Lyon 7e',
    role: 'USER',
    status: 'ACTIVE',
    totpSecret: null,
    totpEnabled: false,
    emailNotifications: true,
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(fakeUser),
        update: jest.fn().mockResolvedValue(fakeUser),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      invitation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      syndicSettings: {
        // Aucun code configuré par défaut : inscription libre (comportement initial).
        findUnique: jest.fn().mockResolvedValue(null),
      },
      residence: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'r-test',
          name: 'Les Cèdres',
          code: 'CEDRES-2026',
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt-token'),
    } as unknown as JwtService;
    emailService = {
      sendWelcome: jest.fn().mockResolvedValue(undefined),
    } as unknown as EmailService;
    authService = new AuthService(prisma as unknown as PrismaService, jwtService, emailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('hash le mot de passe avec argon2id et crée le compte', async () => {
      argon2Mock.hash.mockResolvedValue('hashed');
      prisma.user.findUnique.mockResolvedValue(null);

      const { user } = await authService.register({
        email: '  Voisin@Example.com ',
        password: 'Motdepasse123',
        firstName: 'Claire',
        lastName: 'Martin',
        residenceCode: 'cedres-2026',
      });

      expect(argon2Mock.hash).toHaveBeenCalledWith(
        'Motdepasse123',
        expect.objectContaining({ type: 'argon2id' }),
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'voisin@example.com', // normalisé en minuscules
            passwordHash: 'hashed',
          }),
        }),
      );
      expect(user.email).toBe('voisin@example.com');
      // Jamais de hash exposé dans la réponse.
      expect(user).not.toHaveProperty('passwordHash');
    });

    it("envoie un email de bienvenue après l'inscription", async () => {
      argon2Mock.hash.mockResolvedValue('hashed');
      prisma.user.findUnique.mockResolvedValue(null);
      await authService.register({
        email: 'voisin@example.com',
        password: 'Motdepasse123',
        firstName: 'Claire',
        lastName: 'Martin',
        residenceCode: 'cedres-2026',
      });
      expect(emailService.sendWelcome).toHaveBeenCalledWith('voisin@example.com', 'Claire');
    });

    it('refuse un email déjà utilisé', async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      await expect(
        authService.register({
          email: 'voisin@example.com',
          password: 'Motdepasse123',
          firstName: 'Claire',
          lastName: 'Martin',
        }),
      ).rejects.toThrow('Un compte existe déjà avec cet email');
    });
  });

  describe('login', () => {
    it('accepte un mot de passe correct', async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      argon2Mock.verify.mockResolvedValue(true);

      const { user } = await authService.login({
        email: 'voisin@example.com',
        password: 'Motdepasse123',
      });
      expect(user.id).toBe(fakeUser.id);
    });

    it('refuse un mot de passe incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue(fakeUser);
      argon2Mock.verify.mockResolvedValue(false);

      await expect(
        authService.login({ email: 'voisin@example.com', password: 'mauvais' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuse un compte inexistant (réponse identique, pas d’énumération)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        authService.login({ email: 'inconnu@example.com', password: 'Motdepasse123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuse un compte suspendu', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...fakeUser, status: 'SUSPENDED' });
      argon2Mock.verify.mockResolvedValue(true);
      await expect(
        authService.login({ email: 'voisin@example.com', password: 'Motdepasse123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
