import { prisma } from '../utils/prisma';
import { ActivityType, ActivityOutcome, LeadStatus } from '@prisma/client';
import Logger from '../utils/logger';
import ScoringService from './ScoringService';
import AutomationService from './AutomationService';

const logger = new Logger('ActivityService');

export interface CreateActivityParams {
  agentId: string;
  leadId: string;
  type: ActivityType;
  outcome?: ActivityOutcome;
  title: string;
  description?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateActivityParams {
  type?: ActivityType;
  outcome?: ActivityOutcome;
  title?: string;
  description?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Activity Service
 * Handles logging, tracking, and managing all lead activities
 * Activities drive lead scoring and trigger automations
 */
export class ActivityService {
  /**
   * Log a new activity
   * Automatically updates lead score and triggers automations
   */
  static async logActivity(params: CreateActivityParams): Promise<void> {
    const { agentId, leadId, type, outcome, title, description, duration, metadata } = params;

    // Validate lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    // Create activity
    const activity = await prisma.activity.create({
      data: {
        agentId,
        leadId,
        type,
        outcome,
        title,
        description,
        duration,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    logger.info('Activity logged', {
      activityId: activity.id,
      leadId,
      type,
      outcome,
    });

    // Update lead score based on new activity
    await ScoringService.updateLeadScore(leadId);

    // Trigger automations
    await AutomationService.handleActivityLogged(leadId, type, outcome || null);

    // Auto-update lead status based on activity type/outcome
    await this.autoUpdateLeadStatus(leadId, type, outcome);

    logger.success('Activity processed and score updated');
  }

  /**
   * Get all activities for a lead
   */
  static async getLeadActivities(
    leadId: string,
    options?: {
      limit?: number;
      offset?: number;
      type?: ActivityType;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: any = { leadId };

    if (options?.type) {
      where.type = options.type;
    }

    if (options?.startDate || options?.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = options.startDate;
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate;
      }
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    return activities;
  }

  /**
   * Get activities for an agent
   */
  static async getAgentActivities(
    agentId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: any = { agentId };

    if (options?.startDate || options?.endDate) {
      where.timestamp = {};
      if (options.startDate) {
        where.timestamp.gte = options.startDate;
      }
      if (options.endDate) {
        where.timestamp.lte = options.endDate;
      }
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        lead: true,
      },
      orderBy: { timestamp: 'desc' },
      take: options?.limit || 100,
      skip: options?.offset || 0,
    });

    return activities;
  }

  /**
   * Get a single activity by ID
   */
  static async getActivity(activityId: string) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        lead: true,
        agent: true,
      },
    });

    if (!activity) {
      throw new Error(`Activity not found: ${activityId}`);
    }

    return activity;
  }

  /**
   * Update an existing activity
   */
  static async updateActivity(activityId: string, params: UpdateActivityParams): Promise<void> {
    const { type, outcome, title, description, duration, metadata } = params;

    const activity = await prisma.activity.update({
      where: { id: activityId },
      data: {
        ...(type !== undefined && { type }),
        ...(outcome !== undefined && { outcome }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(duration !== undefined && { duration }),
        ...(metadata !== undefined && { metadata: JSON.stringify(metadata) }),
      },
    });

    logger.info('Activity updated', {
      activityId,
      leadId: activity.leadId,
    });

    // Update lead score
    await ScoringService.updateLeadScore(activity.leadId);
  }

  /**
   * Delete an activity
   */
  static async deleteActivity(activityId: string): Promise<void> {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new Error(`Activity not found: ${activityId}`);
    }

    const leadId = activity.leadId;

    await prisma.activity.delete({
      where: { id: activityId },
    });

    logger.info('Activity deleted', {
      activityId,
      leadId,
    });

    // Update lead score
    await ScoringService.updateLeadScore(leadId);
  }

  /**
   * Get activity statistics for a lead
   */
  static async getLeadActivityStats(leadId: string) {
    const activities = await prisma.activity.findMany({
      where: { leadId },
    });

    const stats = {
      total: activities.length,
      byType: {} as Record<string, number>,
      byOutcome: {} as Record<string, number>,
      lastActivity: activities[0] || null,
      firstActivity: activities[activities.length - 1] || null,
    };

    for (const activity of activities) {
      stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
      if (activity.outcome) {
        stats.byOutcome[activity.outcome] = (stats.byOutcome[activity.outcome] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Get activity statistics for an agent
   */
  static async getAgentActivityStats(agentId: string, startDate?: Date, endDate?: Date) {
    const where: any = { agentId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const activities = await prisma.activity.findMany({ where });

    const stats = {
      total: activities.length,
      byType: {} as Record<string, number>,
      byOutcome: {} as Record<string, number>,
      totalDuration: activities.reduce((sum, a) => sum + (a.duration || 0), 0),
      uniqueLeads: new Set(activities.map(a => a.leadId)).size,
    };

    for (const activity of activities) {
      stats.byType[activity.type] = (stats.byType[activity.type] || 0) + 1;
      if (activity.outcome) {
        stats.byOutcome[activity.outcome] = (stats.byOutcome[activity.outcome] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Auto-update lead status based on activity type and outcome
   */
  private static async autoUpdateLeadStatus(
    leadId: string,
    activityType: ActivityType,
    outcome: ActivityOutcome | undefined
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return;
    }

    let newStatus: LeadStatus | null = null;

    // Determine if status should change based on activity
    switch (activityType) {
      case 'CALL_OUTBOUND':
      case 'CALL_INBOUND':
        if (lead.status === 'NEW') {
          newStatus = 'CONTACTED';
        }
        break;

      case 'MEETING_SCHEDULED':
      case 'APPOINTMENT_SET':
        if (['NEW', 'CONTACTED'].includes(lead.status)) {
          newStatus = 'ENGAGED';
        }
        break;

      case 'MEETING_COMPLETED':
        if (outcome === 'INTERESTED' || outcome === 'POSITIVE') {
          newStatus = 'QUALIFIED';
        } else if (outcome === 'NOT_INTERESTED') {
          newStatus = 'NOT_INTERESTED';
        }
        break;

      case 'PROPOSAL_SENT':
        if (['QUALIFIED', 'ENGAGED'].includes(lead.status)) {
          newStatus = 'PROPOSAL';
        }
        break;

      case 'APPLICATION_SENT':
        if (['PROPOSAL', 'QUALIFIED'].includes(lead.status)) {
          newStatus = 'APPLICATION';
        }
        break;

      default:
        break;
    }

    // Apply status change if determined
    if (newStatus && newStatus !== lead.status) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: newStatus },
      });

      logger.info(`Auto-updated lead status: ${lead.status} → ${newStatus}`, {
        leadId,
        activityType,
        outcome,
      });

      // Trigger automation for status change
      await AutomationService.handleLeadStatusChanged(leadId, lead.status, newStatus);
    }
  }

  /**
   * Get recent activities for dashboard
   */
  static async getRecentActivities(agentId: string, limit: number = 10) {
    return prisma.activity.findMany({
      where: { agentId },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
            score: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Search activities by keyword
   */
  static async searchActivities(agentId: string, keyword: string, limit: number = 20) {
    return prisma.activity.findMany({
      where: {
        agentId,
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}

export default ActivityService;
