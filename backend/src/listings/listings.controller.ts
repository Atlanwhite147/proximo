import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StatusGuard } from '../common/guards/status.guard';
import { CreateListingDto } from './dto/create-listing.dto';
import { QueryListingsDto } from './dto/query-listings.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

/**
 * Routes publiques : consultation des annonces.
 * Routes protégées : création, modification, suppression (propriétaire).
 */
@Controller('listings')
@UseGuards(JwtAuthGuard, StatusGuard)
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findAll(
    @Query() query: QueryListingsDto,
    @CurrentUser() user: { residenceId?: string | null },
  ) {
    const result = await this.listingsService.findAll(query, undefined, user.residenceId ?? null);
    return result;
  }

  @Get('mine')
  async mine(@CurrentUser() user: { id: string }) {
    const listings = await this.listingsService.findMine(user.id);
    return { listings };
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { residenceId?: string | null },
  ) {
    const listing = await this.listingsService.findOne(id, undefined, user.residenceId ?? null);
    return { listing };
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateListingDto) {
    const listing = await this.listingsService.create(user.id, dto);
    return { listing };
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateListingDto,
  ) {
    const listing = await this.listingsService.update(id, user.id, dto);
    return { listing };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, StatusGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    await this.listingsService.remove(id, user.id);
  }
}
