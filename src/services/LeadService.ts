import { prisma } from '../utils/prisma';
import { LeadStatus, IntentLevel } from '@prisma/client';
import Logger from '../utils/logger';
import ScoringService from './ScoringService';
import AutomationService from './AutomationService';
import ActivityService from './ActivityService';

const logger = new Logger('LeadService');

export interface CreateLeadParams {
  agentId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  status?: LeadStatus;
  intentLevel?: IntentLevel;
  source?: string;
  notes?: string;
  dateOfBirth?: Date;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface UpdateLeadParams {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  status?: LeadStatus;
  intentLevel?: IntentLevel;
  source?: string;
  notes?: string;
  dateOfBirth?: Date;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface ListLeadsFilters {
  status?: LeadStatus;
  intentLevel?: IntentLevel;
  minScore?: number;
  maxScore?: number;
  source?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'score' | 'lastName';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Lead Service
 * Handles lead creation, updates, and retrieval
 * Integrates with scoring, automation, and activity services
 */
export class LeadService {
  /**
   * Create a new lead
   * Automatically initializes score and triggers welcome automation
   */
  static async createLead(params: CreateLeadParams): Promise<void> {
    const {
      agentId,
      firstName,
      lastName,
      phone,
      email,
      status = 'NEW',
      intentLevel = 'UNKNOWN',
      source,
      notes,
      dateOfBirth,
      address,
      city,
      state,
      zipCode,
    } = params;

    // Check for duplicate lead (by phone or email)
    const existingLead = await prisma.lead.findFirst({
      where: {
        agentId,
        OR: [
          { phone: phone },
          ...(email ? [{ email: email }] : []),
        ],
      },
    });

    if (existingLead) {
      logger.warning('Duplicate lead detected', {
        existingLeadId: existingLead.id,
        phone,
        email,
      });
      throw new Error(
        `Lead already exists with phone ${phone}${email ? ` or email ${email}` : ''}`
      );
    }

    // Create lead
    const lead = await prisma.lead.create({
      data: {
        agentId,
        firstName,
        lastName,
        phone,
        email,
        status,
        intentLevel,
        source,
        notes,
        dateOfBirth,
        address,
        city,
        state,
        zipCode,
        score: 0, // Initial score, will be calculated
      },
    });

    logger.info('Lead created', {
      leadId: lead.id,
      name: `${firstName} ${lastName}`,
      phone,
      email,
      source,
    });

    // Calculate and update initial score
    await ScoringService.updateLeadScore(lead.id);

    // Trigger automation
    await AutomationService.handleLeadCreated(lead);

    logger.success('Lead created and processed');
  }

  /**
   * Update an existing lead
   */
  static async updateLead(leadId: string, params: UpdateLeadParams): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const previousStatus = lead.status;
    const previousIntentLevel = lead.intentLevel;

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        ...(params.firstName !== undefined && { firstName: params.firstName }),
        ...(params.lastName !== undefined && { lastName: params.lastName }),
        ...(params.phone !== undefined && { phone: params.phone }),
        ...(params.email !== undefined && { email: params.email }),
        ...(params.status !== undefined && { status: params.status }),
        ...(params.intentLevel !== undefined && { intentLevel: params.intentLevel }),
        ...(params.source !== undefined && { source: params.source }),
        ...(params.notes !== undefined && { notes: params.notes }),
        ...(params.dateOfBirth !== undefined && { dateOfBirth: params.dateOfBirth }),
        ...(params.address !== undefined && { address: params.address }),
        ...(params.city !== undefined && { city: params.city }),
        ...(params.state !== undefined && { state: params.state }),
        ...(params.zipCode !== undefined && { zipCode: params.zipCode }),
      },
    });

    logger.info('Lead updated', {
      leadId,
      changes: Object.keys(params),
    });

    // Update score if status or intent level changed
    if (params.status || params.intentLevel) {
      await ScoringService.updateLeadScore(leadId);
    }

    // Trigger automation if status changed
    if (params.status && params.status !== previousStatus) {
      await AutomationService.handleLeadStatusChanged(leadId, previousStatus, params.status);
    }

