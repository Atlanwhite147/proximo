import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { emailLayout, emailQuote, emailRow, escapeHtml } from './email.templates';

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

/** Répertoire des pièces jointes (volume Docker /data/uploads). */
export function uploadsDir(): string {
  return process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
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
 * Quota Brevo (offre gratuite, 300 emails/jour) : lorsqu'un envoi échoue pour
 * cause de quota, l'email est conservé dans la table `EmailOutbox` puis renvoyé
 * automatiquement à la prochaine réinitialisation du compteur (flush périodique
 * toutes les 10 min + tentative après chaque envoi réussi + bouton admin).
 *
 * Le service ne lève jamais d'exception bloquante : un échec d'envoi est loggé
 * et l'application continue (les emails ne doivent pas casser les flux).
 */
@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  /** Cache du quota Brevo (GET /account) — rafraîchi toutes les 45 s max. */
  private quotaCache: {
    at: number;
    remaining: number | null;
    limit: number | null;
  } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    void this.refreshTransporter();
    // File d'attente : tentative de renvoi toutes les 10 minutes (couvre la
    // réinitialisation quotidienne du quota Brevo).
    this.flushTimer = setInterval(
      () => {
        void this.flushOutbox().catch((error) =>
          this.logger.error(`Flush de la file d'emails : ${String(error)}`),
        );
      },
      10 * 60 * 1000,
    );
  }

  onModuleDestroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
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
        ...(mode === 'brevo' && brevoKey ? { brevoApiKey: brevoKey } : {}),
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

  /**
   * Envoi générique — ne lève jamais.
   * Retour : 'sent' | 'queued' (quota Brevo atteint → file d'attente) |
   * 'logged' (mode journal) | 'failed'.
   */
  /**
   * L'instance est-elle la BÊTA ? Tous les emails sortants sont alors marqués,
   * pour qu'un message de test ne puisse jamais être confondu avec un message
   * de production (sujet identique = clic sur le mauvais lien).
   */
  private isBetaInstance(): boolean {
    const appUrl = process.env.APP_URL ?? '';
    return appUrl.includes('bproximo') || process.env.APP_ENV === 'beta';
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<'sent' | 'queued' | 'logged' | 'failed'> {
    // Marquage bêta : sujet préfixé + bandeau en tête du message.
    if (this.isBetaInstance()) {
      subject = `[BÊTA] ${subject}`;
      html = `<div style="margin:0 0 16px;padding:12px 16px;background:#FEF3C7;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#92400E;"><strong>Instance de test (bêta)</strong> : ce message ne provient pas de la production.</div>${html}`;
    }
    try {
      const config = await this.resolveConfig();
      if (config.mode === 'brevo' && config.brevoApiKey) {
        // Quota déjà épuisé (cache) → on met en file sans tenter l'API.
        if (await this.isQuotaExhausted(config)) {
          await this.enqueueMail(to, subject, html, attachments);
          return 'queued';
        }
        await this.deliver(to, subject, html, config, attachments);
        // Un envoi a réussi : le quota est revenu (ou a de la marge) →
        // on éponge la file en arrière-plan.
        void this.flushOutbox();
        return 'sent';
      }
      if (config.mode === 'smtp' && config.smtp) {
        await this.deliver(to, subject, html, config, attachments);
        return 'sent';
      }
      this.logger.warn(
        `[email simulé] À: ${to} — Objet: ${subject}${
          attachments?.length ? ` — ${attachments.length} pièce(s) jointe(s)` : ''
        }`,
      );
      return 'logged';
    } catch (error) {
      if (this.isQuotaError(error)) {
        await this.enqueueMail(to, subject, html, attachments);
        return 'queued';
      }
      this.logger.error(
        `Échec d'envoi d'email à ${to} (« ${subject} ») : ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'failed';
    }
  }

  /** Transport effectif (Brevo / SMTP). Lève en cas d'échec. */
  private async deliver(
    to: string,
    subject: string,
    html: string,
    config: ResolvedEmailConfig,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    if (config.mode === 'brevo' && config.brevoApiKey) {
      await this.sendBrevo(to, subject, html, config, attachments);
      this.quotaCache = null; // le compteur a bougé → prochain GET /account frais
      return;
    }
    if (config.mode === 'smtp' && config.smtp) {
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
      return;
    }
    this.logger.warn(`[email simulé] À: ${to} — Objet: ${subject}`);
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

  // ─── Quota Brevo & file d'attente ──────────────────────────

  /** Détecte une erreur de quota (429 ou message Brevo explicite). */
  private isQuotaError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /Brevo 429|quota|daily limit|sending limit|maximum number of emails|plan limit/i.test(
      message,
    );
  }

  /**
   * Quota restant du compte Brevo (GET /account, cache 45 s).
   * Retourne { remaining: null } si non applicable (mode SMTP/journal) ou
   * si l'API ne répond pas — dans ce cas on tente l'envoi réel.
   */
  async getBrevoQuota(): Promise<{ remaining: number | null; limit: number | null }> {
    const config = await this.resolveConfig();
    if (config.mode !== 'brevo' || !config.brevoApiKey) {
      return { remaining: null, limit: null };
    }
    if (this.quotaCache && Date.now() - this.quotaCache.at < 45_000) {
      return { remaining: this.quotaCache.remaining, limit: this.quotaCache.limit };
    }
    try {
      const response = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': config.brevoApiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        return { remaining: null, limit: null };
      }
      const data = (await response.json()) as {
        plan?: Array<{ type?: string; creditsType?: string; credits?: number }>;
      };
      const plans = data.plan ?? [];
      const sendLimit = plans.find((p) => p.creditsType === 'sendLimit');
      const isFree = plans.some((p) => String(p.type).toLowerCase().includes('free'));
      const remaining = typeof sendLimit?.credits === 'number' ? sendLimit.credits : null;
      const limit = isFree ? 300 : null;
      this.quotaCache = { at: Date.now(), remaining, limit };
      return { remaining, limit };
    } catch {
      return { remaining: null, limit: null };
    }
  }

  /** Quota déjà épuisé ? (mode Brevo uniquement ; cache 45 s). */
  private async isQuotaExhausted(config: ResolvedEmailConfig): Promise<boolean> {
    if (config.mode !== 'brevo' || !config.brevoApiKey) return false;
    const { remaining } = await this.getBrevoQuota();
    return remaining !== null && remaining <= 0;
  }

  /** Conserve un email dans la file (quota Brevo atteint). */
  private async enqueueMail(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    try {
      const storedAttachments: Array<{ filename: string; path: string }> = [];
      if (attachments?.length) {
        const id = randomUUID();
        const dir = join(uploadsDir(), 'outbox', id);
        await mkdir(dir, { recursive: true });
        for (let index = 0; index < attachments.length; index += 1) {
          const attachment = attachments[index];
          const safeName = basename(attachment.filename) || `piece-${index + 1}`;
          await writeFile(join(dir, safeName), attachment.content);
          storedAttachments.push({ filename: safeName, path: `outbox/${id}/${safeName}` });
        }
      }
      await this.prisma.emailOutbox.create({
        data: {
          to,
          subject,
          html,
          attachments: storedAttachments.length ? JSON.stringify(storedAttachments) : null,
        },
      });
      this.logger.log(`Quota Brevo atteint — email mis en file pour ${to} (« ${subject} »).`);
    } catch (error) {
      this.logger.error(
        `Impossible de mettre l'email en file pour ${to} : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Renvoie les emails en attente (appelé périodiquement, après chaque envoi
   * réussi, et via le bouton admin). S'arrête si le quota est de nouveau atteint.
   */
  async flushOutbox(): Promise<{ flushed: number; remaining: number }> {
    try {
      const pending = await this.prisma.emailOutbox.findMany({
        where: { sentAt: null, attempts: { lt: 5 } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      if (pending.length === 0) {
        return { flushed: 0, remaining: 0 };
      }
      const config = await this.resolveConfig();
      if (config.mode === 'log') {
        return { flushed: 0, remaining: pending.length };
      }

      let flushed = 0;
      for (const mail of pending) {
        if ((await this.isQuotaExhausted(config)) || this.isQuotaError(undefined)) break;
        const attachments = await this.readOutboxAttachments(mail.attachments);
        try {
          await this.deliver(mail.to, mail.subject, mail.html, config, attachments);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.prisma.emailOutbox.update({
            where: { id: mail.id },
            data: {
              attempts: { increment: 1 },
              lastError: message.slice(0, 500),
            },
          });
          if (this.isQuotaError(error)) {
            this.logger.warn(
              `File d'emails : quota toujours atteint après ${mail.attempts + 1} tentative(s) — nouvel essai au prochain cycle.`,
            );
            break;
          }
          continue; // erreur ponctuelle : on tente le suivant
        }
        await this.prisma.emailOutbox.update({
          where: { id: mail.id },
          data: { sentAt: new Date() },
        });
        await this.cleanupOutboxFiles(mail.attachments);
        flushed += 1;
      }
      const remaining = await this.prisma.emailOutbox.count({
        where: { sentAt: null, attempts: { lt: 5 } },
      });
      if (flushed > 0) {
        this.logger.log(`File d'emails : ${flushed} renvoyé(s), ${remaining} restant(s).`);
      }
      return { flushed, remaining };
    } catch (error) {
      this.logger.error(`Flush de la file d'emails : ${String(error)}`);
      return { flushed: 0, remaining: -1 };
    }
  }

  /** Relit les pièces jointes d'un email en file (JSON → buffers). */
  private async readOutboxAttachments(
    raw: string | null,
  ): Promise<Array<{ filename: string; content: Buffer }>> {
    if (!raw) return [];
    try {
      const items = JSON.parse(raw) as Array<{ filename: string; path: string }>;
      const result: Array<{ filename: string; content: Buffer }> = [];
      for (const item of items) {
        try {
          const content = await readFile(join(uploadsDir(), item.path));
          result.push({ filename: item.filename, content });
        } catch {
          // Fichier absent (purge des signalements, etc.) : on envoie sans.
        }
      }
      return result;
    } catch {
      return [];
    }
  }

  /** Supprime les fichiers temporaires d'un email en file une fois envoyé. */
  private async cleanupOutboxFiles(raw: string | null): Promise<void> {
    if (!raw) return;
    try {
      const items = JSON.parse(raw) as Array<{ path: string }>;
      for (const item of items) {
        // Les chemins sont de la forme outbox/<id>/<fichier> (jamais absolus).
        if (item.path.startsWith('outbox/') && !item.path.includes('..')) {
          await unlink(join(uploadsDir(), item.path)).catch(() => undefined);
        }
      }
    } catch {
      // Sans gravité : nettoyage best-effort.
    }
  }

  /** État de la file d'attente (admin). */
  async getOutboxStatus(): Promise<{
    pending: number;
    oldestCreatedAt: string | null;
    lastError: string | null;
  }> {
    const [pending, oldest] = await Promise.all([
      this.prisma.emailOutbox.count({ where: { sentAt: null, attempts: { lt: 5 } } }),
      this.prisma.emailOutbox.findFirst({
        where: { sentAt: null },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, lastError: true },
      }),
    ]);
    return {
      pending,
      oldestCreatedAt: oldest ? oldest.createdAt.toISOString() : null,
      lastError: oldest?.lastError ?? null,
    };
  }

  // ─── Emails transactionnels ─────────────────────────────────

  /** Export de résidence : lien de téléchargement à usage unique. */
  async sendResidenceExport(
    to: string,
    firstName: string | undefined,
    residenceName: string,
    link: string,
    expiresHours: number,
  ): Promise<void> {
    await this.sendMail(
      to,
      `Export Proximo · ${residenceName}`,
      emailLayout({
        recipientFirstName: firstName,
        heading: 'Votre export de résidence est prêt',
        body: `
          <p>L&apos;export chiffré de la résidence <strong>${escapeHtml(residenceName)}</strong>
          (habitants, annonces, signalements et photos, commentaires, conversations,
          invitations) vient d&apos;être généré à votre demande.</p>
          <p><strong>Ce lien est à usage unique</strong> et expire dans ${expiresHours} heures.
          Le fichier est supprimé du serveur dès le premier téléchargement.</p>
          <p>Il est protégé par la phrase de passe que vous avez choisie : conservez-la
          séparément, car sans elle l&apos;export est définitivement illisible.</p>`,
        ctaUrl: link,
        ctaLabel: "Télécharger l'export",
        footer:
          "Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe et contactez-nous.",
      }),
    );
  }

  async sendWelcome(to: string, firstName: string): Promise<void> {
    await this.sendMail(
      to,
      'Bienvenue sur Proximo',
      emailLayout({
        recipientFirstName: firstName,
        heading: 'Votre compte est créé',
        body: `
          <p>Votre compte Proximo a été créé pour rejoindre la vie de votre résidence :
          annonces entre voisins, signalements au syndic et discussions.</p>
          <p>Un administrateur doit valider votre inscription avant que vous puissiez
          échanger avec les autres habitants. Vous pourrez vous connecter dès que
          votre compte sera actif.</p>`,
        ctaUrl: `${this.appUrl()}/connexion`,
        ctaLabel: 'Se connecter',
      }),
    );
  }

  async sendNewMessage(to: string, fromFirstName: string, preview: string): Promise<void> {
    await this.sendMail(
      to,
      `Nouveau message de ${fromFirstName} · Proximo`,
      emailLayout({
        recipientFirstName: '',
        heading: 'Nouveau message',
        body: `
          <p><strong>${escapeHtml(fromFirstName)}</strong> vous a écrit :</p>
          ${emailQuote(escapeHtml(preview))}`,
        ctaUrl: `${this.appUrl()}/messages`,
        ctaLabel: 'Ouvrir la conversation',
      }),
    );
  }

  /**
   * Email à l'agence / au syndic : nouveau signalement déclaré par un habitant.
   * Destinataire non connecté à l'application → la fiche doit être autonome
   * (résidence, type, localisation, déclarant, description, pièces jointes).
   */
  async sendIncidentToSyndic(
    syndicEmail: string,
    incident: {
      title: string;
      category: string;
      description: string;
      neighborhood?: string | null;
    },
    author: {
      firstName: string;
      lastName: string;
      email: string;
      contactDetails?: string | null;
    },
    attachments: Array<{ filename: string; path?: string }>,
    residence?: { name: string | null; agencyName?: string | null } | null,
  ): Promise<void> {
    const categoryLabels: Record<string, string> = {
      WATER_LEAK: 'Fuite d’eau',
      ELEVATOR: 'Panne d’ascenseur',
      DAMAGE: 'Dégradation',
      OTHER: 'Autre',
    };
    const residenceName = residence?.name?.trim() || null;
    const subject = residenceName
      ? `[${residenceName}] Signalement : ${incident.title}`
      : `Signalement Proximo : ${incident.title}`;

    const rows = [
      ...(residenceName ? [emailRow('Résidence', escapeHtml(residenceName))] : []),
      emailRow('Type', escapeHtml(categoryLabels[incident.category] ?? incident.category)),
      emailRow('Localisation', escapeHtml(incident.neighborhood?.trim() || 'Non précisée')),
      emailRow(
        'Déclaré par',
        `${escapeHtml(author.firstName)} ${escapeHtml(author.lastName)}${
          author.contactDetails ? ` — ${escapeHtml(author.contactDetails)}` : ''
        } <a href="mailto:${escapeHtml(author.email)}" style="color:#0052FF;">${escapeHtml(author.email)}</a>`,
      ),
      ...(attachments.length
        ? [emailRow('Pièces jointes', `${attachments.length} photo(s) en pièce jointe`)]
        : []),
    ];

    await this.sendMail(
      syndicEmail,
      subject,
      emailLayout({
        recipientFirstName: '',
        heading: 'Nouveau signalement dans la résidence',
        body: `
          <p>Un habitant a déclaré un signalement via l'application Proximo${
            residenceName ? ` de <strong>${escapeHtml(residenceName)}</strong>` : ''
          } :</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;margin:4px 0 0;">
            ${rows.join('')}
          </table>
          ${emailQuote(escapeHtml(incident.description))}
          <p style="margin:14px 0 0;font-size:13px;color:#64748b;">Ce signalement a été envoyé automatiquement
          depuis l'application de la résidence. Vous pouvez répondre à l'habitant
          en utilisant l'adresse ci-dessus.</p>`,
      }),
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
      emailLayout({
        recipientFirstName: '',
        heading: 'Mise à jour de votre signalement',
        body: `
          <p>Votre signalement <strong>« ${escapeHtml(incidentTitle)} »</strong> est désormais :
          <strong>${labels[status] ?? status}</strong></p>
          ${adminNote ? emailQuote(escapeHtml(adminNote)) : ''}`,
        ctaUrl: `${this.appUrl()}/signalements`,
        ctaLabel: 'Voir mes signalements',
      }),
    );
  }

  // ─── Notifications à la résidence ───────────────────────────

  /**
   * Interrupteurs de notification PAR RÉSIDENCE (gérés par l'admin local dans
   * Réglages). Sans résidence (legacy / dev) : envoi autorisé (défaut).
   */
  private async residentNotificationsEnabled(
    residenceId: string | null | undefined,
    kind: 'incident' | 'listing',
  ): Promise<boolean> {
    try {
      if (!residenceId) return true;
      const residence = await this.prisma.residence.findUnique({
        where: { id: residenceId },
        select: {
          notifyResidentsOnIncident: true,
          notifyResidentsOnListing: true,
        },
      });
      if (!residence) return true;
      return kind === 'incident'
        ? residence.notifyResidentsOnIncident
        : residence.notifyResidentsOnListing;
    } catch {
      return true; // En cas d'erreur, on laisse passer (défaut sécurisé : envoyer).
    }
  }

  /**
   * Envoie un email à tous les habitants ACTIVE de la résidence (sauf l'auteur)
   * qui n'ont pas désactivé les notifications email. Ne lève jamais.
   */
  async notifyResidents(options: {
    subject: string;
    /** Construit le HTML pour un destinataire (prénom + lien personnalisés). */
    buildHtml: (recipient: { firstName: string; lastName: string }) => string;
    excludeUserId?: string;
    /** Multi-résidences : restreint l'envoi aux habitants de CETTE résidence. */
    residenceId?: string | null;
    attachments?: Array<{ filename: string; content: Buffer }>;
  }): Promise<{ sent: number; queued: number; optedOut: number }> {
    const result = { sent: 0, queued: 0, optedOut: 0 };
    try {
      const residents = await this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          emailNotifications: true, // opt-out individuel respecté
          ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
          ...(options.residenceId ? { residenceId: options.residenceId } : {}),
        },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      const optedOutCount = options.residenceId
        ? await this.prisma.user.count({
            where: {
              status: 'ACTIVE',
              emailNotifications: false,
              ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
              residenceId: options.residenceId,
            },
          })
        : 0;
      result.optedOut = optedOutCount;
      for (const resident of residents) {
        const status = await this.sendMail(
          resident.email,
          options.subject,
          options.buildHtml(resident),
          options.attachments,
        );
        if (status === 'queued') result.queued += 1;
        else result.sent += 1;
      }
      this.logger.log(
        `Emails résidence (${options.residenceId ?? 'global'}) : ${result.sent} envoyé(s), ` +
          `${result.queued} en file (quota), ${result.optedOut} désinscrit(s).`,
      );
    } catch (error) {
      this.logger.error(
        `Impossible de notifier la résidence : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return result;
  }

  /** Email aux habitants : nouveau signalement déclaré. */
  async sendIncidentToResidents(
    incident: { id: string; title: string; category: string; description: string },
    authorFirstName: string,
    attachments?: Array<{ filename: string; path: string }>,
    residenceId?: string | null,
  ): Promise<void> {
    if (!(await this.residentNotificationsEnabled(residenceId, 'incident'))) {
      this.logger.log(`Notifications « signalement » désactivées pour cette résidence (skippées).`);
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
        const content = await readFile(join(uploadsDir(), attachment.path));
        attachmentBuffers.push({ filename: attachment.filename, content });
      } catch (error) {
        this.logger.warn(
          `Pièce jointe illisible pour le mail résidence (${attachment.filename}) : ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    await this.notifyResidents({
      subject: `Nouveau signalement : ${incident.title}`,
      buildHtml: (recipient) =>
        emailLayout({
          recipientFirstName: recipient.firstName,
          heading: 'Nouveau signalement dans la résidence',
          body: `
            <p>Un signalement a été déclaré par <strong>${escapeHtml(authorFirstName)}</strong> :</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
              ${emailRow('Type', escapeHtml(categoryLabels[incident.category] ?? incident.category))}
              ${emailRow('Titre', escapeHtml(incident.title))}
            </table>
            ${emailQuote(escapeHtml(incident.description))}
            ${
              attachmentBuffers.length
                ? `<p style="margin:12px 0 0;font-size:13px;color:#64748b;"><strong>Pièces jointes :</strong> ${attachmentBuffers.map((a) => escapeHtml(a.filename)).join(', ')}</p>`
                : ''
            }`,
          ctaUrl: `${this.appUrl()}/signalements/${incident.id}`,
          ctaLabel: 'Voir le signalement',
        }),
      excludeUserId: undefined,
      residenceId,
      attachments: attachmentBuffers,
    });
  }

  /** Email aux habitants : nouvelle annonce (si l'auteur a coché « notifier la résidence »). */
  async sendListingToResidents(
    listing: { id: string; title: string; description: string },
    authorFirstName: string,
    residenceId?: string | null,
  ): Promise<void> {
    if (!(await this.residentNotificationsEnabled(residenceId, 'listing'))) {
      this.logger.log(`Notifications « annonce » désactivées pour cette résidence (skippées).`);
      return;
    }
    await this.notifyResidents({
      subject: `Nouvelle annonce : ${listing.title}`,
      buildHtml: (recipient) =>
        emailLayout({
          recipientFirstName: recipient.firstName,
          heading: 'Nouvelle annonce entre voisins',
          body: `
            <p><strong>${escapeHtml(authorFirstName)}</strong> a publié une nouvelle annonce :</p>
            <p style="margin:12px 0 0;padding:12px 14px;border-left:3px solid #0052FF;background:#f8fafc;color:#334155;white-space:pre-line;">
              <strong>${escapeHtml(listing.title)}</strong><br/>${escapeHtml(listing.description)}
            </p>`,
          ctaUrl: `${this.appUrl()}/annonces/${listing.id}`,
          ctaLabel: 'Voir l’annonce',
        }),
      excludeUserId: undefined,
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
        heading: 'Paiement reçu',
        body: `
          <p>Merci pour votre souscription ! Le paiement pour <strong>${escapeHtml(residenceName)}</strong>
          a bien été reçu.</p>
          <p>Nous créons maintenant l'espace de votre résidence. Comptez quelques minutes :
          vous recevrez un second email avec vos identifiants de connexion et le QR code à afficher.</p>`,
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
        heading: 'Abonnement renouvelé',
        body: `<p>Votre abonnement Proximo a été renouvelé pour une année. Merci de votre confiance !</p>`,
      }),
    );
  }
}
