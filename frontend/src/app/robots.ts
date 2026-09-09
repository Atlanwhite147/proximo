import type { MetadataRoute } from 'next';

/**
 * robots.txt — autorise l'indexation des pages publiques (accueil, découverte,
 * souscription, légales) et bloque les zones à compte obligatoire ainsi que
 * les URL jetables d'invitation (tokens uniques).
 * Route DYNAMIQUE : la base URL vient de l'ENV runtime (APP_URL).
 */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? 'https://proximo.147.ovh';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/decouvrir', '/souscrire', '/confidentialite', '/mentions-legales'],
        disallow: [
          '/api/',
          '/admin',
          '/annonces',
          '/signalements',
          '/messages',
          '/profil',
          '/connexion',
          '/inscription',
          '/install',
          '/inviter',
          '/rejoindre',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
