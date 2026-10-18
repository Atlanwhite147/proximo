import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { IncidentsService } from '../src/incidents/incidents.service';
import { CommentsService } from '../src/comments/comments.service';
import { AgenciesService } from '../src/agencies/agencies.service';

/**
 * Comptes agence (rôle AGENCE) : périmètre de résidences, journal d'audit,
 * référence de dossier et badge affiché à côté du nom de l'auteur.
 */
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const INCIDENT_R1 = {
  id: 'i1',
  title: 'Fuite',
  category: 'WATER_LEAK',
  description: 'Coule sous la boîte aux lettres',
  status: 'OPEN',
  userId: 'u1',
  residenceId: 'r1',
  reference: 'PROX-GER-2026-00001',
  createdAt: new Date('2026-10-01T10:00:00Z'),
  updatedAt: new Date('2026-10-01T10:00:00Z'),
  attachments: [] as Array<{ filename: string; path: string; size: number }>,
};

const AGENCY_USER = {
  id: 'ag1',
  role: 'AGENCE',
  status: 'ACTIVE',
  residenceId: null,
  agencyId: 'a1',
};
const AGENT_OF_AGENCY = { id: 'ag1', role: 'AGENCE', residenceId: null };
const RESIDENT_R2 = { id: 'u2', role: 'USER', residenceId: 'r2' };

function makeIncidents(scope: string[] = ['r1', 'r2'], incident: unknown = INCIDENT_R1) {
  const prisma = {
    user: {
      findUnique: jest.fn(({ where, select }: { where: { id: string }; select?: object }) => {
        if (where.id === 'ag1') {
          return Promise.resolve(
            select && 'agency' in (select as object)
              ? {
                  ...AGENCY_USER,
                  firstName: 'Claire',
                  lastName: 'Roux',
                  agency: { name: 'Agence Gerland' },
                }
              : AGENCY_USER,
          );
        }
        if (where.id === 'u2') return Promise.resolve({ ...RESIDENT_R2, status: 'ACTIVE' });
        if (where.id === 'u1') {
          return Promise.resolve({
            id: 'u1',
            role: 'USER',
            status: 'ACTIVE',
            residenceId: 'r1',
            firstName: 'Alban',
            lastName: 'Ciclet',
            email: 'a@b.fr',
            emailNotifications: false,
            agency: null,
          });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockResolvedValue(undefined),
    },
    agencyResidence: {
      findMany: jest.fn().mockResolvedValue(scope.map((residenceId) => ({ residenceId }))),
      findFirst: jest.fn().mockResolvedValue({ id: 'link1' }),
    },
    residence: {
      findUnique: jest.fn().mockResolvedValue({ code: 'GER', name: 'Follement Gerland' }),
    },
    incident: {
      findUnique: jest.fn().mockResolvedValue(incident),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...INCIDENT_R1, ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...(incident as object), ...data }),
        ),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    incidentAttachment: { create: jest.fn() },
    incidentEvent: { create: jest.fn().mockResolvedValue({ id: 'ev1' }) },
    listing: { findUnique: jest.fn().mockResolvedValue({ id: 'l1', residenceId: 'r1' }) },
    comment: {
      create: jest.fn().mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({
          id: 'c1',
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: 'ag1',
            firstName: 'Claire',
            lastName: 'Roux',
            role: 'AGENCE',
            agency: { name: 'Agence Gerland' },
          },
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const emailService = {
    sendIncidentStatusUpdate: jest.fn().mockResolvedValue(undefined),
    sendIncidentToResidents: jest.fn().mockResolvedValue(undefined),
    sendIncidentToSyndic: jest.fn().mockResolvedValue(undefined),
  };
  return {
    service: new IncidentsService(prisma as never, emailService as never),
    comments: new CommentsService(prisma as never),
    prisma,
  };
}

describe('Périmètre d’un compte agence sur les signalements', () => {
  it('autorise la clôture d’un dossier d’une résidence gérée', async () => {
    const { service } = makeIncidents(['r1']);
    await expect(service.resolve('i1', AGENT_OF_AGENCY)).resolves.toMatchObject({
      status: 'RESOLVED',
    });
  });

  it('refuse un dossier hors du périmètre de l’agence', async () => {
    const { service, prisma } = makeIncidents(['r9']);
    await expect(service.resolve('i1', AGENT_OF_AGENCY)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  it('liste les signalements des résidences gérées, et d’aucune autre', async () => {
    const { service, prisma } = makeIncidents(['r1', 'r2']);
    await service.listPublic(AGENT_OF_AGENCY);
    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { residenceId: { in: ['r1', 'r2'] } } }),
    );
  });

  it('ne renvoie rien à une agence sans résidence rattachée', async () => {
    const { service, prisma } = makeIncidents([]);
    await expect(service.listPublic(AGENT_OF_AGENCY)).resolves.toEqual([]);
    expect(prisma.incident.findMany).not.toHaveBeenCalled();
  });

  it('écrit le statut attribué et l’auteur dans l’historique du dossier', async () => {
    const { service, prisma } = makeIncidents(['r1']);
    await service.resolve('i1', AGENT_OF_AGENCY);
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        incidentId: 'i1',
        type: 'STATUS_CHANGED',
        actorType: 'AGENCE',
        actorLabel: 'Agence Gerland, Claire Roux',
        fromStatus: 'OPEN',
        toStatus: 'RESOLVED',
      }),
    });
  });
});

