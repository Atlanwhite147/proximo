import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../src/common/guards/admin.guard';

/** Contexte Nest minimal : une requête avec l'utilisateur de session (JWT). */
function contextFor(user: Record<string, unknown> | undefined) {
  const request: Record<string, any> = { user };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AdminGuard', () => {
  const prisma = { user: { findUnique: jest.fn() } };
  const guard = new AdminGuard(prisma as any);

  beforeEach(() => {
    prisma.user.findUnique.mockReset();
  });

  it('accepte un membre promu administrateur dont le jeton porte encore role USER', async () => {
    // Le JWT ne porte que « USER » (émis avant la promotion) : c'est la base
    // qui fait foi, sinon le nouvel admin est enfermé hors du back-office.
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'voisin@exemple.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      residenceId: 'r1',
      totpEnabled: false,
    });
    const { context, request } = contextFor({
      id: 'u1',
      role: 'USER',
      status: 'ACTIVE',
      residenceId: null,
      totpEnabled: false,
      twoFactorVerified: false,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    // Les valeurs fraîches sont propagées : les contrôleurs scopent ensuite
    // sur la résidence RÉELLE de l'admin.
    expect(request.user).toMatchObject({ role: 'ADMIN', residenceId: 'r1' });
  });

  it('refuse un membre simple', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      email: 'voisin@exemple.com',
      role: 'USER',
      status: 'ACTIVE',
      residenceId: 'r1',
      totpEnabled: false,
    });
    const { context } = contextFor({ id: 'u2', role: 'USER' });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuse un administrateur rétrogradé en base (jeton encore ADMIN)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u3',
      email: 'ancien.admin@exemple.com',
      role: 'USER',
      status: 'ACTIVE',
      residenceId: 'r1',
      totpEnabled: false,
    });
    const { context } = contextFor({ id: 'u3', role: 'ADMIN', twoFactorVerified: true });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige la double authentification quand elle est activée sur le compte', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u4',
      email: 'admin@exemple.com',
      role: 'ADMIN',
      status: 'ACTIVE',
      residenceId: 'r1',
      totpEnabled: true,
    });
    const { context } = contextFor({
      id: 'u4',
      role: 'ADMIN',
      totpEnabled: false,
      twoFactorVerified: false,
    });

    await expect(guard.canActivate(context)).rejects.toThrow('Double authentification requise');
  });

  it('accepte un superadministrateur et un admin 2FA vérifiée', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u5',
      email: 'super@exemple.com',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      residenceId: 'r1',
      totpEnabled: true,
    });
    const { context } = contextFor({ id: 'u5', role: 'ADMIN', twoFactorVerified: true });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
