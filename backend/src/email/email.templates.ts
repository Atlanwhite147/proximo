/**
 * Templates HTML des emails Proximo (envoi transactionnel).
 * Style minimal, compatible Gmail/Outlook (inline CSS, table).
 */

interface BaseEmailOptions {
  /** Bandeau supérieur : prénom du destinataire (ex. « Bonjour Clara »). */
  recipientFirstName?: string;
  /** Emoji + titre de la section. */
  heading: string;
  /** Corps principal (paragraphe ou HTML simple). */
  body: string;
  /** Lien « Voir en ligne » (optionnel). */
  ctaUrl?: string;
  /** Libellé du bouton (défaut « Voir en ligne »). */
  ctaLabel?: string;
  /** Pied de page personnalisé (défaut : signature Proximo). */
  footer?: string;
}

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
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td style="border-radius:10px;background:#059669;"><a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(ctaLabel ?? 'Voir en ligne')}</a></td></tr></table>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#059669;padding:20px 32px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">🌿 Proximo</p>
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

/** Échappe les caractères HTML (titre/description fournis par les utilisateurs). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
