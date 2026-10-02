import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnnouncementsService } from '../src/announcements/announcements.service';

const STORED = {
  id: 'a1',
  title: 'Titre initial',
  body: 'Corps initial',
  authorId: 'u1',
  residenceId: 'r1',
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
};

const AUTHOR = { id: 'u1', role: 'USER', residenceId: 'r1' };
const OTHER = { id: 'u2', role: 'USER', residenceId: 'r1' };
const ADMIN = { id: 'u9', role: 'ADMIN', residenceId: 'r1' };

/** Fichier tel que multer le remet au service (nom d'origine + nom sur disque). */
function uploadedFile(name = 'photo.jpg') {
  return {
    originalname: name,
    mimetype: 'image/jpeg',
    size: 1234,
    filename: 'uuid-sur-disque.jpg',
  } as Express.Multer.File;
}

/**
 * Modification a posteriori d'une annonce officielle : droits et validations.
 * Le service relit la base (pas le jeton) : c'est `authorId` en base qui fait foi.
 */
describe('AnnouncementsService.update', () => {
  function makeService() {
    const prisma = {
      announcement: {
        findUnique: jest.fn().mockResolvedValue(STORED),
        update: jest
          .fn()
          .mockImplementation(({ data }: { data: object }) =>
            Promise.resolve({ ...STORED, ...data }),
          ),
      },
    };
    const service = new AnnouncementsService(prisma as never);
    return { service, prisma };
  }

  it("autorise l'auteur à modifier son annonce", async () => {
    const { service, prisma } = makeService();
    const result = await service.update('a1', AUTHOR, { title: 'Titre corrigé' });
    expect(result.announcement).toMatchObject({ title: 'Titre corrigé', body: 'Corps initial' });
    expect(prisma.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'a1' }, data: { title: 'Titre corrigé' } }),
    );
  });

  it('autorise un administrateur non auteur', async () => {
    const { service } = makeService();
    const result = await service.update('a1', ADMIN, { body: 'Corps mis à jour' });
    expect(result.announcement).toMatchObject({ body: 'Corps mis à jour' });
  });

  it("refuse un habitant qui n'est pas l'auteur", async () => {
    const { service, prisma } = makeService();
    await expect(service.update('a1', OTHER, { title: 'Tentative' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.announcement.update).not.toHaveBeenCalled();
  });

  it('refuse un DTO sans aucun champ', async () => {
    const { service } = makeService();
    await expect(service.update('a1', AUTHOR, {})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un titre vide', async () => {
    const { service } = makeService();
    await expect(service.update('a1', AUTHOR, { title: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("ne touche pas une annonce d'une autre résidence (404)", async () => {
    const { service } = makeService();
    await expect(
      service.update('a1', { id: 'u1', role: 'ADMIN', residenceId: 'r2' }, { title: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

/** Pièces jointes : les mêmes droits que la modification de l'annonce. */
describe('AnnouncementsService — pièces jointes', () => {
  function makeService() {
    const prisma = {
      announcement: {
        findUnique: jest
          .fn()
          // 1er appel : ownedOrFail (annonce brute) ; suivants : annonce complète.
          .mockResolvedValueOnce(STORED)
          .mockResolvedValue({ ...STORED, attachments: [] }),
        delete: jest.fn().mockResolvedValue(STORED),
      },
      announcementAttachment: {
        create: jest.fn().mockResolvedValue({ id: 'att1' }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'att1',
          announcementId: 'a1',
          path: 'uuid-sur-disque.jpg',
        }),
        findMany: jest.fn().mockResolvedValue([{ path: 'uuid-sur-disque.jpg' }]),
        delete: jest.fn().mockResolvedValue({ id: 'att1' }),
      },
    };
    const service = new AnnouncementsService(prisma as never);
    return { service, prisma };
  }

  it("enregistre les fichiers joints par l'auteur", async () => {
    const { service, prisma } = makeService();
    await service.addAttachments('a1', AUTHOR, [uploadedFile('plan.pdf')]);
    expect(prisma.announcementAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          announcementId: 'a1',
          filename: 'plan.pdf',
          path: 'uuid-sur-disque.jpg',
        }),
      }),
    );
  });

  it("refuse un habitant qui n'est pas l'auteur", async () => {
    const { service, prisma } = makeService();
    await expect(service.addAttachments('a1', OTHER, [uploadedFile()])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.announcementAttachment.create).not.toHaveBeenCalled();
  });

  it('refuse un envoi sans fichier', async () => {
    const { service } = makeService();
    await expect(service.addAttachments('a1', AUTHOR, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('retire une pièce jointe (ligne en base)', async () => {
    const { service, prisma } = makeService();
    await service.removeAttachment('a1', 'att1', AUTHOR);
    expect(prisma.announcementAttachment.delete).toHaveBeenCalledWith({ where: { id: 'att1' } });
  });

  it("404 si la pièce jointe n'appartient pas à cette annonce", async () => {
    const { service, prisma } = makeService();
    prisma.announcementAttachment.findFirst.mockResolvedValue(null);
    await expect(service.removeAttachment('a1', 'inconnu', AUTHOR)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("supprime les fichiers de l'annonce quand on la supprime", async () => {
    const { service, prisma } = makeService();
    await service.remove('a1', AUTHOR);
    expect(prisma.announcementAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { announcementId: 'a1' } }),
    );
    expect(prisma.announcement.delete).toHaveBeenCalledWith({ where: { id: 'a1' } });
  });
});
