import type { Metadata } from 'next';
import { Calistoga, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';

const calistoga = Calistoga({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-calistoga',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://proximo.147.ovh'),
  title: {
    default: 'Proximo · La vie de votre résidence',
    template: '%s · Proximo',
  },
  description:
    "Plateforme open source de vie de résidence : annonces entre voisins, signalements au syndic, invitations de voisinage. Connectez votre immeuble.",
  keywords: [
    'vie de résidence',
    'voisins',
    'immeuble',
    'copropriété',
    'annonces de quartier',
    'entraide entre voisins',
    'signalement syndic',
  ],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://proximo.147.ovh',
    siteName: 'Proximo',
    title: 'Proximo · La vie de votre résidence',
    description:
      'Annonces entre voisins, signalements au syndic, invitations de voisinage : connectez votre résidence.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${calistoga.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
            <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4">
              <span title="En savoir plus sur Proximo">
                ⓘ Proximo, une initiative des habitants
              </span>
              <span aria-hidden>·</span>
              <a href="/mentions-legales" className="hover:text-brand-600">
                Mentions légales
              </a>
              <span aria-hidden>·</span>
              <a href="/confidentialite" className="hover:text-brand-600">
                Confidentialité
              </a>
              <span aria-hidden>·</span>
              <a href="/cgu" className="hover:text-brand-600">
                CGU
              </a>
              <span aria-hidden>·</span>
              <a href="mailto:proximo@147.ovh" className="hover:text-brand-600">
                Nous contacter
              </a>
              <span aria-hidden>·</span>
              <a
                href="https://github.com/Atlanwhite147/proximo/issues/new"
                target="_blank"
                rel="noreferrer"
                className="hover:text-brand-600"
              >
                Signaler un bug
              </a>
              <span aria-hidden>·</span>
              <a
                href="https://github.com/Atlanwhite147/proximo"
                target="_blank"
                rel="noreferrer"
                className="hover:text-brand-600"
              >
                Code source
              </a>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
