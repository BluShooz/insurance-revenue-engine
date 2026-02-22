import chalk from 'chalk';
import { table } from 'table';
import LeadService from '../../services/LeadService';
import PolicyService from '../../services/PolicyService';
import CommissionService from '../../services/CommissionService';
import ActivityService from '../../services/ActivityService';
import ScoringService from '../../services/ScoringService';
import { startOfMonth, endOfMonth } from 'date-fns';

export default {
  /**
   * Show dashboard overview
   */
  async overview(params: { agentId: string }) {
    const [leadStats, policyStats, commissionSummary, recentActivities, hotLeads] =
      await Promise.all([
        LeadService.getLeadStats(params.agentId),
        PolicyService.getAgentPolicyStats(params.agentId),
        CommissionService.getCommissionSummary(params.agentId),
        ActivityService.getRecentActivities(params.agentId, 5),
        LeadService.getLead(params.agentId).then(() => LeadService.getHotLeads(params.agentId, 70)).catch(() => []),
      ]);

    // Header
    console.log(chalk.cyan.bold('\n╔══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan.bold('║         INSURANCE REVENUE ENGINE - DASHBOARD              ║'));
    console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════╝\n'));

    // Lead Statistics
    console.log(chalk.cyan.bold('📊 LEAD STATISTICS'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`${chalk.white('Total Leads:')} ${chalk.cyan(leadStats.total.toString())}`);
    console.log(
      `${chalk.white('Placed This Month:')} ${chalk.green(
        leadStats.placedThisMonth.toString()
      )}`
    );

    if (Object.keys(leadStats.byStatus).length > 0) {
      console.log(chalk.gray('\nBy Status:'));
      for (const [status, count] of Object.entries(leadStats.byStatus)) {
        const statusEmoji = getStatusEmoji(status);
        const color = getStatusColor(status);
        console.log(`  ${statusEmoji} ${status}: ${color(count.toString())}`);
      }
    }

    if (Object.keys(leadStats.byIntent).length > 0) {
      console.log(chalk.gray('\nBy Intent Level:'));
      for (const [intent, count] of Object.entries(leadStats.byIntent)) {
        const intentEmoji = getIntentEmoji(intent);
        console.log(`  ${intentEmoji} ${intent}: ${count}`);
      }
    }

    // Score Distribution
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.cyan.bold('📈 SCORE DISTRIBUTION'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(
      `${chalk.white('🔥 Hot (70-100):')} ${chalk.green(
        leadStats.scoreDistribution.hot.toString()
      )}`
    );
    console.log(
      `${chalk.white('🌡️  Warm (40-69):')} ${chalk.yellow(
        leadStats.scoreDistribution.warm.toString()
      )}`
    );
    console.log(
      `${chalk.white('❄️  Cold (10-39):')} ${chalk.blue(
        leadStats.scoreDistribution.cold.toString()
      )}`
    );
    console.log(
      `${chalk.white('💤 Inactive (0-9):')} ${chalk.gray(
        leadStats.scoreDistribution.inactive.toString()
      )}`
    );

    // Policy Statistics
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.cyan.bold('📄 POLICY STATISTICS'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(`${chalk.white('Total Policies:')} ${chalk.cyan(policyStats.total.toString())}`);
    console.log(
      `${chalk.white('Issued:')} ${chalk.green(
        policyStats.byStatus.ISSUED?.toString() || '0'
      )}`
    );
    console.log(
      `${chalk.white('In Underwriting:')} ${chalk.yellow(
        policyStats.byStatus.UNDERWRITING?.toString() || '0'
      )}`
    );
    if (policyStats.totalFaceAmount > 0) {
      console.log(
        `${chalk.white('Total Face Amount:')} ${chalk.cyan(
          `$${policyStats.totalFaceAmount.toLocaleString()}`
        )}`
      );
      console.log(
        `${chalk.white('Annual Premium:')} ${chalk.cyan(
          `$${policyStats.totalAnnualPremium.toLocaleString()}`
        )}`
      );
    }

    // Commission Summary
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.cyan.bold('💰 COMMISSION SUMMARY'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(
      `${chalk.white('Pending:')} ${chalk.yellow(
        `$${commissionSummary.pendingAmount.toLocaleString()}`
      )} (${commissionSummary.pendingCount} policies)`
    );
    console.log(
      `${chalk.white('Paid YTD:')} ${chalk.green(
        `$${commissionSummary.paidAmount.toLocaleString()}`
      )} (${commissionSummary.paidCount} policies)`
    );
    console.log(
      `${chalk.white('Total:')} ${chalk.cyan(
        `$${commissionSummary.totalAmount.toLocaleString()}`
      )}`
    );

    // Recent Activities
    if (recentActivities.length > 0) {
      console.log(chalk.gray('\n' + '─'.repeat(60)));
      console.log(chalk.cyan.bold('📝 RECENT ACTIVITIES'));
      console.log(chalk.gray('─'.repeat(60)));

      const data = [[chalk.cyan('Time'), chalk.cyan('Type'), chalk.cyan('Lead'), chalk.cyan('Title')]];

      for (const activity of recentActivities.slice(0, 5)) {
        const time = formatTimeAgo(new Date(activity.timestamp));
        const leadName = `${activity.lead.firstName} ${activity.lead.lastName}`;

        data.push([chalk.gray(time), activity.type, leadName, activity.title]);
      }

      console.log(`${table(data)}\n`);
    }

    // Quick Actions
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.cyan.bold('⚡ QUICK ACTIONS'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray('Add a lead:    ') + chalk.white('npm run dev lead:add "John" "Doe" "555-1234"'));
    console.log(chalk.gray('View hot leads: ') + chalk.white('npm run dev lead:hot'));
    console.log(chalk.gray('List policies:  ') + chalk.white('npm run dev policy:list'));
    console.log(chalk.gray('View dashboard: ') + chalk.white('npm run dev dashboard:overview'));
    console.log('');
  },

  /**
   * Show score distribution
   */
  async scores(params: { agentId: string }) {
    const distribution = await ScoringService.getScoreDistribution(params.agentId);
    const topLeads = await ScoringService.getTopLeads(params.agentId, 10);

    console.log(chalk.cyan('\n📈 Lead Score Distribution\n'));
    console.log(
      `  ${chalk.green('🔥 Hot (70-100):')} ${'█'.repeat(
        Math.min(distribution.hot, 20)
      )} ${distribution.hot}`
    );
    console.log(
      `  ${chalk.yellow('🌡️  Warm (40-69):')} ${'█'.repeat(
        Math.min(distribution.warm, 20)
      )} ${distribution.warm}`
    );
    console.log(
      `  ${chalk.blue('❄️  Cold (10-39):')} ${'█'.repeat(
        Math.min(distribution.cold, 20)
      )} ${distribution.cold}`
    );
    console.log(
      `  ${chalk.gray('💤 Inactive (0-9):')} ${'█'.repeat(
        Math.min(distribution.inactive, 20)
      )} ${distribution.inactive}`
    );

    console.log(chalk.cyan('\n🏆 Top 10 Leads by Score\n'));

    if (topLeads.length === 0) {
      console.log(chalk.yellow('No leads found\n'));
      return;
    }

    const data = [
      [
        chalk.cyan('Rank'),
        chalk.cyan('Name'),
        chalk.cyan('Phone'),
        chalk.cyan('Score'),
        chalk.cyan('Status'),
        chalk.cyan('Activities'),
      ],
    ];

    for (let i = 0; i < topLeads.length; i++) {
      const lead = topLeads[i];
      const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;

      data.push([
        rank,
        `${lead.firstName} ${lead.lastName}`,
        lead.phone,
        chalk.cyan(lead.score.toString()),
        lead.status,
        lead._count.activities.toString(),
      ]);
    }

    console.log(`${table(data)}\n`);
  },
};

// Helper functions
function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    NEW: '🆕',
    CONTACTED: '📞',
    ENGAGED: '💬',
    QUALIFIED: '✅',
    PROPOSAL: '📄',
    APPLICATION: '📝',
    UNDERWRITING: '⏳',
    PLACED: '🎉',
    NOT_PLACED: '❌',
    NOT_INTERESTED: '🚫',
    UNRESPONSIVE: '💤',
    LOST: '📉',
  };
  return emojis[status] || '📌';
}

function getStatusColor(status: string): (text: string) => string {
  if (['PLACED', 'QUALIFIED', 'PROPOSAL'].includes(status)) {
    return chalk.green;
  }
  if (['UNDERWRITING', 'APPLICATION', 'ENGAGED'].includes(status)) {
    return chalk.yellow;
  }
  if (['NOT_INTERESTED', 'LOST', 'UNRESPONSIVE'].includes(status)) {
    return chalk.red;
  }
  return chalk.gray;
}

function getIntentEmoji(intent: string): string {
  const emojis: Record<string, string> = {
    HOT: '🔥',
    WARM: '🌡️',
    COLD: '❄️',
    UNKNOWN: '❓',
    NONE: '⭕',
  };
  return emojis[intent] || '';
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
