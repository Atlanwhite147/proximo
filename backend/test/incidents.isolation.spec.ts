import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  IncidentActor,
  IncidentsService,
  RETENTION_DAYS,
} from '../src/incidents/incidents.service';

/**
 * Isolation entre résidences sur le module des signalements.
 * Correctifs du 18/10/2026 : la clôture, la réouverture, le détail public, le
 * téléchargement de pièce jointe et la liste des signalements appliquent
 * désormais un contrôle de résidence relu EN BASE (jamais depuis le jeton).
 */
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const fsPromises = jest.requireMock('fs/promises') as {
  mkdir: jest.Mock;
  unlink: jest.Mock;
  writeFile: jest.Mock;
};

const INCIDENT_R1 = {
  id: 'i1',
  title: 'Fuite dans la cage d’escalier',
  category: 'WATER_LEAK',
  description: 'Ça coule sous la boîte aux lettres',
  status: 'OPEN',
  userId: 'u1',
  residenceId: 'r1',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  attachments: [] as Array<{ id: string; filename: string; path: string; size: number }>,
};

const USERS: Record<
  string,
  { id: string; role: string; status: string; residenceId: string | null }
> = {
  u1: { id: 'u1', role: 'USER', status: 'ACTIVE', residenceId: 'r1' },
  u2: { id: 'u2', role: 'USER', status: 'ACTIVE', residenceId: 'r2' },
  a2: { id: 'a2', role: 'ADMIN', status: 'ACTIVE', residenceId: 'r2' },
  a1: { id: 'a1', role: 'ADMIN', status: 'ACTIVE', residenceId: 'r1' },
  sup: { id: 'sup', role: 'SUPERADMIN', status: 'ACTIVE', residenceId: null },
  sans: { id: 'sans', role: 'USER', status: 'ACTIVE', residenceId: null },
};

const A_R1: IncidentActor = { id: 'u1', role: 'USER', residenceId: 'r1' };
const A_R2: IncidentActor = { id: 'u2', role: 'USER', residenceId: 'r2' };
const ADMIN_R2: IncidentActor = { id: 'a2', role: 'ADMIN', residenceId: 'r2' };
const ADMIN_R1: IncidentActor = { id: 'a1', role: 'ADMIN', residenceId: 'r1' };
const SUPER: IncidentActor = { id: 'sup', role: 'SUPERADMIN', residenceId: null };
const SANS_RESIDENCE: IncidentActor = { id: 'sans', role: 'USER', residenceId: null };

