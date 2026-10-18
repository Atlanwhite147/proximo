import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgenciesController } from './agencies.controller';
import { AgenciesService } from './agencies.service';

/** Agences gestionnaires : entité, périmètre de résidences, comptes AGENCE. */
@Module({
  imports: [AuthModule],
  controllers: [AgenciesController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
