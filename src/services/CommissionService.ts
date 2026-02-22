import { prisma } from '../utils/prisma';
import { CommissionType, CommissionStatus, PolicyStatus, ProductType } from '@prisma/client';
import Logger from '../utils/logger';

const logger = new Logger('CommissionService');

/**
 * Commission rates by product type (configurable)
 * These can be overridden by passing custom rates
 */
export const DEFAULT_COMMISSION_RATES: Record<ProductType, number> = {
  TERM_LIFE: 0.90, // 90% of first-year premium (typical for independent agents)
  WHOLE_LIFE: 0.55, // 55% of base premium
  UNIVERSAL_LIFE: 0.55,
  FINAL_EXPENSE: 0.60, // 60% for simplified issue
  IUL: 0.50,
  HEALTH_ACA: 0.04, // ~4% per month for ACA plans
  HEALTH_SHORT_TERM: 0.20,
  MEDICARE_SUPPLEMENT: 0.25,
  MEDICARE_ADVANTAGE: 0.30,
  DENTAL: 0.20,
  VISION: 0.15,
  DISABILITY_INCOME: 0.40,
  CRITICAL_ILLNESS: 0.35,
  LONG_TERM_CARE: 0.35,
  ANNUITY: 0.04, // Trail-based
  OTHER: 0.25,
};

/**
 * Renewal commission rates (typically much lower)
 */
export const RENEWAL_COMMISSION_RATES: Partial<Record<ProductType, number>> = {
  TERM_LIFE: 0.0, // Term life typically has no renewals
  WHOLE_LIFE: 0.035, // 3.5% renewal
  UNIVERSAL_LIFE: 0.035,
  FINAL_EXPENSE: 0.03,
  IUL: 0.025,
  HEALTH_ACA: 0.04, // ACA pays monthly as long as active
  MEDICARE_SUPPLEMENT: 0.025,
  MEDICARE_ADVANTAGE: 0.0,
  ANNUITY: 0.01, // 1% trail
};

export interface CalculateCommissionParams {
  policyId: string;
  premium: number;
  productType: ProductType;
  commissionRate?: number;
  type?: CommissionType;
}

export interface CommissionResult {
  commissionAmount: number;
  commissionRate: number;
  type: CommissionType;
}

export interface CreateCommissionParams {
  policyId: string;
  agentId: string;
  amount: number;
  type: CommissionType;
  scheduledDate?: Date;
}

/**
 * Commission Service
 * Handles commission calculation, creation, and payment tracking
 */
export class CommissionService {
  /**
   * Calculate commission amount based on policy details
   */
  static async calculateCommission(
    params: CalculateCommissionParams
  ): Promise<CommissionResult> {
    const { premium, productType, commissionRate: customRate, type = 'FIRST_YEAR' } = params;

    // Use custom rate if provided, otherwise use default
    let commissionRate = customRate;
    if (commissionRate === undefined) {
      if (type === 'RENEWAL') {
        commissionRate = RENEWAL_COMMISSION_RATES[productType] || 0;
      } else {
        commissionRate = DEFAULT_COMMISSION_RATES[productType];
      }
    }

    const commissionAmount = premium * (commissionRate || 0);

    logger.info(`Commission calculated`, {
      productType,
      premium,
      commissionRate: commissionRate || 0,
      commissionAmount,
      type,
    });

    return {
      commissionAmount,
      commissionRate: commissionRate || 0,
      type,
    };
  }

  /**
   * Create a commission record
   */
  static async createCommission(params: CreateCommissionParams): Promise<void> {
    const { policyId, agentId, amount, type, scheduledDate } = params;

    const commission = await prisma.commission.create({
      data: {
        policyId,
        agentId,
        amount: amount,
        type,
        status: 'PENDING',
        scheduledDate: scheduledDate || this.calculateScheduledDate(type),
      },
    });

    logger.commission('CREATED', Number(amount), {
      commissionId: commission.id,
      policyId,
      agentId,
      type,
      scheduledDate: commission.scheduledDate,
    });
  }

  /**
   * Calculate scheduled date for commission payment
   * Based on commission type and carrier typical payment schedules
   */
  private static calculateScheduledDate(type: CommissionType): Date {
    const now = new Date();

    switch (type) {
      case 'FIRST_YEAR':
        // First-year commissions typically paid 2-4 weeks after policy issue
        now.setDate(now.getDate() + 21);
        break;
      case 'RENEWAL':
        // Renewals paid on policy anniversary
        now.setFullYear(now.getFullYear() + 1);
        break;
      case 'BONUS':
        // Bonuses typically paid monthly or quarterly
        now.setDate(now.getDate() + 30);
        break;
      default:
        now.setDate(now.getDate() + 30);
    }

    return now;
  }