    logger.success('Lead updated');
  }

  /**
   * Update lead status
   */
  static async updateStatus(leadId: string, newStatus: LeadStatus): Promise<void> {
    await this.updateLead(leadId, { status: newStatus });
  }

  /**
   * Update lead intent level
   */
  static async updateIntentLevel(leadId: string, newIntentLevel: IntentLevel): Promise<void> {
    await this.updateLead(leadId, { intentLevel: newIntentLevel });
  }

  /**
   * Get a single lead by ID
   */
  static async getLead(leadId: string) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        activities: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
        policies: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            activities: true,
            policies: true,
          },
        },
      },
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    return lead;
  }

  /**
   * List leads with optional filters
   */
  static async listLeads(agentId: string, filters: ListLeadsFilters = {}) {
    const where: any = { agentId };

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.intentLevel) {
      where.intentLevel = filters.intentLevel;
    }

    if (filters.minScore !== undefined || filters.maxScore !== undefined) {
      where.score = {};
      if (filters.minScore !== undefined) {
        where.score.gte = filters.minScore;
      }
      if (filters.maxScore !== undefined) {
        where.score.lte = filters.maxScore;
      }
    }

    if (filters.source) {
      where.source = { contains: filters.source, mode: 'insensitive' };
    }

    // Determine sort order
    const sortBy = filters.sortBy || 'createdAt';
    const sortOrder = filters.sortOrder || 'desc';

    const leads = await prisma.lead.findMany({
      where,
      include: {
        _count: {
          select: {
            activities: true,
            policies: true,
          },
        },
        policies: {
          where: { status: 'ISSUED' },
          select: {
            id: true,
            carrier: true,
            productType: true,
            faceAmount: true,
            premium: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });

    // Get total count for pagination
    const total = await prisma.lead.count({ where });

    return {
      leads,
      total,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
    };
  }

  /**
   * Delete a lead
   */
  static async deleteLead(leadId: string): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    // Cascade delete will handle activities and policies
    await prisma.lead.delete({
      where: { id: leadId },
    });

    logger.warning('Lead deleted', {
      leadId,
      name: `${lead.firstName} ${lead.lastName}`,
    });
  }

  /**
   * Search leads by keyword
   */
  static async searchLeads(agentId: string, keyword: string, limit: number = 20) {
    return prisma.lead.findMany({
      where: {
        agentId,
        OR: [
          { firstName: { contains: keyword, mode: 'insensitive' } },
          { lastName: { contains: keyword, mode: 'insensitive' } },
          { email: { contains: keyword, mode: 'insensitive' } },
          { phone: { contains: keyword } },
          { notes: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      include: {
        _count: {
          select: {
            activities: true,
            policies: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get leads by status
   */
  static async getLeadsByStatus(agentId: string, status: LeadStatus) {
    return prisma.lead.findMany({
      where: {
        agentId,
        status,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get leads by intent level
   */
  static async getLeadsByIntentLevel(agentId: string, intentLevel: IntentLevel) {
    return prisma.lead.findMany({
      where: {
        agentId,
        intentLevel,
      },
      orderBy: { score: 'desc' },
    });
  }

  /**
   * Get hot leads (high score, not yet placed)
   */
  static async getHotLeads(agentId: string, minScore: number = 70) {
    return prisma.lead.findMany({
      where: {
        agentId,
        score: { gte: minScore },
        status: {
          notIn: ['PLACED', 'NOT_INTERESTED', 'LOST'],
        },
      },
      orderBy: { score: 'desc' },
      include: {
        activities: {
          orderBy: { timestamp: 'desc' },
          take: 3,
        },
        _count: {
          select: { activities: true },
        },
      },
    });
  }

  /**
   * Get leads that need follow-up (no recent activity)
   */
  static async getLeadsNeedingFollowUp(agentId: string, daysSinceLastActivity: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceLastActivity);

    const leads = await prisma.lead.findMany({
      where: {
        agentId,
        status: {
          in: ['NEW', 'CONTACTED', 'ENGAGED', 'QUALIFIED', 'PROPOSAL'],
        },
        NOT: {
          activities: {
            some: {
              timestamp: { gte: cutoffDate },
            },
          },
        },
      },
      orderBy: { score: 'desc' },
      include: {
        activities: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });

    return leads;
  }

  /**
   * Get lead statistics
   */
  static async getLeadStats(agentId: string) {
    const [total, byStatus, byIntent, scoreDistribution, placedThisMonth] = await Promise.all([
      prisma.lead.count({ where: { agentId } }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { agentId },
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['intentLevel'],
        where: { agentId },
        _count: true,
      }),
      ScoringService.getScoreDistribution(agentId),
      // Policies placed this month
      prisma.lead.count({
        where: {
          agentId,
          status: 'PLACED',
          updatedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    const statusCounts = byStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const intentCounts = byIntent.reduce((acc, item) => {
      acc[item.intentLevel] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byStatus: statusCounts,
      byIntent: intentCounts,
      scoreDistribution,
      placedThisMonth,
    };
  }

  /**
   * Get lead conversion funnel
   */
  static async getConversionFunnel(agentId: string) {
    const leads = await prisma.lead.findMany({
      where: { agentId },
      select: { status: true },
    });

    const funnel = {
      NEW: 0,
      CONTACTED: 0,
      ENGAGED: 0,
      QUALIFIED: 0,
      PROPOSAL: 0,
      APPLICATION: 0,
      UNDERWRITING: 0,
      PLACED: 0,
      NOT_PLACED: 0,
      NOT_INTERESTED: 0,
      LOST: 0,
      UNRESPONSIVE: 0,
    };

    for (const lead of leads) {
      funnel[lead.status]++;
    }

    return funnel;
  }

  /**
   * Bulk import leads from CSV/JSON
   */
  static async bulkImportLeads(
    agentId: string,
    leads: Array<{
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      source?: string;
      notes?: string;
    }>
  ): Promise<{ imported: number; failed: number; errors: string[] }> {
    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const leadData of leads) {
      try {
        await this.createLead({
          agentId,
          ...leadData,
        });
        imported++;
      } catch (error) {
        failed++;
        errors.push(
          `${leadData.firstName} ${leadData.lastName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    logger.info(`Bulk import completed: ${imported} imported, ${failed} failed`);

    return { imported, failed, errors };
  }
}

export default LeadService;
