import { redirect } from 'next/navigation';

/**
 * Ancienne URL de la page : redirection permanente vers le nom public
 * retenu, /annonces-officielles. Conservée pour ne casser aucun lien déjà
 * partagé vers cette adresse.
 */
export default function LegacyRedirect() {
  redirect('/annonces-officielles');
}
