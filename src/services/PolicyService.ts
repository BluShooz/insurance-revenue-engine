import { prisma } from '../utils/prisma';
import { PolicyStatus, ProductType, PremiumMode, LeadStatus } from '@prisma/client';
import Logger from '../utils/logger';
import CommissionService, { CalculateCommissionParams } from './CommissionService';
import AutomationService from './AutomationService';
import ActivityService from './ActivityService';
import ScoringService from './ScoringService';

const logger = new Logger('PolicyService');

export interface CreatePolicyParams {
  agentId: string;
  leadId: string;
  carrier: string;
  productType: ProductType;
  faceAmount: number;
  premium: number;
  commissionRate?: number;
  term?: number;
  policyNumber?: string;
  mode?: PremiumMode;
  status?: PolicyStatus;
}

export interface UpdatePolicyParams {
  carrier?: string;
  productType?: ProductType;
  faceAmount?: number;
  premium?: number;
  commissionRate?: number;
  status?: PolicyStatus;
  issueDate?: Date;
  effectiveDate?: Date;
  term?: number;
  policyNumber?: string;
  mode?: PremiumMode;
}

/**
 * Policy Service
 * Handles policy creation, updates, and status changes
 * Integrates with commission and automation services
 */
export class PolicyService {
  /**
   * Create a new policy
   * Automatically calculates commission and triggers automations
   */
  static async createPolicy(params: CreatePolicyParams): Promise<void> {
    const {
      agentId,
      leadId,
      carrier,
      productType,
      faceAmount,
      premium,
      commissionRate: customCommissionRate,
      term,
      policyNumber,
      mode = 'MONTHLY',
      status = 'APPLIED',
    } = params;

    // Validate lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      throw new Error(`Lead not found: ${leadId}`);
    }

    // Calculate commission
    const commissionResult = await CommissionService.calculateCommission({
      policyId: '', // Will be set after creation
      premium,
      productType,
      commissionRate: customCommissionRate,
      type: 'FIRST_YEAR',
    });

    // Create policy
    const policy = await prisma.policy.create({
      data: {
        agentId,
        leadId,
        carrier,
        productType,
        faceAmount: faceAmount,
        premium: premium,
        commissionRate: commissionResult.commissionRate,
        commissionAmount: commissionResult.commissionAmount,
        status,
        term,
        policyNumber,
        mode,
      },
    });

    logger.info('Policy created', {
      policyId: policy.id,
      leadId,
      carrier,
      productType,
      faceAmount,
      premium,
      commissionAmount: commissionResult.commissionAmount,
    });

    // Log activity
    await ActivityService.logActivity({
      agentId,
      leadId,
      type: 'APPLICATION_SENT',
      title: `Policy application submitted: ${productType.replace(/_/g, ' ')}`,
      description: `Application submitted to ${carrier} for $${faceAmount} ${productType.replace(/_/g, ' ')} policy. Premium: $${premium}`,
    });

