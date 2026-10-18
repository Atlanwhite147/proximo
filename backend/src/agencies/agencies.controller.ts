import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AgenciesService } from './agencies.service';
import { AddAgencyMemberDto, CreateAgencyDto, UpdateAgencyDto } from './dto/agency.dto';

/**
 * Agences et syndics gestionnaires, gérés par le superadministrateur de la
 * plateforme. Routes sous `/admin`, la création des comptes agence est
 * volontairement centralisée : aucune auto-inscription.
 */
@Controller('admin/agencies')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  /** Réservé au superadministrateur de la plateforme. */
  private assertSuperadmin(user: { role?: string }): void {
    if (user?.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Réservé au superadministrateur de la plateforme');
    }
  }

  @Get()
  async list(@CurrentUser() user: { role?: string }) {
    this.assertSuperadmin(user);
    return { agencies: await this.agenciesService.list() };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(@CurrentUser() user: { id: string; role?: string }, @Body() dto: CreateAgencyDto) {
    this.assertSuperadmin(user);
    return { agency: await this.agenciesService.create(user.id, dto) };
  }

  @Patch(':id')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { role?: string },
    @Body() dto: UpdateAgencyDto,
  ) {
    this.assertSuperadmin(user);
    return { agency: await this.agenciesService.update(id, dto) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { role?: string }) {
    this.assertSuperadmin(user);
    await this.agenciesService.remove(id);
  }

  /**
   * Crée un compte agence (email et mot de passe). Le titulaire reçoit un lien
   * pour définir son mot de passe : aucun mot de passe ne transite par ici.
   */
  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { role?: string },
    @Body() dto: AddAgencyMemberDto,
  ) {
    this.assertSuperadmin(user);
    return { member: await this.agenciesService.addMember(id, dto) };
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: { role?: string },
  ) {
    this.assertSuperadmin(user);
    await this.agenciesService.removeMember(id, userId);
  }
}
