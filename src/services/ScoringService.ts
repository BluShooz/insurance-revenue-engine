import { prisma } from '../utils/prisma';
import { LeadStatus, IntentLevel, ActivityType, ActivityOutcome } from '@prisma/client';
import Logger from '../utils/logger';

const logger = new Logger('ScoringService');

/**
 * Scoring configuration
 * Adjust these weights to customize the scoring algorithm
 */
export const SCORING_CONFIG = {
  // Base scores
  BASE_SCORE: 0,
  MAX_SCORE: 100,

  // Intent level scores
  INTENT_HOT: 50,
  INTENT_WARM: 30,
  INTENT_COLD: 10,
  INTENT_UNKNOWN: 0,
  INTENT_NONE: -10,

  // Status scores
  STATUS_NEW: 0,
  STATUS_CONTACTED: 5,
  STATUS_ENGAGED: 15,
  STATUS_QUALIFIED: 30,
  STATUS_PROPOSAL: 45,
  STATUS_APPLICATION: 60,
  STATUS_UNDERWRITING: 75,
  STATUS_PLACED: 100,
  STATUS_NOT_PLACED: -20,
  STATUS_NOT_INTERESTED: -30,
  STATUS_UNRESPONSIVE: -10,
  STATUS_LOST: -20,

  // Activity type scores (per activity)
  ACTIVITY_MEETING_COMPLETED: 20,
  ACTIVITY_APPLICATION_SENT: 40,
  ACTIVITY_PROPOSAL_SENT: 15,
  ACTIVITY_CALL_INBOUND: 10,
  ACTIVITY_CALL_OUTBOUND: 5,
  ACTIVITY_TEXT_RECEIVED: 8,
  ACTIVITY_TEXT_SENT: 3,
  ACTIVITY_EMAIL_RECEIVED: 7,
  ACTIVITY_EMAIL_SENT: 2,
  ACTIVITY_APPOINTMENT_SET: 15,
  ACTIVITY_DEFAULT: 2,

  // Activity outcome modifiers
  OUTCOME_POSITIVE: 10,
  OUTCOME_INTERESTED: 15,
  OUTCOME_SOLD: 50,
  OUTCOME_NEUTRAL: 0,
  OUTCOME_NEGATIVE: -5,
  OUTCOME_NOT_INTERESTED: -15,
  OUTCOME_NO_ANSWER: -2,
  OUTCOME_LEFT_MESSAGE: 2,

  // Time decay (reduce score over time of inactivity)
  TIME_DECAY_ENABLED: true,
  TIME_DECAY_DAYS: [30, 60, 90], // Days at which to decay
  TIME_DECAY_AMOUNT: [5, 10, 20], // Points to subtract at each threshold
};

export interface LeadScoreBreakdown {
  currentScore: number;
  previousScore: number;
  change: number;
  breakdown: {
    baseScore: number;
    intentScore: number;
    statusScore: number;
    activityScore: number;
    outcomeScore: number;
    timeDecay: number;
  };
  reason: string;
}

/**
 * Scoring Service
 * Dynamically calculates and updates lead scores based on multiple factors
 */
export class ScoringService {
  /**
   * Calculate lead score based on current state
   */
  static async calculateLeadScore(leadId: string): Promise<LeadScoreBreakdown> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        activities: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    const previousScore = lead.score;

    // Calculate component scores
    const intentScore = this.getIntentScore(lead.intentLevel);
    const statusScore = this.getStatusScore(lead.status);
    const activityScore = await this.calculateActivityScore(lead.activities);
    const outcomeScore = this.calculateOutcomeScore(lead.activities);
    const timeDecay = this.calculateTimeDecay(lead.activities, lead.updatedAt);

    // Sum all components
    let newScore = SCORING_CONFIG.BASE_SCORE + intentScore + statusScore + activityScore + outcomeScore - timeDecay;

    // Ensure score is within bounds
    newScore = Math.max(0, Math.min(SCORING_CONFIG.MAX_SCORE, newScore));

    const change = newScore - previousScore;
    const reason = this.generateScoreReason(intentScore, statusScore, activityScore, outcomeScore, timeDecay);

    const breakdown: LeadScoreBreakdown = {
      currentScore: newScore,
      previousScore,
      change,
      breakdown: {
        baseScore: SCORING_CONFIG.BASE_SCORE,
        intentScore,
        statusScore,
        activityScore,
        outcomeScore,
        timeDecay,
      },
      reason,
    };

