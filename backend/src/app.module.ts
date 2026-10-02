import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { CommerceModule } from './commerce/commerce.module';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { OriginCheckGuard } from './common/guards/origin-check.guard';
import { EmailModule } from './email/email.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { HealthModule } from './health/health.module';
import { IncidentsModule } from './incidents/incidents.module';
import { InvitationsModule } from './invitations/invitations.module';
import { LeadsModule } from './leads/leads.module';
import { ListingsModule } from './listings/listings.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { SetupModule } from './setup/setup.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Limitation globale du débit : 300 requêtes / minute / IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    // JwtService disponible globalement (utilisé par les guards d'authentification).
    JwtModule.register({ global: true }),
    PrismaModule,
    EmailModule,
    HealthModule,
    GeocodingModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    MessagesModule,
    IncidentsModule,
    InvitationsModule,
    LeadsModule,
    CommerceModule,
    CommentsModule,
    AdminModule,
    AnnouncementsModule,
    SetupModule,
  ],
  providers: [
    // Ordre d'exécution : vérification d'origine (anti-CSRF) puis rate limiting.
    { provide: APP_GUARD, useClass: OriginCheckGuard },
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
  ],
})
export class AppModule {}