function makeService(incident: unknown = INCIDENT_R1) {
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(USERS[where.id] ?? null),
      ),
    },
    incidentEvent: { create: jest.fn().mockResolvedValue({ id: 'ev1' }) },
    incident: {
      findUnique: jest.fn().mockResolvedValue(incident),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...(incident as object), ...data }),
        ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const emailService = {
    sendIncidentStatusUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const service = new IncidentsService(prisma as never, emailService as never);
  return { service, prisma, emailService };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Clôture et réouverture d’un signalement', () => {
  it('autorise un habitant de la même résidence', async () => {
    const { service, prisma } = makeService();
    const incident = await service.resolve('i1', A_R1);
    expect(incident).toMatchObject({ status: 'RESOLVED' });
    expect(prisma.incident.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { status: 'RESOLVED' },
    });
  });

  it('refuse un habitant d’une autre résidence, sans rien modifier', async () => {
    const { service, prisma } = makeService();
    await expect(service.resolve('i1', A_R2)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  it('refuse un administrateur d’une autre résidence', async () => {
    const { service, prisma } = makeService();
    await expect(service.resolve('i1', ADMIN_R2)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  it('autorise un administrateur de la résidence concernée', async () => {
    const { service } = makeService();
    await expect(service.resolve('i1', ADMIN_R1)).resolves.toMatchObject({
      status: 'RESOLVED',
    });
  });

  it('refuse la réouverture d’un signalement d’une autre résidence', async () => {
    const { service, prisma } = makeService({ ...INCIDENT_R1, status: 'RESOLVED' });
    await expect(service.reopen('i1', A_R2)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  it('autorise le superadministrateur', async () => {
    const { service } = makeService();
    await expect(service.resolve('i1', SUPER)).resolves.toMatchObject({ status: 'RESOLVED' });
  });
});

describe('Lecture du détail et des pièces jointes', () => {
  it('refuse le détail public à une autre résidence', async () => {
    const { service } = makeService();
    await expect(service.findPublic('i1', A_R2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('autorise le détail public dans la même résidence', async () => {
    const { service } = makeService();
    await expect(service.findPublic('i1', A_R1)).resolves.toMatchObject({ id: 'i1' });
  });

  it('refuse le détail complet à un administrateur d’une autre résidence', async () => {
    const { service } = makeService();
    await expect(service.findForUser('i1', ADMIN_R2)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse l’accès quand le compte est inactif', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      role: 'USER',
      status: 'SUSPENDED',
      residenceId: 'r1',
    });
    await expect(service.resolve('i1', A_R2)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Liste des signalements', () => {
  it('ne renvoie rien pour un compte sans résidence (fin de l’échec ouvert)', async () => {
    const { service, prisma } = makeService();
    await expect(service.listPublic(SANS_RESIDENCE)).resolves.toEqual([]);
    expect(prisma.incident.findMany).not.toHaveBeenCalled();
  });

  it('filtre sur la résidence du compte', async () => {
    const { service, prisma } = makeService();
    await service.listPublic(A_R1);
    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { residenceId: 'r1' } }),
    );
  });

  it('ne filtre pas pour un superadministrateur', async () => {
    const { service, prisma } = makeService();
    await service.listPublic(SUPER);
    expect(prisma.incident.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe('Signalement sans résidence (données antérieures)', () => {
  it('reste accessible à son auteur et au superadministrateur seulement', async () => {
    const legacy = { ...INCIDENT_R1, residenceId: null };
    const { service } = makeService(legacy);
    await expect(service.findPublic('i1', A_R1)).resolves.toMatchObject({ id: 'i1' });
    await expect(service.findPublic('i1', A_R2)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.findPublic('i1', SUPER)).resolves.toMatchObject({ id: 'i1' });
  });
});

describe('Purge des dossiers clos', () => {
  it('ne supprime rien sans confirmation et se contente de compter', async () => {
    const { service, prisma } = makeService();
    prisma.incident.findMany.mockResolvedValue([
      { ...INCIDENT_R1, status: 'RESOLVED', attachments: [] },
      { ...INCIDENT_R1, id: 'i2', status: 'RESOLVED', attachments: [] },
    ]);
    const result = await service.purgeResolvedIncidents(SUPER, { confirm: false });
    expect(result).toMatchObject({ eligible: 2, purged: 0, archivePath: null });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
    expect(prisma.incident.deleteMany).not.toHaveBeenCalled();
  });

  it('archive avant de supprimer quand la purge est confirmée', async () => {
    const { service, prisma } = makeService();
    prisma.incident.findMany.mockResolvedValue([
      {
        ...INCIDENT_R1,
        status: 'RESOLVED',
        attachments: [{ filename: 'photo.jpg', path: 'uuid.jpg', size: 10 }],
      },
    ]);
    const result = await service.purgeResolvedIncidents(SUPER, { confirm: true });
    expect(fsPromises.writeFile).toHaveBeenCalledTimes(1);
    const [archivePath, content] = fsPromises.writeFile.mock.calls[0];
    expect(String(archivePath)).toContain('signalements-archive-');
    expect(String(content)).toContain('photo.jpg');
    expect(prisma.incident.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['i1'] } },
    });
    expect(result).toMatchObject({ eligible: 1, purged: 1 });
    expect(result.archivePath).toContain('signalements-archive-');
  });

  it('applique la conservation recommandée par défaut', async () => {
    const { service, prisma } = makeService();
    await service.purgeResolvedIncidents(ADMIN_R1, { confirm: false });
    const call = prisma.incident.findMany.mock.calls[0][0] as {
      where: { updatedAt: { lt: Date } };
    };
    const days = Math.round(
      (Date.now() - call.where.updatedAt.lt.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(days).toBe(RETENTION_DAYS);
  });

  it('limite la purge à la résidence de l’administrateur', async () => {
    const { service, prisma } = makeService();
    await service.purgeResolvedIncidents(ADMIN_R1, { confirm: false });
    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ residenceId: 'r1' }),
      }),
    );
  });

  it('refuse la purge à un habitant', async () => {
    const { service } = makeService();
    await expect(service.purgeResolvedIncidents(A_R1, { confirm: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
