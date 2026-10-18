import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgenciesController } from './agencies.controller';
import { AgencySelfController } from './agency-self.controller';
import { AgenciesService } from './agencies.service';

/** Agences gestionnaires : entité, périmètre de résidences, comptes AGENCE. */
@Module({
  imports: [AuthModule],
  controllers: [AgenciesController, AgencySelfController],
  providers: [AgenciesService],
  exports: [AgenciesService],
})
export class AgenciesModule {}