    return breakdown;
  }

  /**
   * Update lead score and save to database
   */
  static async updateLeadScore(leadId: string): Promise<LeadScoreBreakdown> {
    const breakdown = await this.calculateLeadScore(leadId);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        score: breakdown.currentScore,
      },
    });

    logger.scoring(leadId, breakdown.previousScore, breakdown.currentScore, breakdown.reason);

    return breakdown;
  }

  /**
   * Get score based on intent level
   */
  private static getIntentScore(intentLevel: IntentLevel): number {
    switch (intentLevel) {
      case 'HOT':
        return SCORING_CONFIG.INTENT_HOT;
      case 'WARM':
        return SCORING_CONFIG.INTENT_WARM;
      case 'COLD':
        return SCORING_CONFIG.INTENT_COLD;
      case 'NONE':
        return SCORING_CONFIG.INTENT_NONE;
      case 'UNKNOWN':
      default:
        return SCORING_CONFIG.INTENT_UNKNOWN;
    }
  }

  /**
   * Get score based on lead status
   */
  private static getStatusScore(status: LeadStatus): number {
    switch (status) {
      case 'PLACED':
        return SCORING_CONFIG.STATUS_PLACED;
      case 'UNDERWRITING':
        return SCORING_CONFIG.STATUS_UNDERWRITING;
      case 'APPLICATION':
        return SCORING_CONFIG.STATUS_APPLICATION;
      case 'PROPOSAL':
        return SCORING_CONFIG.STATUS_PROPOSAL;
      case 'QUALIFIED':
        return SCORING_CONFIG.STATUS_QUALIFIED;
      case 'ENGAGED':
        return SCORING_CONFIG.STATUS_ENGAGED;
      case 'CONTACTED':
        return SCORING_CONFIG.STATUS_CONTACTED;
      case 'NEW':
        return SCORING_CONFIG.STATUS_NEW;
      case 'UNRESPONSIVE':
        return SCORING_CONFIG.STATUS_UNRESPONSIVE;
      case 'NOT_PLACED':
        return SCORING_CONFIG.STATUS_NOT_PLACED;
      case 'LOST':
        return SCORING_CONFIG.STATUS_LOST;
      case 'NOT_INTERESTED':
        return SCORING_CONFIG.STATUS_NOT_INTERESTED;
      default:
        return SCORING_CONFIG.STATUS_NEW;
    }
  }

  /**
   * Calculate score from activities (activity types)
   */
  private static async calculateActivityScore(activities: any[]): Promise<number> {
    if (!activities || activities.length === 0) {
      return 0;
    }

    let score = 0;
    const recentActivities = activities.slice(0, 10); // Only count last 10 activities

    for (const activity of recentActivities) {
      score += this.getActivityTypeScore(activity.type);
    }

    // Cap activity score at 40 points
    return Math.min(40, score);
  }

  /**
   * Get score for a specific activity type
   */
  private static getActivityTypeScore(type: ActivityType): number {
    switch (type) {
      case 'MEETING_COMPLETED':
        return SCORING_CONFIG.ACTIVITY_MEETING_COMPLETED;
      case 'APPLICATION_SENT':
        return SCORING_CONFIG.ACTIVITY_APPLICATION_SENT;
      case 'PROPOSAL_SENT':
        return SCORING_CONFIG.ACTIVITY_PROPOSAL_SENT;
      case 'CALL_INBOUND':
        return SCORING_CONFIG.ACTIVITY_CALL_INBOUND;
      case 'CALL_OUTBOUND':
        return SCORING_CONFIG.ACTIVITY_CALL_OUTBOUND;
      case 'TEXT_RECEIVED':
        return SCORING_CONFIG.ACTIVITY_TEXT_RECEIVED;
      case 'TEXT_SENT':
        return SCORING_CONFIG.ACTIVITY_TEXT_SENT;
      case 'EMAIL_RECEIVED':
        return SCORING_CONFIG.ACTIVITY_EMAIL_RECEIVED;
      case 'EMAIL_SENT':
        return SCORING_CONFIG.ACTIVITY_EMAIL_SENT;
      case 'APPOINTMENT_SET':
        return SCORING_CONFIG.ACTIVITY_APPOINTMENT_SET;
      default:
        return SCORING_CONFIG.ACTIVITY_DEFAULT;
    }
  }

  /**
   * Calculate score from activity outcomes
   */
  private static calculateOutcomeScore(activities: any[]): number {
    if (!activities || activities.length === 0) {
      return 0;
    }

    let score = 0;
    const recentActivities = activities.slice(0, 5); // Only count last 5 outcomes

    for (const activity of recentActivities) {
      if (activity.outcome) {
        score += this.getOutcomeScore(activity.outcome);
      }
    }

    // Cap outcome score at 30 points
    return Math.min(30, score);
  }

  /**
   * Get score for a specific outcome
   */
  private static getOutcomeScore(outcome: ActivityOutcome): number {
    switch (outcome) {
      case 'SOLD':
        return SCORING_CONFIG.OUTCOME_SOLD;
      case 'INTERESTED':
        return SCORING_CONFIG.OUTCOME_INTERESTED;
      case 'POSITIVE':
        return SCORING_CONFIG.OUTCOME_POSITIVE;
      case 'NEUTRAL':
      case 'CALLBACK':
      case 'LEFT_MESSAGE':
      case 'FOLLOW_UP_SET':
        return SCORING_CONFIG.OUTCOME_NEUTRAL;
      case 'NEGATIVE':
        return SCORING_CONFIG.OUTCOME_NEGATIVE;
      case 'NOT_INTERESTED':
        return SCORING_CONFIG.OUTCOME_NOT_INTERESTED;
      case 'NO_ANSWER':
        return SCORING_CONFIG.OUTCOME_NO_ANSWER;
      default:
        return SCORING_CONFIG.OUTCOME_NEUTRAL;
    }
  }

  /**
   * Calculate time decay (score reduction for inactivity)
   */
  private static calculateTimeDecay(activities: any[], lastUpdated: Date): number {
    if (!SCORING_CONFIG.TIME_DECAY_ENABLED) {
      return 0;
    }

    const lastActivity = activities && activities.length > 0 ? activities[0].timestamp : lastUpdated;
    const daysSinceActivity = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));

    let decay = 0;
    for (let i = 0; i < SCORING_CONFIG.TIME_DECAY_DAYS.length; i++) {
      if (daysSinceActivity >= SCORING_CONFIG.TIME_DECAY_DAYS[i]) {
        decay = SCORING_CONFIG.TIME_DECAY_AMOUNT[i];
      }
    }

    return decay;
  }

  /**
   * Generate human-readable reason for score
   */
  private static generateScoreReason(
    intentScore: number,
    statusScore: number,
    activityScore: number,
    outcomeScore: number,
    timeDecay: number
  ): string {
    const reasons: string[] = [];

    if (intentScore > 0) {
      reasons.push(`Intent: +${intentScore}`);
    }
    if (statusScore > 0) {
      reasons.push(`Status: +${statusScore}`);
    }
    if (activityScore > 0) {
      reasons.push(`Activities: +${activityScore}`);
    }
    if (outcomeScore > 0) {
      reasons.push(`Positive outcomes: +${outcomeScore}`);
    }
    if (outcomeScore < 0) {
      reasons.push(`Negative outcomes: ${outcomeScore}`);
    }
    if (timeDecay > 0) {
      reasons.push(`Time decay: -${timeDecay}`);
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Initial score';
  }

  /**
   * Get top leads by score
   */
  static async getTopLeads(agentId: string, limit: number = 10) {
    const leads = await prisma.lead.findMany({
      where: {
        agentId,
        status: {
          notIn: ['PLACED', 'NOT_INTERESTED', 'LOST'],
        },
      },
      orderBy: {
        score: 'desc',
      },
      take: limit,
      include: {
        activities: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
        _count: {
          select: { activities: true },
        },
      },
    });

    return leads;
  }

  /**
   * Get leads by score range
   */
  static async getLeadsByScoreRange(agentId: string, minScore: number, maxScore: number) {
    return prisma.lead.findMany({
      where: {
        agentId,
        score: {
          gte: minScore,
          lte: maxScore,
        },
        status: {
          notIn: ['PLACED', 'NOT_INTERESTED', 'LOST'],
        },
      },
      orderBy: {
        score: 'desc',
      },
      include: {
        activities: {
          orderBy: { timestamp: 'desc' },
          take: 3,
        },
      },
    });
  }

  /**
   * Get lead score distribution
   */
  static async getScoreDistribution(agentId: string) {
    const leads = await prisma.lead.findMany({
      where: { agentId },
      select: { score: true, status: true },
    });

    const distribution = {
      hot: 0, // 70-100
      warm: 0, // 40-69
      cold: 0, // 10-39
      inactive: 0, // 0-9
      total: leads.length,
    };

    for (const lead of leads) {
      if (lead.score >= 70) distribution.hot++;
      else if (lead.score >= 40) distribution.warm++;
      else if (lead.score >= 10) distribution.cold++;
      else distribution.inactive++;
    }

    return distribution;
  }
}

export default ScoringService;
