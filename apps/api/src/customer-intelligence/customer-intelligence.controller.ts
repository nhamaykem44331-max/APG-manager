// APG Manager RMS - Customer Intelligence Controller
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import {
  InteractionsService,
  CreateInteractionDto, CreateNoteDto, UpdateNoteDto,
} from './interactions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerIntelligenceController {
  constructor(
    private intelligence: CustomerIntelligenceService,
    private interactions: InteractionsService,
  ) {}

  // === Customer Intelligence ===

  @Get('customer-intelligence/segments')
  getSegments() {
    return this.intelligence.getSegments();
  }

  @Get('customer-intelligence/at-risk')
  getAtRisk() {
    return this.intelligence.getAtRiskCustomers();
  }

  @Get('customer-intelligence/follow-ups')
  getFollowUps() {
    return this.intelligence.getTodayFollowUps();
  }

  @Get('customer-intelligence/:customerId/rfm')
  getRfm(@Param('customerId') customerId: string) {
    return this.intelligence.getRfmScore(customerId);
  }

  @Get('customer-intelligence/:customerId/timeline')
  getTimeline(@Param('customerId') customerId: string) {
    return this.intelligence.getCustomerTimeline(customerId);
  }

  // === Customer Interactions ===

  @Get('customers/:id/interactions')
  listInteractions(
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    return this.interactions.listInteractions(id, Number(page) || 1);
  }

  @Post('customers/:id/interactions')
  createInteraction(
    @Param('id') id: string,
    @Body() dto: CreateInteractionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.interactions.createInteraction(id, user.id, dto);
  }

  // === Customer Notes ===

  @Get('customers/:id/notes')
  listNotes(@Param('id') id: string) {
    return this.interactions.listNotes(id);
  }

  @Post('customers/:id/notes')
  createNote(
    @Param('id') id: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.interactions.createNote(id, user.id, dto);
  }

  @Patch('customers/:customerId/notes/:noteId')
  updateNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.interactions.updateNote(noteId, dto);
  }

  @Delete('customers/:customerId/notes/:noteId')
  deleteNote(@Param('noteId') noteId: string) {
    return this.interactions.deleteNote(noteId);
  }
}
