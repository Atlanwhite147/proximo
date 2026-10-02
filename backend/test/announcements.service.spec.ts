import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnnouncementsService } from '../src/announcements/announcements.service';

/**
 * Modification a posteriori d'une annonce officielle : droits et validations.
 * Le service relit la base (pas le jeton) : c'est `authorId` en base qui fait foi.
 */
describe('AnnouncementsService.update', () => {
  const stored = {
    id: 'a1',
    title: 'Titre initial',
    body: 'Corps initial',
    authorId: 'u1',
    residenceId: 'r1',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  };

  function makeService() {
    const prisma = {
      announcement: {
        findUnique: jest.fn().mockResolvedValue(stored),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ ...stored, ...data }),
          ),
      },
    };
    const service = new AnnouncementsService(prisma as never);
    return { service, prisma };
  }

  it("autorise l'auteur à modifier son annonce", async () => {
    const { service, prisma } = makeService();
    const result = await service.update(
      'a1',
      { id: 'u1', role: 'USER', residenceId: 'r1' },
      { title: 'Titre corrigé' },
    );
    expect(result.announcement).toMatchObject({ title: 'Titre corrigé', body: 'Corps initial' });
    expect(prisma.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: { title: 'Titre corrigé' } }),
    );
  });

  it('autorise un administrateur non auteur', async () => {
    const { service } = makeService();
    const result = await service.update(
      'a1',
      { id: 'u9', role: 'ADMIN', residenceId: 'r1' },
      { body: 'Corps mis à jour' },
    );
    expect(result.announcement).toMatchObject({ body: 'Corps mis à jour' });
  });

  it("refuse un habitant qui n'est pas l'auteur", async () => {
    const { service, prisma } = makeService();
    await expect(
      service.update('a1', { id: 'u2', role: 'USER', residenceId: 'r1' }, { title: 'Tentative' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });

  it('refuse un DTO sans aucun champ', async () => {
    const { service } = makeService();
    await expect(
      service.update('a1', { id: 'u1', role: 'USER', residenceId: 'r1' }, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un titre vide', async () => {
    const { service } = makeService();
    await expect(
      service.update('a1', { id: 'u1', role: 'USER', residenceId: 'r1' }, { title: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("ne touche pas une annonce d'une autre résidence (404)", async () => {
    const { service } = makeService();
    await expect(
      service.update('a1', { id: 'u1', role: 'ADMIN', residenceId: 'r2' }, { title: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