    // Update lead status to APPLICATION
    if (lead.status !== 'APPLICATION' && lead.status !== 'UNDERWRITING') {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: 'APPLICATION' },
      });
      logger.info(`Lead status updated to APPLICATION`, { leadId });
    }

    // Update lead score
    await ScoringService.updateLeadScore(leadId);

    // Trigger automation
    await AutomationService.handlePolicyCreated(
      policy.id,
      leadId,
      productType,
      premium
    );

    // If status is ISSUED, handle commission
    if (status === 'ISSUED') {
      await this.handlePolicyIssued(policy.id);
    }

    logger.success('Policy created and processed');
  }

  /**
   * Update an existing policy
   */
  static async updatePolicy(policyId: string, params: UpdatePolicyParams): Promise<void> {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { lead: true },
    });

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const previousStatus = policy.status;

    // Update policy
    const updatedPolicy = await prisma.policy.update({
      where: { id: policyId },
      data: {
        ...(params.carrier !== undefined && { carrier: params.carrier }),
        ...(params.productType !== undefined && { productType: params.productType }),
        ...(params.faceAmount !== undefined && { faceAmount: params.faceAmount }),
        ...(params.premium !== undefined && { premium: params.premium }),
        ...(params.status !== undefined && { status: params.status }),
        ...(params.issueDate !== undefined && { issueDate: params.issueDate }),
        ...(params.effectiveDate !== undefined && { effectiveDate: params.effectiveDate }),
        ...(params.term !== undefined && { term: params.term }),
        ...(params.policyNumber !== undefined && { policyNumber: params.policyNumber }),
        ...(params.mode !== undefined && { mode: params.mode }),
      },
    });

    logger.info('Policy updated', {
      policyId,
      changes: Object.keys(params),
    });

    // If premium changed, recalculate commission (only if not yet issued)
    if (params.premium && previousStatus === 'QUOTED' && !params.status) {
      const commissionResult = await CommissionService.calculateCommission({
        policyId,
        premium: params.premium,
        productType: updatedPolicy.productType,
        type: 'FIRST_YEAR',
      });

      await prisma.policy.update({
        where: { id: policyId },
        data: {
          commissionRate: commissionResult.commissionRate,
          commissionAmount: commissionResult.commissionAmount,
        },
      });
    }

    // If status changed to ISSUED, handle commission
    if (params.status === 'ISSUED' && previousStatus !== 'ISSUED') {
      await this.handlePolicyIssued(policyId);
    }

    // If status changed from APPLIED to UNDERWRITING
    if (params.status === 'UNDERWRITING' && previousStatus !== 'UNDERWRITING') {
      await this.handlePolicyInUnderwriting(policyId);
    }

    // If status changed to DECLINED, POSTPONED, or WITHDRAWN
    if (params.status && ['DECLINED', 'POSTPONED', 'WITHDRAWN'].includes(params.status as string)) {
      await this.handlePolicyNotIssued(policyId, params.status as 'DECLINED' | 'POSTPONED' | 'WITHDRAWN');
    }

    logger.success('Policy updated');
  }

  /**
   * Update policy status
   */
  static async updatePolicyStatus(
    policyId: string,
    newStatus: PolicyStatus,
    issueDate?: Date
  ): Promise<void> {
    await this.updatePolicy(policyId, {
      status: newStatus,
      ...(issueDate && { issueDate }),
    });
  }

  /**
   * Handle policy issued event
   */
  private static async handlePolicyIssued(policyId: string): Promise<void> {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: { lead: true },
    });

    if (!policy) {
      return;
    }

    // Set issue date if not already set
    if (!policy.issueDate) {
      await prisma.policy.update({
        where: { id: policyId },
        data: { issueDate: new Date() },
      });
    }

    // Create commission
    await CommissionService.handlePolicyIssued(policyId);

    // Update lead status to PLACED
    await prisma.lead.update({
      where: { id: policy.leadId },
      data: { status: 'PLACED' },
    });

    // Log activity
    await ActivityService.logActivity({
      agentId: policy.agentId,
      leadId: policy.leadId,
      type: 'NOTE',
      title: `Policy issued: ${policy.productType.replace(/_/g, ' ')}`,
      description: `Policy issued with ${policy.carrier}. Policy number: ${policy.policyNumber || 'Pending'}`,
      outcome: 'SOLD',
    });

    // Trigger automation
    await AutomationService.handlePolicyIssued(
      policyId,
      policy.leadId,
      policy.carrier,
      policy.productType
    );

    logger.success(`Policy issued: ${policyId}`);
  }

  /**
   * Handle policy in underwriting
   */
  private static async handlePolicyInUnderwriting(policyId: string): Promise<void> {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      return;
    }

    // Update lead status to UNDERWRITING
    await prisma.lead.update({
      where: { id: policy.leadId },
      data: { status: 'UNDERWRITING' },
    });

    // Log activity
    await ActivityService.logActivity({
      agentId: policy.agentId,
      leadId: policy.leadId,
      type: 'NOTE',
      title: 'Policy in underwriting',
      description: `Application for ${policy.productType.replace(/_/g, ' ')} is now in underwriting review with ${policy.carrier}`,
    });

    // Update lead score
    await ScoringService.updateLeadScore(policy.leadId);

    logger.info(`Policy in underwriting: ${policyId}`);
  }

  /**
   * Handle policy not issued (declined, postponed, withdrawn)
   */
  private static async handlePolicyNotIssued(
    policyId: string,
    status: 'DECLINED' | 'POSTPONED' | 'WITHDRAWN'
  ): Promise<void> {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      return;
    }

    // Update lead status based on outcome
    const leadStatus: LeadStatus = status === 'WITHDRAWN' ? 'LOST' : 'NOT_PLACED';

    await prisma.lead.update({
      where: { id: policy.leadId },
      data: { status: leadStatus },
    });

    // Log activity
    await ActivityService.logActivity({
      agentId: policy.agentId,
      leadId: policy.leadId,
      type: 'NOTE',
      title: `Policy ${status.toLowerCase()}`,
      description: `${policy.productType.replace(/_/g, ' ')} application with ${policy.carrier} was ${status.toLowerCase()}`,
    });

    // Update lead score
    await ScoringService.updateLeadScore(policy.leadId);

    logger.warning(`Policy ${status.toLowerCase()}: ${policyId}`);
  }

  /**
   * Get policy by ID
   */
  static async getPolicy(policyId: string) {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        lead: true,
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        commissions: true,
      },
    });

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    return policy;
  }

  /**
   * Get all policies for an agent
   */
  static async getAgentPolicies(
    agentId: string,
    filters?: {
      status?: PolicyStatus;
      productType?: ProductType;
      carrier?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const where: any = { agentId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.productType) {
      where.productType = filters.productType;
    }

    if (filters?.carrier) {
      where.carrier = { contains: filters.carrier, mode: 'insensitive' };
    }

    const policies = await prisma.policy.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        commissions: {
          where: { status: 'PENDING' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });

    return policies;
  }

  /**
   * Get policies for a lead
   */
  static async getLeadPolicies(leadId: string) {
    return prisma.policy.findMany({
      where: { leadId },
      include: {
        commissions: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get policy statistics for an agent
   */
  static async getAgentPolicyStats(agentId: string, startDate?: Date, endDate?: Date) {
    const where: any = { agentId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const policies = await prisma.policy.findMany({ where });

    const stats = {
      total: policies.length,
      byStatus: {} as Record<string, number>,
      byProductType: {} as Record<string, number>,
      byCarrier: {} as Record<string, number>,
      totalFaceAmount: policies
        .filter(p => p.status === 'ISSUED')
        .reduce((sum, p) => sum + Number(p.faceAmount), 0),
      totalAnnualPremium: policies
        .filter(p => p.status === 'ISSUED')
        .reduce((sum, p) => sum + Number(p.premium), 0),
      totalPendingCommissions: 0,
    };

    // Calculate pending commissions
    const pendingCommissions = await prisma.commission.findMany({
      where: {
        agentId,
        status: 'PENDING',
      },
    });

    stats.totalPendingCommissions = pendingCommissions.reduce(
      (sum, c) => sum + Number(c.amount),
      0
    );

    for (const policy of policies) {
      stats.byStatus[policy.status] = (stats.byStatus[policy.status] || 0) + 1;
      stats.byProductType[policy.productType] = (stats.byProductType[policy.productType] || 0) + 1;
      stats.byCarrier[policy.carrier] = (stats.byCarrier[policy.carrier] || 0) + 1;
    }

    return stats;
  }

  /**
   * Search policies by keyword (carrier, policy number, etc.)
   */
  static async searchPolicies(agentId: string, keyword: string, limit: number = 20) {
    return prisma.policy.findMany({
      where: {
        agentId,
        OR: [
          { carrier: { contains: keyword, mode: 'insensitive' } },
          { policyNumber: { contains: keyword, mode: 'insensitive' } },
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
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get policies pending requirements
   */
  static async getPoliciesPendingRequirements(agentId: string) {
    return prisma.policy.findMany({
      where: {
        agentId,
        status: 'PENDING_REQUIREMENTS',
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first
    });
  }

  /**
   * Get recently issued policies
   */
  static async getRecentlyIssuedPolicies(agentId: string, days: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return prisma.policy.findMany({
      where: {
        agentId,
        status: 'ISSUED',
        issueDate: {
          gte: cutoffDate,
        },
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        commissions: true,
      },
      orderBy: { issueDate: 'desc' },
    });
  }

  /**
   * Delete a policy (admin only - use with caution)
   */
  static async deletePolicy(policyId: string): Promise<void> {
    const policy = await prisma.policy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    // This will cascade delete commissions due to schema configuration
    await prisma.policy.delete({
      where: { id: policyId },
    });

    logger.warning(`Policy deleted: ${policyId}`);
  }
}

export default PolicyService;
