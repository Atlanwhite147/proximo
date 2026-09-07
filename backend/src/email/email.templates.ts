/**
 * Templates HTML des emails Proximo (envoi transactionnel).
 * Style aligné sur le design system « Minimalist Modern » (Electric Blue
 * #0052FF), sobre, compatible Gmail/Outlook (inline CSS, table 600px).
 */

interface BaseEmailOptions {
  /** Bandeau supérieur : prénom du destinataire (ex. « Bonjour Clara »). */
  recipientFirstName?: string;
  /** Titre de la section. */
  heading: string;
  /** Corps principal (paragraphe ou HTML simple). */
  body: string;
  /** Lien d'action (optionnel). */
  ctaUrl?: string;
  /** Libellé du bouton (défaut « Voir en ligne »). */
  ctaLabel?: string;
  /** Pied de page personnalisé (défaut : signature Proximo). */
  footer?: string;
}

/** Couleur de marque (Electric Blue — design system frontend). */
const BRAND = '#0052FF';

/** Enveloppe HTML commune (table 600px, bouton arrondi). */
export function emailLayout({
  recipientFirstName,
  heading,
  body,
  ctaUrl,
  ctaLabel,
  footer,
}: BaseEmailOptions): string {
  const greeting = recipientFirstName
    ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Bonjour ${escapeHtml(recipientFirstName)},</p>`
    : '';
  const button = ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td style="border-radius:10px;background:${BRAND};"><a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(ctaLabel ?? 'Voir en ligne')}</a></td></tr></table>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:${BRAND};padding:20px 32px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">Proximo</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0f172a;">${heading}</p>
              ${greeting}
              <div style="font-size:15px;line-height:1.7;color:#334155;">${body}</div>
              ${button}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                ${footer ?? 'Ce message vous est envoyé via Proximo, la vie de votre résidence.'}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Ligne d'une fiche récapitulative (libellé / valeur). */
export function emailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:5px 0;color:#64748b;width:130px;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;"><strong>${value}</strong></td>
  </tr>`;
}

/** Citation / encadré (description, note). */
export function emailQuote(content: string): string {
  return `<p style="margin:14px 0 0;padding:12px 14px;border-left:3px solid ${BRAND};background:#f8fafc;color:#334155;white-space:pre-line;">${content}</p>`;
}

/** Échappe les caractères HTML (titre/description fournis par les utilisateurs). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
