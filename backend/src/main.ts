import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

/**
 * Point d'entrée de l'API Proximo.
 * Sécurisation globale : Helmet (en-têtes), cookies signés, validation
 * stricte des entrées, CORS restreint aux origines déclarées.
 */
async function bootstrap(): Promise<void> {
  // rawBody : conserve le corps brut des requêtes (nécessaire pour vérifier
  // la signature des webhooks Stripe).
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Un seul proxy (nginx) : nécessaire pour lire la vraie IP client
  // via X-Forwarded-For (rate limiting, logs).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // En-têtes de sécurité. API JSON uniquement : CSP stricte « rien par défaut »
  // (aucune ressource n'est censée être chargée depuis l'API) + frameguard
  // (X-Frame-Options: DENY, anti-clickjacking) — les autres en-têtes Helmet
  // (nosniff, Referrer-Policy) restent actifs par défaut.
  // nginx (edge) applique les mêmes en-têtes aux pages HTML du frontend ;
  // sur /api les doublons d'en-têtes identiques sont sans effet.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      frameguard: { action: 'deny' },
    }),
  );
  app.use(cookieParser());

  // Toutes les routes sous /api (ex. /api/auth/login)
  app.setGlobalPrefix('api');

  // Validation stricte : les champs inconnus sont rejetés, pas seulement ignorés.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS : uniquement les origines déclarées, avec credentials (cookies HTTP-only).
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`[Proximo] API démarrée sur http://0.0.0.0:${port}/api`);
}

void bootstrap();
