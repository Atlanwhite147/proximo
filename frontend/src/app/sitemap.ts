import type { MetadataRoute } from 'next';

/**
 * Sitemap public — pages indexables par Google.
 * Les pages privées (connexion, inscription, admin, messagerie, annonces
 * résidents…) sont exclues : elles exigent un compte et ne doivent pas
 * apparaître dans les résultats.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://proximo.147.ovh';

  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/decouvrir`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/souscrire`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/confidentialite`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/mentions-legales`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
