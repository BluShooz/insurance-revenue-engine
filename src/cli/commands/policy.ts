import chalk from 'chalk';
import { table } from 'table';
import PolicyService from '../../services/PolicyService';
import { PolicyStatus } from '@prisma/client';

export default {
  /**
   * Add a new policy
   */
  async add(params: {
    agentId: string;
    leadId: string;
    carrier: string;
    productType: string;
    faceAmount: number;
    premium: number;
    commissionRate?: number;
    term?: number;
    policyNumber?: string;
    mode?: string;
    status: string;
  }) {
    try {
      await PolicyService.createPolicy({
        agentId: params.agentId,
        leadId: params.leadId,
        carrier: params.carrier,
        productType: params.productType as any,
        faceAmount: params.faceAmount,
        premium: params.premium,
        commissionRate: params.commissionRate,
        term: params.term,
        policyNumber: params.policyNumber,
        mode: params.mode as any,
        status: params.status as PolicyStatus,
      });

      console.log(chalk.green('\n✅ Policy created successfully'));
      console.log(chalk.gray(`Carrier: ${params.carrier}`));
      console.log(chalk.gray(`Product: ${params.productType.replace(/_/g, ' ')}`));
      console.log(chalk.gray(`Face Amount: $${params.faceAmount.toLocaleString()}`));
      console.log(chalk.gray(`Annual Premium: $${params.premium.toLocaleString()}`));
      console.log('');
    } catch (error) {
      throw error;
    }
  },

  /**
   * List policies
   */
  async list(params: { agentId: string; status?: string; carrier?: string }) {
    const policies = await PolicyService.getAgentPolicies(params.agentId, {
      status: params.status as PolicyStatus,
      carrier: params.carrier,
    });

    if (policies.length === 0) {
      console.log(chalk.yellow('\n📄 No policies found\n'));
      return;
    }

    console.log(chalk.cyan(`\n📄 Policies\n`));

    const data = [
      [
        chalk.cyan('ID'),
        chalk.cyan('Carrier'),
        chalk.cyan('Product'),
        chalk.cyan('Face Amount'),
        chalk.cyan('Premium'),
        chalk.cyan('Status'),
        chalk.cyan('Client'),
      ],
    ];

    for (const policy of policies) {
      data.push([
        policy.id.slice(0, 8),
        policy.carrier,
        policy.productType.replace(/_/g, ' '),
        `$${Number(policy.faceAmount).toLocaleString()}`,
        `$${Number(policy.premium).toLocaleString()}`,
        getStatusEmoji(policy.status) + ' ' + policy.status.replace(/_/g, ' '),
        `${policy.lead.firstName} ${policy.lead.lastName}`,
      ]);
    }

    console.log(`${table(data)}\n`);

    // Show summary
    this.showSummary(policies);
  },

  /**
   * Show policy details
   */
  async show(policyId: string) {
    const policy = await PolicyService.getPolicy(policyId);

    console.log(chalk.cyan(`\n📄 Policy Details\n`));
    console.log(`${chalk.white('Carrier:')} ${policy.carrier}`);
    console.log(`${chalk.white('Product Type:')} ${policy.productType.replace(/_/g, ' ')}`);
    console.log(`${chalk.white('Face Amount:')} $${Number(policy.faceAmount).toLocaleString()}`);
    console.log(`${chalk.white('Annual Premium:')} $${Number(policy.premium).toLocaleString()}`);
    console.log(`${chalk.white('Commission Rate:')} ${(Number(policy.commissionRate) * 100).toFixed(1)}%`);
    console.log(`${chalk.white('Commission Amount:')} $${Number(policy.commissionAmount).toLocaleString()}`);
    console.log(`${chalk.white('Status:')} ${getStatusEmoji(policy.status)} ${policy.status.replace(/_/g, ' ')}`);

    if (policy.policyNumber) console.log(`${chalk.white('Policy Number:')} ${policy.policyNumber}`);
    if (policy.term) console.log(`${chalk.white('Term:')} ${policy.term} years`);
    if (policy.issueDate) console.log(`${chalk.white('Issue Date:')} ${new Date(policy.issueDate).toLocaleDateString()}`);
    if (policy.effectiveDate) console.log(`${chalk.white('Effective Date:')} ${new Date(policy.effectiveDate).toLocaleDateString()}`);

    console.log(chalk.cyan(`\n👤 Client`));
    console.log(`${chalk.white('Name:')} ${policy.lead.firstName} ${policy.lead.lastName}`);
    console.log(`${chalk.white('Phone:')} ${policy.lead.phone}`);
    if (policy.lead.email) console.log(`${chalk.white('Email:')} ${policy.lead.email}`);

    if (policy.commissions.length > 0) {
      console.log(chalk.cyan(`\n💰 Commissions`));
      for (const commission of policy.commissions) {
        const status = commission.status === 'PAID' ? chalk.green('PAID') : chalk.yellow('PENDING');
        const amount = chalk.cyan(`$${Number(commission.amount).toLocaleString()}`);
        console.log(`  ${amount} - ${status}`);
        if (commission.scheduledDate) {
          console.log(`  ${chalk.gray(`Scheduled: ${new Date(commission.scheduledDate).toLocaleDateString()}`)}`);
        }
      }
    }

    console.log('');
  },

  /**
   * Update policy status
   */
  async updateStatus(policyId: string, status: string) {
    const policy = await PolicyService.getPolicy(policyId);
    const oldStatus = policy.status;

    await PolicyService.updatePolicyStatus(policyId, status as PolicyStatus);

    console.log(chalk.green(`\n✅ Policy status updated: ${oldStatus} → ${status}\n`));

    // If issued, show commission info
    if (status === 'ISSUED' && oldStatus !== 'ISSUED') {
      console.log(chalk.cyan('💰 Commission calculated:'));
      console.log(chalk.white(`Amount: $${Number(policy.commissionAmount).toLocaleString()}`));
      console.log(chalk.white(`Rate: ${(Number(policy.commissionRate) * 100).toFixed(1)}%\n`));
    }
  },

  /**
   * Show summary statistics
   */
  showSummary(policies: any[]) {
    const byStatus: Record<string, number> = {};
    const byCarrier: Record<string, number> = {};
    const byProduct: Record<string, number> = {};
    let totalFaceAmount = 0;
    let totalPremium = 0;
    let issuedCount = 0;

    for (const policy of policies) {
      byStatus[policy.status] = (byStatus[policy.status] || 0) + 1;
      byCarrier[policy.carrier] = (byCarrier[policy.carrier] || 0) + 1;
      byProduct[policy.productType] = (byProduct[policy.productType] || 0) + 1;

      if (policy.status === 'ISSUED') {
        totalFaceAmount += Number(policy.faceAmount);
        totalPremium += Number(policy.premium);
        issuedCount++;
      }
    }

    console.log(chalk.cyan('Summary:'));
    console.log(chalk.gray(`Total Policies: ${policies.length}`));
    console.log(chalk.gray(`Issued: ${issuedCount}`));

    if (issuedCount > 0) {
      console.log(chalk.gray(`Total Face Amount: $${totalFaceAmount.toLocaleString()}`));
      console.log(chalk.gray(`Annual Premium: $${totalPremium.toLocaleString()}`));
    }

    if (Object.keys(byStatus).length > 0) {
      console.log(chalk.gray('\nBy Status:'));
      for (const [status, count] of Object.entries(byStatus)) {
        console.log(chalk.gray(`  ${getStatusEmoji(status)} ${status.replace(/_/g, ' ')}: ${count}`));
      }
    }

    console.log('');
  },
};

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    QUOTED: '📋',
    APPLIED: '📝',
    UNDERWRITING: '⏳',
    APPROVED: '✅',
    ISSUED: '🎉',
    PENDING_REQUIREMENTS: '⚠️',
    DECLINED: '❌',
    POSTPONED: '⏸️',
    WITHDRAWN: '🔄',
    LAPSED: '💤',
    SURRENDERED: '🏳️',
    REPLACED: '🔄',
  };
  return emojis[status] || '📄';
}
