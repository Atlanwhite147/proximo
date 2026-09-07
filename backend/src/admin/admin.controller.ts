import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IncidentsService } from '../incidents/incidents.service';
import { InvitationsService } from '../invitations/invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateIncidentStatusDto } from '../incidents/dto/update-incident-status.dto';
import { EmailService } from '../email/email.service';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';
import { UpdateSyndicSettingsDto } from './dto/update-syndic-settings.dto';
import { UpdateUserAdminDto } from './dto/update-user-admin.dto';

/**
 * Back-office administrateur — toutes les routes exigent le rôle ADMIN et
 * une session 2FA vérifiée (AdminGuard).
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly incidentsService: IncidentsService,
    private readonly invitationsService: InvitationsService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Utilisateurs ────────────────────────────────────────────

  @Get('users')
  async listUsers(
    @CurrentUser() user: { id: string; role: string; residenceId?: string | null },
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    // Un ADMIN local ne gère que SA résidence ; le SUPERADMIN voit tout.
    const isSuper = user.role === 'SUPERADMIN';
    const users = await this.prisma.user.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(!isSuper && user.residenceId ? { residenceId: user.residenceId } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        neighborhood: true,
        residenceId: true,
        role: true,
        status: true,
        totpEnabled: true,
        createdAt: true,
      },
    });
    return { users };
  }

  @Patch('users/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserAdminDto,
    @CurrentUser() admin: { id: string; role: string },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new BadRequestException('Utilisateur introuvable');
    }

    // Garde-fous : un admin ne peut ni se suspendre ni se déclasser lui-même.
    if (id === admin.id && (dto.status === 'SUSPENDED' || dto.role === 'USER')) {
      throw new ForbiddenException('Impossible de modifier votre propre compte ainsi');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.role ? { role: dto.role } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });
    return { user: updated };
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() admin: { id: string }) {
    if (id === admin.id) {
      throw new ForbiddenException('Impossible de supprimer votre propre compte');
    }
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new BadRequestException('Utilisateur introuvable');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  // ─── Signalements ────────────────────────────────────────────

  @Get('incidents')
  async listIncidents(@Query('status') status?: string) {
    const incidents = await this.incidentsService.listAll(status);
    return { incidents };
  }

  @Patch('incidents/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async updateIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ) {
    const incident = await this.incidentsService.updateStatus(id, dto.status);
    return { incident };
  }

  // ─── Annonces (modération) ─────────────────────────────────

  @Get('listings')
  async listListings(@Query('status') status?: string) {
    const listings = await this.prisma.listing.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    return { listings };
  }

  @Delete('listings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteListing(@Param('id', ParseUUIDPipe) id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new BadRequestException('Annonce introuvable');
    }
    await this.prisma.listing.delete({ where: { id } });
  }

  // ─── Réglages syndic / agence ────────────────────────────────

  @Get('settings')
  async getSettings() {
    const settings = await this.prisma.syndicSettings.upsert({
      where: { id: 1 },
      create: { id: 1, agencyName: 'Agence de gestion', email: '' },
      update: {},
    });
    return { settings };
  }

  @Patch('settings')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updateSettings(@Body() dto: UpdateSyndicSettingsDto) {
    const settings = await this.prisma.syndicSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        agencyName: dto.agencyName ?? 'Agence de gestion',
        email: dto.email ?? '',
        ...(dto.residenceName !== undefined ? { residenceName: dto.residenceName } : {}),
        ...(dto.residenceCode !== undefined ? { residenceCode: dto.residenceCode } : {}),
      },
      update: {
        ...(dto.agencyName !== undefined ? { agencyName: dto.agencyName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.residenceName !== undefined ? { residenceName: dto.residenceName } : {}),
        ...(dto.residenceCode !== undefined ? { residenceCode: dto.residenceCode } : {}),
      },
    });
    return { settings };
  }

  // ─── Réglages d'envoi d'emails ───────────────────────────────

  @Get('email-settings')
  async getEmailSettings() {
    const settings = await this.prisma.emailSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        mode: process.env.BREVO_API_KEY ? 'brevo' : process.env.SMTP_HOST ? 'smtp' : 'log',
        fromName: process.env.BREVO_FROM_NAME ?? process.env.SMTP_FROM_NAME ?? 'Proximo',
        fromEmail:
          process.env.BREVO_FROM_EMAIL ?? process.env.SMTP_FROM ?? 'no-reply@proximo.local',
        brevoApiKey: process.env.BREVO_API_KEY ?? null,
        smtpHost: process.env.SMTP_HOST ?? null,
        smtpPort: Number(process.env.SMTP_PORT ?? 587),
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER ?? null,
        smtpPass: process.env.SMTP_PASS ?? null,
        incidentNotificationsEnabled: true,
        listingNotificationsEnabled: true,
      },
      update: {},
    });
    const resolved = await this.emailService.resolveConfig();
    // Jamais renvoyer les secrets en clair — seulement « configuré » + résumé.
    return {
      settings: {
        id: settings.id,
        mode: settings.mode,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        brevoConfigured: Boolean(settings.brevoApiKey) || Boolean(process.env.BREVO_API_KEY),
        smtpConfigured: Boolean(settings.smtpHost) || Boolean(process.env.SMTP_HOST),
        smtpHost: settings.smtpHost ?? '',
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser ?? '',
        incidentNotificationsEnabled: settings.incidentNotificationsEnabled,
        listingNotificationsEnabled: settings.listingNotificationsEnabled,
        effectiveMode: resolved.mode,
      },
    };
  }

  @Patch('email-settings')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updateEmailSettings(@Body() dto: UpdateEmailSettingsDto) {
    const current = await this.prisma.emailSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {},
    });
    const settings = await this.prisma.emailSettings.update({
      where: { id: 1 },
      data: {
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.fromName !== undefined ? { fromName: dto.fromName } : {}),
        ...(dto.fromEmail !== undefined ? { fromEmail: dto.fromEmail } : {}),
        // Secrets : une valeur vide = « ne pas changer » (on ne peut pas
        // relire un secret côté client). Une valeur non vide = remplacement.
        ...(dto.brevoApiKey
          ? { brevoApiKey: dto.brevoApiKey }
          : dto.brevoApiKey === ''
            ? { brevoApiKey: current.brevoApiKey }
            : {}),
        ...(dto.smtpHost !== undefined ? { smtpHost: dto.smtpHost || null } : {}),
        ...(dto.smtpPort !== undefined ? { smtpPort: dto.smtpPort } : {}),
        ...(dto.smtpSecure !== undefined ? { smtpSecure: dto.smtpSecure } : {}),
        ...(dto.smtpUser !== undefined ? { smtpUser: dto.smtpUser || null } : {}),
        ...(dto.smtpPass
          ? { smtpPass: dto.smtpPass }
          : dto.smtpPass === ''
            ? { smtpPass: current.smtpPass }
            : {}),
        ...(dto.incidentNotificationsEnabled !== undefined
          ? { incidentNotificationsEnabled: dto.incidentNotificationsEnabled }
          : {}),
        ...(dto.listingNotificationsEnabled !== undefined
          ? { listingNotificationsEnabled: dto.listingNotificationsEnabled }
          : {}),
      },
    });
    await this.emailService.refreshTransporter();
    const resolved = await this.emailService.resolveConfig();
    return {
      settings: {
        id: settings.id,
        mode: settings.mode,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        brevoConfigured: Boolean(settings.brevoApiKey) || Boolean(process.env.BREVO_API_KEY),
        smtpConfigured: Boolean(settings.smtpHost) || Boolean(process.env.SMTP_HOST),
        smtpHost: settings.smtpHost ?? '',
        smtpPort: settings.smtpPort,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser ?? '',
        effectiveMode: resolved.mode,
      },
    };
  }

  /** Envoie un email de test à l'admin connecté (validation de la config). */
  @Post('email-settings/test')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async testEmailSettings(@CurrentUser() admin: { id: string; email: string }) {
    const resolved = await this.emailService.resolveConfig();
    if (resolved.mode === 'log') {
      throw new BadRequestException(
        'Aucun mode d’envoi configuré — renseignez Brevo ou SMTP avant de tester.',
      );
    }
    await this.emailService.sendMail(
      admin.email,
      'Test de configuration email — Proximo',
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#237a49">📧 Test réussi</h2>
        <p>Cet email confirme que la configuration d'envoi fonctionne :</p>
        <table style="font-size:14px;border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#64748b">Mode</td>
              <td style="padding:4px 0"><strong>${resolved.mode}</strong></td></tr>
          <tr><td style="padding:4px 0;color:#64748b">Expéditeur</td>
              <td style="padding:4px 0">${resolved.fromName} &lt;${resolved.fromEmail}&gt;</td></tr>
        </table>
      </div>`,
    );
    return { sent: true, mode: resolved.mode };
  }

  // ─── Signalements (modération) ─────────────────────────────

  @Delete('incidents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIncident(@Param('id', ParseUUIDPipe) id: string) {
    await this.incidentsService.adminRemove(id);
  }

  // ─── Invitations ─────────────────────────────────────────────

  @Get('invitations')
  async listInvitations() {
    const invitations = await this.invitationsService.listAll();
    return { invitations };
  }

  // ─── Vue d'ensemble (stats) ─────────────────────────────────

  @Get('stats')
  async stats() {
    const [members, pending, incidents, incidentsOpen, invitations] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'PENDING' } }),
      this.prisma.incident.count(),
      this.prisma.incident.count({ where: { status: 'OPEN' } }),
      this.prisma.invitation.count({ where: { usedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    return {
      stats: {
        members,
        pending,
        incidents,
        incidentsOpen,
        invitationsActive: invitations,
      },
    };
  }

  // ─── Résidences (SUPERADMIN uniquement) ─────────────────────
  // Le superadmin gère toutes les résidences : liste, création, réglages.

  @Get('residences')
  async listResidences(
    @CurrentUser() user: { role: string },
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    const residences = await this.prisma.residence.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { users: true, listings: true, incidents: true } } },
    });
    return { residences };
  }

  @Post('residences')
  @HttpCode(HttpStatus.CREATED)
  async createResidence(
    @CurrentUser() user: { role: string },
    @Body() dto: { name: string; code: string; agencyName?: string; syndicEmail?: string },
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    const name = dto.name?.trim();
    const code = dto.code?.trim();
    if (!name || !code) {
      throw new BadRequestException('Nom et code de résidence requis');
    }
    const residence = await this.prisma.residence.create({
      data: {
        name,
        code,
        agencyName: dto.agencyName?.trim() || null,
        syndicEmail: dto.syndicEmail?.trim() || null,
      },
    });
    return { residence };
  }

  @Patch('residences/:id')
  async updateResidence(
    @CurrentUser() user: { role: string },
    @Param('id') id: string,
    @Body() dto: { name?: string; code?: string; agencyName?: string; syndicEmail?: string },
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    const residence = await this.prisma.residence.findUnique({ where: { id } });
    if (!residence) {
      throw new NotFoundException('Résidence introuvable');
    }
    const data: Record<string, string> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.agencyName !== undefined) data.agencyName = dto.agencyName.trim() || '';
    if (dto.syndicEmail !== undefined) data.syndicEmail = dto.syndicEmail.trim() || '';
    const updated = await this.prisma.residence.update({ where: { id }, data });
    return { residence: updated };
  }
}