  /**
   * Calculate and create commission when policy is issued
   */
  static async handlePolicyIssued(policyId: string): Promise<void> {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { agent: true },
    });

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // Calculate first-year commission
    const result = await this.calculateCommission({
      policyId,
      premium: Number(policy.premium),
      productType: policy.productType,
      type: 'FIRST_YEAR',
    });

    // Create commission record
    await this.createCommission({
      policyId,
      agentId: policy.agentId,
      amount: result.commissionAmount,
      type: result.type,
    });

    // Update policy with commission info
    await prisma.policy.update({
      where: { id: policyId },
      data: {
        commissionAmount: result.commissionAmount,
        commissionRate: result.commissionRate,
      },
    });

    logger.success(`Commission created for issued policy`, {
      policyId,
      commissionAmount: result.commissionAmount,
    });
  }

  /**
   * Mark commission as paid
   */
  static async markAsPaid(commissionId: string, paidDate: Date = new Date()): Promise<void> {
    const commission = await prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: 'PAID',
        paidDate,
      },
    });

    logger.commission('PAID', Number(commission.amount), {
      commissionId,
      policyId: commission.policyId,
      paidDate,
    });
  }

  /**
   * Mark commission as paid by policy ID
   */
  static async markPolicyCommissionAsPaid(policyId: string): Promise<void> {
    const commission = await prisma.commission.findFirst({
      where: {
        policyId,
        status: 'PENDING',
      },
    });

    if (!commission) {
      throw new Error(`No pending commission found for policy: ${policyId}`);
    }

    await this.markAsPaid(commission.id);
  }

  /**
   * Get all commissions for an agent
   */
  static async getAgentCommissions(agentId: string, status?: CommissionStatus) {
    const where: any = { agentId };
    if (status) {
      where.status = status;
    }

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        policy: {
          include: {
            lead: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'desc',
      },
    });

    return commissions;
  }

  /**
   * Get commission summary statistics
   */
  static async getCommissionSummary(agentId: string) {
    const [pending, paid, totalPending, totalPaid] = await Promise.all([
      prisma.commission.count({ where: { agentId, status: 'PENDING' } }),
      prisma.commission.count({ where: { agentId, status: 'PAID' } }),
      prisma.commission.aggregate({
        where: { agentId, status: 'PENDING' },
        _sum: { amount: true },
      }),
      prisma.commission.aggregate({
        where: { agentId, status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    return {
      pendingCount: pending,
      paidCount: paid,
      pendingAmount: Number(totalPending._sum.amount || 0),
      paidAmount: Number(totalPaid._sum.amount || 0),
      totalAmount: Number(totalPending._sum.amount || 0) + Number(totalPaid._sum.amount || 0),
    };
  }

  /**
   * Create renewal commission for an existing policy
   * (Called annually by a scheduled job)
   */
  static async createRenewalCommission(policyId: string): Promise<void> {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy || policy.status !== 'ISSUED') {
      logger.warning(`Cannot create renewal commission for non-issued policy: ${policyId}`);
      return;
    }

    const renewalRate = RENEWAL_COMMISSION_RATES[policy.productType];
    if (!renewalRate || renewalRate === 0) {
      logger.info(`No renewal commission for product type: ${policy.productType}`);
      return;
    }

    const result = await this.calculateCommission({
      policyId,
      premium: Number(policy.premium),
      productType: policy.productType,
      type: 'RENEWAL',
    });

    await this.createCommission({
      policyId,
      agentId: policy.agentId,
      amount: result.commissionAmount,
      type: 'RENEWAL',
    });
  }

  /**
   * Handle clawback of commission
   */
  static async clawbackCommission(commissionId: string, reason: string): Promise<void> {
    const commission = await prisma.commission.update({
      where: { id: commissionId },
      data: {
        status: 'CLAWED_BACK',
        notes: reason,
      },
    });

    logger.warning('Commission clawed back', {
      commissionId,
      policyId: commission.policyId,
      amount: Number(commission.amount),
      reason,
    });
  }
}

export default CommissionService;