describe('Référence de dossier à la création', () => {
  it('attribue une référence lisible fondée sur le code de la résidence', async () => {
    const { service, prisma } = makeIncidents();
    const created = await service.create(
      'u1',
      { title: 'Fuite', category: 'WATER_LEAK', description: 'Test' } as never,
      [],
      null,
      'r1',
    );
    expect(prisma.incident.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reference: 'PROX-GER-2026-00001' }),
    });
    expect(created).toMatchObject({ reference: 'PROX-GER-2026-00001' });
  });

  it('journalise la création du dossier', async () => {
    const { service, prisma } = makeIncidents();
    await service.create(
      'u1',
      { title: 'Fuite', category: 'WATER_LEAK', description: 'Test' } as never,
      [],
      null,
      'r1',
    );
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'CREATED', actorType: 'RESIDENT' }),
    });
  });
});

describe('Commentaires d’un compte agence', () => {
  it('autorise l’agence à commenter une résidence gérée et journalise le message', async () => {
    const { comments, prisma } = makeIncidents(['r1']);
    const comment = await comments.create(AGENT_OF_AGENCY, {
      incidentId: 'i1',
      content: 'Prestataire mandaté, intervention prévue jeudi.',
    } as never);
    expect(comment.author).toMatchObject({ role: 'AGENCE', agency: { name: 'Agence Gerland' } });
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'COMMENTED', actorType: 'AGENCE' }),
    });
  });

  it('refuse un commentaire hors du périmètre', async () => {
    const { comments, prisma } = makeIncidents([]);
    prisma.agencyResidence.findFirst.mockResolvedValue(null);
    await expect(
      comments.create(AGENT_OF_AGENCY, { incidentId: 'i1', content: 'Bonjour' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });

  it('refuse un habitant d’une autre résidence', async () => {
    const { comments, prisma } = makeIncidents();
    await expect(
      comments.create(RESIDENT_R2, { incidentId: 'i1', content: 'Bonjour' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.comment.create).not.toHaveBeenCalled();
  });
});

describe('Gestion des agences (superadministrateur)', () => {
  function makeAgencies() {
    const prisma = {
      agency: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', name: 'Agence Gerland' }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'a1', name: 'Agence Gerland' }),
        update: jest.fn().mockResolvedValue({ id: 'a1' }),
        delete: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
      agencyResidence: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      residence: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'ag1', agencyId: 'a1' }),
        create: jest.fn().mockResolvedValue({
          id: 'ag1',
          email: 'gestion@agence.fr',
          firstName: 'Claire',
          lastName: 'Roux',
          status: 'ACTIVE',
          lastSeenAt: null,
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({ id: 'ag1', agencyId: null, status: 'SUSPENDED' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const authService = { requestPasswordReset: jest.fn().mockResolvedValue({ message: 'ok' }) };
    return {
      service: new AgenciesService(prisma as never, authService as never),
      prisma,
      authService,
    };
  }

  it('crée un compte agence de rôle AGENCE et envoie le lien de mot de passe', async () => {
    const { service, prisma, authService } = makeAgencies();
    const member = await service.addMember('a1', {
      email: 'gestion@agence.fr',
      firstName: 'Claire',
      lastName: 'Roux',
    } as never);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'AGENCE', status: 'ACTIVE', agencyId: 'a1' }),
      }),
    );
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('gestion@agence.fr');
    expect(member).toMatchObject({ email: 'gestion@agence.fr' });
  });

  it('refuse une adresse déjà utilisée', async () => {
    const { service, prisma } = makeAgencies();
    prisma.user.findUnique.mockResolvedValue({ id: 'x', email: 'gestion@agence.fr' });
    await expect(
      service.addMember('a1', {
        email: 'gestion@agence.fr',
        firstName: 'Claire',
        lastName: 'Roux',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('détache et suspend le compte au lieu de le supprimer', async () => {
    const { service, prisma } = makeAgencies();
    await service.removeMember('a1', 'ag1');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'ag1' },
      data: { agencyId: null, status: 'SUSPENDED' },
    });
  });

  it('refuse une résidence inconnue dans le périmètre', async () => {
    const { service, prisma } = makeAgencies();
    prisma.residence.findMany.mockResolvedValue([{ id: 'r1' }]);
    await expect(
      service.update('a1', { residenceIds: ['r1', 'r-inconnue'] } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('remplace le périmètre de résidences', async () => {
    const { service, prisma } = makeAgencies();
    prisma.agency.findMany.mockResolvedValue([
      {
        id: 'a1',
        name: 'Agence Gerland',
        contactEmail: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        residences: [],
        members: [],
      },
    ]);
    await service.update('a1', { residenceIds: ['r1', 'r2', 'r1'] } as never);
    expect(prisma.agencyResidence.deleteMany).toHaveBeenCalledWith({ where: { agencyId: 'a1' } });
    expect(prisma.agencyResidence.createMany).toHaveBeenCalledWith({
      data: [
        { agencyId: 'a1', residenceId: 'r1' },
        { agencyId: 'a1', residenceId: 'r2' },
      ],
    });
  });
});

describe('Export CSV du dossier', () => {
  it('porte la référence du dossier, le statut et l’auteur de chaque traitement', async () => {
    const { service, prisma } = makeIncidents(['r1']);
    prisma.incident.findUnique.mockResolvedValue({
      ...INCIDENT_R1,
      status: 'RESOLVED',
      comments: [],
      residence: { name: 'Residence Proximo Test', agencyName: 'Agence Test Proximo' },
      user: {
        firstName: 'Hugo',
        lastName: 'Test',
        email: 'test.habitant@proximo.local',
        building: null,
        floor: null,
        showDetails: true,
      },
    });
    const csv = await service.exportCsv('i1', AGENT_OF_AGENCY);
    expect(csv).toContain('reference;PROX-GER-2026-00001');
    expect(csv).toContain('statut;RESOLVED');
    expect(csv).toContain('Agence Test Proximo');
    // L'export est lui-même journalisé : savoir qui a exporté fait partie de la preuve.
    expect(prisma.incidentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'EXPORTED', actorType: 'AGENCE' }),
    });
  });
});
