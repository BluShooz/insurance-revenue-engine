import chalk from 'chalk';
import { table } from 'table';
import CommissionService from '../../services/CommissionService';
import { CommissionStatus } from '@prisma/client';
import { format } from 'date-fns';

export default {
  /**
   * View commissions
   */
  async view(params: { agentId: string; status?: string }) {
    const commissions = await CommissionService.getAgentCommissions(
      params.agentId,
      params.status as CommissionStatus
    );

    if (commissions.length === 0) {
      console.log(chalk.yellow('\n💰 No commissions found\n'));
      return;
    }

    console.log(chalk.cyan(`\n💰 Commissions${params.status ? ` (${params.status})` : ''}\n`));

    const data = [
      [
        chalk.cyan('ID'),
        chalk.cyan('Policy'),
        chalk.cyan('Client'),
        chalk.cyan('Amount'),
        chalk.cyan('Type'),
        chalk.cyan('Status'),
        chalk.cyan('Scheduled'),
      ],
    ];

    for (const commission of commissions) {
      const statusColor =
        commission.status === 'PAID'
          ? chalk.green
          : commission.status === 'PENDING'
          ? chalk.yellow
          : chalk.gray;

      data.push([
        commission.id.slice(0, 8),
        commission.policyId.slice(0, 8),
        commission.policy.lead
          ? `${commission.policy.lead.firstName} ${commission.policy.lead.lastName}`
          : 'Unknown',
        chalk.cyan(`$${Number(commission.amount).toLocaleString()}`),
        commission.type.replace(/_/g, ' '),
        statusColor(commission.status),
        commission.scheduledDate
          ? new Date(commission.scheduledDate).toLocaleDateString()
          : '-',
      ]);
    }

    console.log(`${table(data)}\n`);
  },

  /**
   * Mark commission as paid
   */
  async pay(policyId: string) {
    try {
      await CommissionService.markPolicyCommissionAsPaid(policyId);
      console.log(chalk.green('\n✅ Commission marked as paid\n'));
    } catch (error) {
      console.log(chalk.red(`\n❌ ${(error as Error).message}\n`));
      throw error;
    }
  },

  /**
   * Show commission summary
   */
  async summary(params: { agentId: string }) {
    const summary = await CommissionService.getCommissionSummary(params.agentId);

    console.log(chalk.cyan('\n💰 Commission Summary\n'));
    console.log(`${chalk.white('Pending Count:')} ${summary.pendingCount}`);
    console.log(`${chalk.white('Paid Count:')} ${summary.paidCount}`);
    console.log('');
    console.log(`${chalk.yellow('Pending Amount:')} $${summary.pendingAmount.toLocaleString()}`);
    console.log(`${chalk.green('Paid Amount:')} $${summary.paidAmount.toLocaleString()}`);
    console.log(`${chalk.cyan('Total Amount:')} $${summary.totalAmount.toLocaleString()}`);

    // Show pending commissions in detail
    if (summary.pendingCount > 0) {
      const pendingCommissions = await CommissionService.getAgentCommissions(
        params.agentId,
        'PENDING'
      );

      console.log(chalk.cyan('\n📋 Pending Commissions:\n'));

      const data = [
        [
          chalk.cyan('Policy'),
          chalk.cyan('Client'),
          chalk.cyan('Amount'),
          chalk.cyan('Scheduled Date'),
          chalk.cyan('Carrier'),
        ],
      ];

      for (const commission of pendingCommissions) {
        const daysUntilScheduled = commission.scheduledDate
          ? Math.ceil(
              (new Date(commission.scheduledDate).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            )
          : null;

        const scheduledText = commission.scheduledDate
          ? `${new Date(commission.scheduledDate).toLocaleDateString()} ${
              daysUntilScheduled !== null
                ? (daysUntilScheduled > 0
                    ? `(${daysUntilScheduled} days)`
                    : chalk.red('(due)'))
                : ''
            }`
          : '-';

        data.push([
          commission.policyId.slice(0, 8),
          commission.policy.lead
            ? `${commission.policy.lead.firstName} ${commission.policy.lead.lastName}`
            : 'Unknown',
          chalk.cyan(`$${Number(commission.amount).toLocaleString()}`),
          scheduledText,
          commission.policy.carrier,
        ]);
      }

      console.log(`${table(data)}\n`);
    } else {
      console.log('');
    }
  },
};
