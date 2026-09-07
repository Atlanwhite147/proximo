import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { emailLayout } from './email.templates';

/**
 * Réglages d'envoi d'emails résolus (DB d'abord, puis variables d'env).
 */
export interface ResolvedEmailConfig {
  mode: 'brevo' | 'smtp' | 'log';
  fromName: string;
  fromEmail: string;
  brevoApiKey?: string;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
  };
}

/**
 * Envoi d'emails transactionnels (bienvenue, messages, signalements).
 *
 * Modes, par ordre de priorité :
 * 1. Réglages en base (table EmailSettings, configurés dans l'admin) ;
 * 2. Brevo (API REST) si BREVO_API_KEY est défini — recommandé (offre gratuite
 *    jusqu'à 300 emails/jour, expéditeur vérifié requis) ;
 * 3. SMTP générique (Nodemailer) si SMTP_HOST est défini ;
 * 4. Mode journal (développement) : les emails sont loggés, jamais envoyés.
 *
 * Le service ne lève jamais d'exception bloquante : un échec d'envoi est loggé
 * et l'application continue (les emails ne doivent pas casser les flux).
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.refreshTransporter();
  }

  /** Recharge le transporteur SMTP (appelé après mise à jour des réglages). */
  async refreshTransporter(): Promise<void> {
    const config = await this.resolveConfig();
    this.transporter = null;
    if (config.mode === 'smtp' && config.smtp) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user ?? '',
          pass: config.smtp.pass ?? '',
        },
      });
    }
    this.logger.log(`Mode d'envoi d'emails : ${config.mode}`);
  }

  /**
   * Résout la configuration : EmailSettings en base si présente (mode non
   * 'log' explicite ou champs renseignés), sinon repli sur l'environnement.
   */
  async resolveConfig(): Promise<ResolvedEmailConfig> {
    const db = await this.prisma.emailSettings.findUnique({ where: { id: 1 } });

    // Config en base complète et volontaire (mode explicite non vide).
    if (db && db.mode) {
      const brevoKey = db.brevoApiKey?.trim() || process.env.BREVO_API_KEY || '';
      const smtpHost = db.smtpHost?.trim() || process.env.SMTP_HOST || '';
      const smtpConfigured = smtpHost.length > 0;
      const brevoConfigured = brevoKey.length > 0;

      // Si la base ne précise rien d'utilisable, on retombe sur l'env.
      const mode: ResolvedEmailConfig['mode'] =
        db.mode === 'log'
          ? 'log'
          : db.mode === 'smtp'
            ? smtpConfigured
              ? 'smtp'
              : brevoConfigured
                ? 'brevo'
                : 'log'
            : brevoConfigured
              ? 'brevo'
              : smtpConfigured
                ? 'smtp'
                : 'log';

      return {
        mode,
        fromName:
          db.fromName?.trim() ||
          process.env.BREVO_FROM_NAME ||
          process.env.SMTP_FROM_NAME ||
          'Proximo',
        fromEmail:
          db.fromEmail?.trim() ||
          process.env.BREVO_FROM_EMAIL ||
          process.env.SMTP_FROM ||
          'no-reply@proximo.local',
        ...(mode === 'brevo' ? { brevoApiKey: brevoKey } : {}),
        ...(mode === 'smtp'
          ? {
              smtp: {
                host: smtpHost,
                port: db.smtpPort ?? Number(process.env.SMTP_PORT ?? 587),
                secure: db.smtpSecure ?? process.env.SMTP_SECURE === 'true',
                user: db.smtpUser?.trim() || process.env.SMTP_USER || undefined,
                pass: db.smtpPass?.trim() || process.env.SMTP_PASS || undefined,
              },
            }
          : {}),
      };
    }

    // Aucune config en base → repli env.
    if (process.env.BREVO_API_KEY) {
      return {
        mode: 'brevo',
        fromName: process.env.BREVO_FROM_NAME ?? 'Proximo',
        fromEmail: process.env.BREVO_FROM_EMAIL ?? 'no-reply@proximo.local',
        brevoApiKey: process.env.BREVO_API_KEY,
      };
    }
    if (process.env.SMTP_HOST) {
      return {
        mode: 'smtp',
        fromName: process.env.SMTP_FROM_NAME ?? 'Proximo',
        fromEmail: process.env.SMTP_FROM ?? 'no-reply@proximo.local',
        smtp: {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER || undefined,
          pass: process.env.SMTP_PASS || undefined,
        },
      };
    }
    return { mode: 'log', fromName: 'Proximo', fromEmail: 'no-reply@proximo.local' };
  }

  /** Envoi générique — ne lève jamais (échec = log + échec silencieux). */
  async sendMail(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    try {
      const config = await this.resolveConfig();
      if (config.mode === 'brevo' && config.brevoApiKey) {
        await this.sendBrevo(to, subject, html, config, attachments);
      } else if (config.mode === 'smtp' && config.smtp) {
        const transporter =
          this.transporter ??
          nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.secure,
            auth: {
              user: config.smtp.user ?? '',
              pass: config.smtp.pass ?? '',
            },
          });
        await transporter.sendMail({
          from: `"${config.fromName}" <${config.fromEmail}>`,
          to,
          subject,
          html,
          attachments: attachments?.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        });
      } else {
        this.logger.warn(
          `[email simulé] À: ${to} — Objet: ${subject}${
            attachments?.length ? ` — ${attachments.length} pièce(s) jointe(s)` : ''
          }`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Échec d'envoi d'email à ${to} (« ${subject} ») : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Envoi via l'API REST Brevo (v3/smtp/email). */
  private async sendBrevo(
    to: string,
    subject: string,
    html: string,
    config: ResolvedEmailConfig,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': config.brevoApiKey as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: config.fromName, email: config.fromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        attachment: attachments?.map((a) => ({
          name: a.filename,
          content: a.content.toString('base64'),
        })),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Brevo ${response.status} ${detail.slice(0, 200)}`);
    }
  }

  // ─── Emails transactionnels ─────────────────────────────────

  async sendWelcome(to: string, firstName: string): Promise<void> {
    await this.sendMail(
      to,
      'Bienvenue sur Proximo 🎉',
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#237a49">Bienvenue, ${this.escape(firstName)} 👋</h2>
        <p>Votre compte Proximo a été créé. Une fois validé par un administrateur,
        vous pourrez échanger avec les habitants de votre résidence.</p>
        <p style="color:#64748b">— L'équipe Proximo</p>
      </div>`,
    );
  }

  async sendNewMessage(to: string, fromFirstName: string, preview: string): Promise<void> {
    await this.sendMail(
      to,
      `Nouveau message de ${fromFirstName} sur Proximo`,
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#237a49">💬 Nouveau message</h2>
        <p><strong>${this.escape(fromFirstName)}</strong> vous a écrit :</p>
        <blockquote style="border-left:3px solid #237a49;padding-left:12px;color:#334155">
          ${this.escape(preview)}
        </blockquote>
        <p><a href="${this.appUrl()}/messages" style="color:#237a49">Ouvrir la conversation →</a></p>
      </div>`,
    );
  }

  async sendIncidentToSyndic(
    syndicEmail: string,
    incident: {
      title: string;
      category: string;
      description: string;
      neighborhood?: string | null;
    },
    author: { firstName: string; lastName: string; email: string },
    attachments: { filename: string; mimeType: string; path?: string }[],
    residenceName?: string | null,
  ): Promise<void> {
    const labels: Record<string, string> = {
      WATER_LEAK: 'Fuite d’eau',
      ELEVATOR: 'Panne d’ascenseur',
      DAMAGE: 'Dégradation',
      OTHER: 'Autre',
    };
    // Lit les fichiers sur le volume pour les joindre réellement au mail.
    const attachmentBuffers: Array<{ filename: string; content: Buffer }> = [];
    for (const attachment of attachments) {
      if (!attachment.path) continue;
      try {
        const uploads = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
        const content = await readFile(join(uploads, attachment.path));
        attachmentBuffers.push({ filename: attachment.filename, content });
      } catch (error) {
        this.logger.warn(
          `Pièce jointe illisible pour le mail agence (${attachment.filename}) : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await this.sendMail(
      syndicEmail,
      `[Proximo] Signalement : ${incident.title}`,
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#237a49">🛠️ Nouveau signalement</h2>
        ${residenceName ? `<p style="color:#64748b;font-size:13px">Résidence : <strong>${this.escape(residenceName)}</strong></p>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0;color:#64748b">Type</td>
              <td style="padding:4px 0"><strong>${labels[incident.category] ?? incident.category}</strong></td></tr>
          <tr><td style="padding:4px 0;color:#64748b">Localisation</td>
              <td style="padding:4px 0">${this.escape(incident.neighborhood ?? 'Non précisée')}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b">Auteur</td>
              <td style="padding:4px 0">${this.escape(author.firstName)} ${this.escape(author.lastName)} (${this.escape(author.email)})</td></tr>
          ${attachmentBuffers.length ? `<tr><td style="padding:4px 0;color:#64748b">Pièces jointes</td><td style="padding:4px 0">${attachmentBuffers.map((a) => this.escape(a.filename)).join(', ')}</td></tr>` : ''}
        </table>
        <p style="margin-top:12px;white-space:pre-line">${this.escape(incident.description)}</p>
      </div>`,
      attachmentBuffers,
    );
  }

  async sendIncidentStatusUpdate(
    to: string,
    incidentTitle: string,
    status: string,
    adminNote?: string | null,
  ): Promise<void> {
    const labels: Record<string, string> = {
      OPEN: 'Ouvert',
      IN_PROGRESS: 'En cours de traitement',
      RESOLVED: 'Résolu',
    };
    await this.sendMail(
      to,
      `Signalement « ${incidentTitle} » : ${labels[status] ?? status}`,
      `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#237a49">🛠️ Mise à jour de votre signalement</h2>
        <p><strong>« ${this.escape(incidentTitle)} »</strong> est désormais :
        <strong>${labels[status] ?? status}</strong></p>
        ${adminNote ? `<blockquote style="border-left:3px solid #237a49;padding-left:12px;color:#334155">${this.escape(adminNote)}</blockquote>` : ''}
        <p><a href="${this.appUrl()}/signalements" style="color:#237a49">Voir mes signalements →</a></p>
      </div>`,
    );
  }

  // ─── Notifications à la résidence ───────────────────────────

  /**
   * Vérifie si une notification automatique à la résidence est activée
   * (interrupteurs admin dans EmailSettings, défaut : activé).
   */
  async isResidentNotificationEnabled(kind: 'incident' | 'listing'): Promise<boolean> {
    try {
      const settings = await this.prisma.emailSettings.findUnique({ where: { id: 1 } });
      if (!settings) return true;
      return kind === 'incident'
        ? settings.incidentNotificationsEnabled
        : settings.listingNotificationsEnabled;
    } catch {
      return true; // En cas d'erreur, on laisse passer (défaut sécurisé : envoyer).
    }
  }

  /**
   * Envoie un email à tous les habitants au statut ACTIVE (sauf l'auteur).
   * Ne lève jamais : chaque échec est loggé individuellement.
   */
  async notifyResidents(options: {
    subject: string;
    /** Construit le HTML pour un destinataire (prénom + lien personnalisés). */
    buildHtml: (recipient: { firstName: string; lastName: string }) => string;
    excludeUserId?: string;
    /** Multi-résidences : restreint l'envoi aux habitants de CETTE résidence. */
    residenceId?: string | null;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<void> {
    try {
      const residents = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
          ...(options.residenceId ? { residenceId: options.residenceId } : {}),
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      for (const resident of residents) {
        try {
          await this.sendMail(
            resident.email,
            options.subject,
            options.buildHtml(resident),
            options.attachments,
          );
        } catch (error) {
          this.logger.error(
            `Échec email résidence → ${resident.email} : ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
      this.logger.log(`Emails résidence envoyés : ${residents.length} destinataire(s)`);
    } catch (error) {
      this.logger.error(
        `Impossible de notifier la résidence : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Email aux habitants : nouveau signalement déclaré. */
  async sendIncidentToResidents(
    incident: { id: string; title: string; category: string; description: string },
    authorFirstName: string,
    attachments?: Array<{ filename: string; path: string }>,
    residenceId?: string | null,
  ): Promise<void> {
    if (!(await this.isResidentNotificationEnabled('incident'))) {
      this.logger.log('Notification incident à la résidence désactivée par l’admin (skippée).');
      return;
    }
    const categoryLabels: Record<string, string> = {
      WATER_LEAK: 'Fuite d’eau',
      ELEVATOR: 'Panne d’ascenseur',
      DAMAGE: 'Dégradation',
      OTHER: 'Autre',
    };
    const attachmentBuffers: Array<{ filename: string; content: Buffer }> = [];
    for (const attachment of attachments ?? []) {
      try {
        const uploads = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
        const content = await readFile(join(uploads, attachment.path));
        attachmentBuffers.push({ filename: attachment.filename, content });
      } catch (error) {
        this.logger.warn(
          `Pièce jointe illisible pour le mail résidence (${attachment.filename}) : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await this.notifyResidents({
      subject: `🛠️ Nouveau signalement : ${incident.title}`,
      buildHtml: (recipient) =>
        emailLayout({
          recipientFirstName: recipient.firstName,
          heading: '🛠️ Nouveau signalement dans la résidence',
          body: `
            <p>Un signalement a été déclaré par <strong>${this.escape(authorFirstName)}</strong> :</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:6px 0;color:#64748b;width:110px;">Type</td>
                <td style="padding:6px 0;"><strong>${this.escape(categoryLabels[incident.category] ?? incident.category)}</strong></td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;">Titre</td>
                <td style="padding:6px 0;"><strong>${this.escape(incident.title)}</strong></td>
              </tr>
            </table>
            <blockquote style="margin:12px 0 0;padding:10px 14px;border-left:3px solid #059669;background:#f8fafc;color:#334155;white-space:pre-line;">${this.escape(incident.description)}</blockquote>
            ${
              attachmentBuffers.length
                ? `<p style="margin:14px 0 0;font-size:13px;color:#64748b;"><strong>Pièces jointes :</strong> ${attachmentBuffers.map((a) => this.escape(a.filename)).join(', ')}</p>`
                : ''
            }`,
          ctaUrl: `${this.appUrl()}/signalements/${incident.id}`,
          ctaLabel: 'Voir le signalement',
        }),
      attachments: attachmentBuffers,
      residenceId,
    });
  }

  /** Email aux habitants : nouvelle annonce (si l'auteur a coché « notifier la résidence »). */
  async sendListingToResidents(
    listing: { id: string; title: string; description: string },
    authorFirstName: string,
    residenceId?: string | null,
  ): Promise<void> {
    if (!(await this.isResidentNotificationEnabled('listing'))) {
      this.logger.log('Notification annonce à la résidence désactivée par l’admin (skippée).');
      return;
    }
    await this.notifyResidents({
      subject: `📦 Nouvelle annonce : ${listing.title}`,
      buildHtml: (recipient) =>
        emailLayout({
          recipientFirstName: recipient.firstName,
          heading: '📦 Nouvelle annonce dans la résidence',
          body: `
            <p><strong>${this.escape(authorFirstName)}</strong> a publié une nouvelle annonce :</p>
            <p style="margin:12px 0 0;padding:10px 14px;border-left:3px solid #059669;background:#f8fafc;color:#334155;white-space:pre-line;">
              <strong>${this.escape(listing.title)}</strong><br/>${this.escape(listing.description)}
            </p>`,
          ctaUrl: `${this.appUrl()}/annonces/${listing.id}`,
          ctaLabel: 'Voir l’annonce',
        }),
      residenceId,
    });
  }

  // ─── Utilitaires ────────────────────────────────────────────

  private appUrl(): string {
    return process.env.APP_URL ?? 'http://localhost:3000';
  }

  /** Paiement reçu — l'espace de la résidence est en préparation. */
  async sendPaymentReceived(to: string, residenceName: string): Promise<void> {
    await this.sendMail(
      to,
      'Paiement reçu — votre espace Proximo est en préparation',
      emailLayout({
        recipientFirstName: to.split('@')[0],
        heading: '✅ Paiement reçu',
        body: `<p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Merci pour votre souscription ! Le paiement de <strong>190 €/an</strong> pour <strong>${this.escape(residenceName)}</strong> a bien été reçu.</p><p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#334155;">Nous créons maintenant l’espace de votre résidence. Comptez quelques minutes : vous recevrez un second email avec vos identifiants de connexion et le QR code à afficher.</p>`,
      }),
    );
  }

  /** Renouvellement annuel confirmé. */
  async sendRenewalConfirmed(to: string): Promise<void> {
    await this.sendMail(
      to,
      'Renouvellement Proximo confirmé',
      emailLayout({
        recipientFirstName: to.split('@')[0],
        heading: '🔁 Abonnement renouvelé',
        body: `<p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">Votre abonnement Proximo a été renouvelé pour une année. Merci de votre confiance !</p>`,
      }),
    );
  }

  /** Échappement HTML strict (anti-injection dans les templates). */
  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
