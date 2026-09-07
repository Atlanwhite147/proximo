import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SetupService } from '../src/setup/setup.service';
import { PrismaService } from '../src/prisma/prisma.service';

// argon2 est un module natif (propriétés non-configurables) : mocké via jest.mock.
jest.mock('argon2', () => ({
  argon2id: 'argon2id',
  hash: jest.fn().mockResolvedValue('hash-argon2'),
}));

/**
 * Tests unitaires de l'installation initiale (aucune base de données requise).
 */
describe('SetupService', () => {
  let setupService: SetupService;
  let prisma: {
    user: { count: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
    residence: { upsert: jest.Mock };
    syndicSettings: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'admin-1' }),
      },
      residence: {
        upsert: jest.fn().mockResolvedValue({ id: 'r-default', name: 'Les Lilas' }),
      },
      syndicSettings: {
        upsert: jest.fn().mockResolvedValue({ id: 1 }),
      },
      $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };
    setupService = new SetupService(prisma as unknown as PrismaService);
  });

  const validDto = {
    adminEmail: 'admin@residence.example',
    adminPassword: 'Motdepasse123',
    firstName: 'Admin',
    lastName: 'Principal',
    residenceName: 'Les Lilas',
  };

  it('isRequired → true quand aucun administrateur', async () => {
    prisma.user.count.mockResolvedValue(0);
    await expect(setupService.isRequired()).resolves.toBe(true);
  });

  it('isRequired → false dès qu’un administrateur existe', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(setupService.isRequired()).resolves.toBe(false);
  });

  it('complete crée l’admin ACTIVE + les réglages syndic (transaction)', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await setupService.complete(validDto);

    expect(result).toEqual({ adminEmail: 'admin@residence.example' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Création de l'utilisateur avec le rôle ADMIN et le statut ACTIVE.
    const createData = prisma.user.create.mock.calls[0][0].data;
    expect(createData.role).toBe('ADMIN');
    expect(createData.status).toBe('ACTIVE');
    expect(createData.neighborhood).toBe('Les Lilas');
    // Configuration de la résidence (singleton).
    const upsertArgs = prisma.syndicSettings.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({ id: 1 });
    expect(upsertArgs.create.residenceName).toBe('Les Lilas');
    expect(upsertArgs.create.agencyName).toBe('Les Lilas'); // repli sur le nom de résidence
    expect(upsertArgs.create.email).toBe('admin@residence.example'); // repli sur l'email admin
  });

  it('complete est verrouillé (403) si un admin existe déjà', async () => {
    prisma.user.count.mockResolvedValue(1);
    await expect(setupService.complete(validDto)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('complete refuse un email déjà utilisé (409)', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValue({ id: 'existant' });
    await expect(setupService.complete(validDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('complete utilise agence + email syndic renseignés', async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValue(null);

    await setupService.complete({
      ...validDto,
      agencyName: 'Agence Gerland',
      syndicEmail: 'syndic@agence.example',
    });

    const upsertArgs = prisma.syndicSettings.upsert.mock.calls[0][0];
    expect(upsertArgs.create.agencyName).toBe('Agence Gerland');
    expect(upsertArgs.create.email).toBe('syndic@agence.example');
  });
});
