import { Module } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { AdminController } from './admin.controller';
import { ResidenceTransferService } from './residence-transfer.service';

@Module({
  imports: [IncidentsModule, InvitationsModule],
  controllers: [AdminController],
  providers: [ResidenceTransferService],
})
export class AdminModule {}
