import type { MetadataRoute } from 'next';

/**
 * robots.txt — autorise l'indexation des pages publiques (accueil, découverte,
 * souscription, légales) et bloque les zones à compte obligatoire ainsi que
 * les URL jetables d'invitation (tokens uniques).
 */
export default function robots(): MetadataRoute.Robots {
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
    sitemap: 'https://proximo.147.ovh/sitemap.xml',
  };
}
