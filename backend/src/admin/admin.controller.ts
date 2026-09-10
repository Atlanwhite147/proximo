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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IncidentsService } from '../incidents/incidents.service';
import { InvitationsService } from '../invitations/invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateIncidentStatusDto } from '../incidents/dto/update-incident-status.dto';
import { EmailService } from '../email/email.service';
import { ResidenceTransferService } from './residence-transfer.service';
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
    private readonly residenceTransfer: ResidenceTransferService,
  ) {}

  // ─── Utilisateurs ────────────────────────────────────────────

  @Get('users')
  async listUsers(
    @CurrentUser() user: { id: string; role: string; residenceId?: string | null },
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('residenceId') requestedResidenceId?: string,
  ) {
    // Un ADMIN local ne gère que SA résidence ; le SUPERADMIN voit tout,
    // et peut filtrer par résidence (console multi-résidences).
    const isSuper = user.role === 'SUPERADMIN';
    const scopeResidenceId = !isSuper ? user.residenceId : requestedResidenceId || undefined;
    const users = await this.prisma.user.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(scopeResidenceId ? { residenceId: scopeResidenceId } : {}),
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
  async listIncidents(
    @CurrentUser() user: { role: string; residenceId?: string | null },
    @Query('status') status?: string,
    @Query('residenceId') residenceId?: string,
  ) {
    const scopeResidenceId =
      user.role === 'SUPERADMIN' ? residenceId || undefined : user.residenceId || undefined;
    const incidents = await this.incidentsService.listAll(status, scopeResidenceId ?? null);
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
  async listListings(
    @CurrentUser() user: { role: string; residenceId?: string | null },
    @Query('status') status?: string,
    @Query('residenceId') residenceId?: string,
  ) {
    const scopeResidenceId =
      user.role === 'SUPERADMIN' ? residenceId || undefined : user.residenceId || undefined;
    const listings = await this.prisma.listing.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(scopeResidenceId ? { residenceId: scopeResidenceId } : {}),
      },
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

  // ─── Réglages syndic / agence (scopés à la résidence de l'admin) ─────

  @Get('settings')
  async getSettings(@CurrentUser() user: { residenceId?: string | null }) {
    // Multi-résidences : chaque admin gère les réglages de SA résidence
    // (nom, agence, email de réception des signalements).
    if (!user.residenceId) {
      throw new BadRequestException('Aucune résidence rattachée à ce compte');
    }
    const residence = await this.prisma.residence.findUnique({
      where: { id: user.residenceId },
    });
    if (!residence) {
      throw new NotFoundException('Résidence introuvable');
    }
    return {
      settings: {
        id: residence.id,
        residenceName: residence.name,
        residenceCode: residence.code,
        agencyName: residence.agencyName ?? '',
        email: residence.syndicEmail ?? '',
        // Notifications par email (gérées par l'admin de la résidence)
        notifyAgencyOnIncident: residence.notifyAgencyOnIncident,
        notifyResidentsOnIncident: residence.notifyResidentsOnIncident,
        notifyResidentsOnListing: residence.notifyResidentsOnListing,
      },
    };
  }

  @Patch('settings')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updateSettings(
    @CurrentUser() user: { role: string; residenceId?: string | null },
    @Body() dto: UpdateSyndicSettingsDto,
  ) {
    if (!user.residenceId) {
      throw new BadRequestException('Aucune résidence rattachée à ce compte');
    }
    const residence = await this.prisma.residence.findUnique({
      where: { id: user.residenceId },
    });
    if (!residence) {
      throw new NotFoundException('Résidence introuvable');
    }
    // Le code d'accès reste une donnée sensible : seul le superadmin peut
    // le changer (les admins locaux peuvent renommer / changer l'agence).
    const canEditCode = user.role === 'SUPERADMIN';
    const updated = await this.prisma.residence.update({
      where: { id: residence.id },
      data: {
        ...(dto.residenceName !== undefined ? { name: dto.residenceName } : {}),
        ...(dto.agencyName !== undefined ? { agencyName: dto.agencyName } : {}),
        ...(dto.email !== undefined ? { syndicEmail: dto.email } : {}),
        ...(dto.notifyAgencyOnIncident !== undefined
          ? { notifyAgencyOnIncident: dto.notifyAgencyOnIncident }
          : {}),
        ...(dto.notifyResidentsOnIncident !== undefined
          ? { notifyResidentsOnIncident: dto.notifyResidentsOnIncident }
          : {}),
        ...(dto.notifyResidentsOnListing !== undefined
          ? { notifyResidentsOnListing: dto.notifyResidentsOnListing }
          : {}),
        ...(canEditCode && dto.residenceCode !== undefined ? { code: dto.residenceCode } : {}),
      },
    });
    return {
      settings: {
        id: updated.id,
        residenceName: updated.name,
        residenceCode: updated.code,
        agencyName: updated.agencyName ?? '',
        email: updated.syndicEmail ?? '',
        notifyAgencyOnIncident: updated.notifyAgencyOnIncident,
        notifyResidentsOnIncident: updated.notifyResidentsOnIncident,
        notifyResidentsOnListing: updated.notifyResidentsOnListing,
      },
    };
  }

  // ─── Réglages d'envoi d'emails ───────────────────────────────

  @Get('email-settings')
  async getEmailSettings(@CurrentUser() user: { role: string }) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin de la plateforme');
    }
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
        effectiveMode: resolved.mode,
      },
      brevo: await this.emailService.getBrevoQuota(),
      outbox: await this.emailService.getOutboxStatus(),
    };
  }

  @Patch('email-settings')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updateEmailSettings(
    @CurrentUser() user: { role: string },
    @Body() dto: UpdateEmailSettingsDto,
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin de la plateforme');
    }
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
  async testEmailSettings(@CurrentUser() admin: { id: string; email: string; role: string }) {
    if (admin.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin de la plateforme');
    }
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

  /** Renvoie immédiatement les emails mis en file (quota Brevo atteint). */
  @Post('email-settings/flush')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async flushEmailOutbox(@CurrentUser() admin: { id: string; role: string }) {
    if (admin.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin de la plateforme');
    }
    const result = await this.emailService.flushOutbox();
    return { ...result, outbox: await this.emailService.getOutboxStatus() };
  }

  // ─── Signalements (modération) ─────────────────────────────

  @Delete('incidents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteIncident(@Param('id', ParseUUIDPipe) id: string) {
    await this.incidentsService.adminRemove(id);
  }

  // ─── Invitations ─────────────────────────────────────────────

  @Get('invitations')
  async listInvitations(
    @CurrentUser() user: { role: string; residenceId?: string | null },
    @Query('residenceId') residenceId?: string,
  ) {
    const scopeResidenceId =
      user.role === 'SUPERADMIN' ? residenceId || undefined : user.residenceId || undefined;
    const invitations = await this.invitationsService.listAll(scopeResidenceId ?? null);
    return { invitations };
  }

  /** Supprime une invitation (lien + QR invalidés). */
  @Delete('invitations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInvitation(@Param('id', ParseUUIDPipe) id: string) {
    await this.invitationsService.remove(id);
  }

  // ─── Vue d'ensemble (stats) ─────────────────────────────────

  @Get('stats')
  async stats(@CurrentUser() user: { role: string; residenceId?: string | null }) {
    const scopeResidenceId = user.role === 'SUPERADMIN' ? undefined : user.residenceId || undefined;
    const where = scopeResidenceId ? { residenceId: scopeResidenceId } : {};
    const [members, pending, incidents, incidentsOpen, invitations] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.incident.count({ where }),
      this.prisma.incident.count({ where: { ...where, status: 'OPEN' } }),
      this.prisma.invitation.count({
        where: { ...where, usedAt: null, expiresAt: { gt: new Date() } },
      }),
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
  async listResidences(@CurrentUser() user: { role: string }) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    const residences = await this.prisma.residence.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            listings: true,
            incidents: true,
            invitations: { where: { usedAt: null, expiresAt: { gt: new Date() } } },
          },
        },
      },
    });
    // Comptage des membres ACTIVE et PENDING par résidence.
    const users = await this.prisma.user.groupBy({
      by: ['residenceId', 'status'],
      _count: { _all: true },
      where: { residenceId: { in: residences.map((r) => r.id) } },
    });
    const counts = new Map<string, { active: number; pending: number }>();
    for (const row of users) {
      const key = row.residenceId ?? '';
      const current = counts.get(key) ?? { active: 0, pending: 0 };
      if (row.status === 'ACTIVE') current.active += row._count._all;
      if (row.status === 'PENDING') current.pending += row._count._all;
      counts.set(key, current);
    }
    return {
      residences: residences.map((residence) => ({
        ...residence,
        membersActive: counts.get(residence.id)?.active ?? 0,
        membersPending: counts.get(residence.id)?.pending ?? 0,
      })),
    };
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
    @Body()
    dto: {
      name?: string;
      code?: string;
      agencyName?: string;
      syndicEmail?: string;
      notifyAgencyOnIncident?: boolean;
      notifyResidentsOnIncident?: boolean;
      notifyResidentsOnListing?: boolean;
    },
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    const residence = await this.prisma.residence.findUnique({ where: { id } });
    if (!residence) {
      throw new NotFoundException('Résidence introuvable');
    }
    const data: Record<string, string | boolean> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.code !== undefined) data.code = dto.code.trim();
    if (dto.agencyName !== undefined) data.agencyName = dto.agencyName.trim() || '';
    if (dto.syndicEmail !== undefined) data.syndicEmail = dto.syndicEmail.trim() || '';
    // Notifications par email de la résidence (interrupteurs mail).
    if (dto.notifyAgencyOnIncident !== undefined) {
      data.notifyAgencyOnIncident = dto.notifyAgencyOnIncident;
    }
    if (dto.notifyResidentsOnIncident !== undefined) {
      data.notifyResidentsOnIncident = dto.notifyResidentsOnIncident;
    }
    if (dto.notifyResidentsOnListing !== undefined) {
      data.notifyResidentsOnListing = dto.notifyResidentsOnListing;
    }
    const updated = await this.prisma.residence.update({ where: { id }, data });
    return { residence: updated };
  }

  @Delete('residences/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteResidence(
    @CurrentUser() user: { role: string; residenceId?: string | null },
    @Param('id') id: string,
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    const residence = await this.prisma.residence.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!residence) {
      throw new NotFoundException('Résidence introuvable');
    }
    // Impossible de supprimer la dernière résidence (l'app a besoin d'au moins une).
    const total = await this.prisma.residence.count();
    if (total <= 1) {
      throw new BadRequestException('Impossible de supprimer la dernière résidence');
    }
    // Une résidence avec des membres actifs ne se supprime pas par accident :
    // il faut d'abord retirer/suspendre ses habitants.
    if (residence._count.users > 0) {
      throw new BadRequestException(
        'Cette résidence a encore des membres. Retirez-les avant de la supprimer.',
      );
    }
    await this.prisma.residence.delete({ where: { id } });
  }

  // ─── Transfert de résidence (export / import chiffré, SUPERADMIN) ───

  /**
   * Export chiffré d'UNE résidence : habitants, annonces, signalements et
   * photos, commentaires, conversations, invitations.
   * POST (et non GET) pour que la phrase de passe ne se retrouve jamais dans
   * les journaux d'accès du reverse-proxy.
   */
  @Post('residences/:id/export')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async exportResidence(
    @CurrentUser() user: { role: string; email: string },
    @Param('id') id: string,
    @Body() dto: { passphrase?: string },
    @Res() response: Response,
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    if (!dto?.passphrase) {
      throw new BadRequestException("Une phrase de passe est requise pour chiffrer l'export.");
    }
    const { buffer, filename } = await this.residenceTransfer.exportResidence(
      id,
      dto.passphrase,
      user.email,
    );
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Cache-Control', 'no-store');
    response.send(buffer);
  }

  /**
   * Import d'un fichier d'export : crée une NOUVELLE résidence avec tout son
   * contenu (aucune donnée existante n'est écrasée).
   */
  @Post('residences/import')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 300 * 1024 * 1024 } }))
  async importResidence(
    @CurrentUser() user: { role: string },
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Body()
    body: {
      passphrase?: string;
      residenceName?: string;
      residenceCode?: string;
      emailConflict?: string;
    },
  ) {
    if (user.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadmin');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Fichier de sauvegarde manquant.');
    }
    if (!body?.passphrase) {
      throw new BadRequestException('Phrase de passe requise.');
    }
    return this.residenceTransfer.importResidence(file.buffer, {
      passphrase: body.passphrase,
      residenceName: body.residenceName?.trim() || undefined,
      residenceCode: body.residenceCode?.trim() || undefined,
      emailConflict: body.emailConflict === 'skip' ? 'skip' : 'rename',
    });
  }
}
