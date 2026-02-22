import chalk from 'chalk';
import { table } from 'table';
import ActivityService from '../../services/ActivityService';
import { ActivityType, ActivityOutcome } from '@prisma/client';

export default {
  /**
   * Log an activity
   */
  async log(params: {
    agentId: string;
    leadId: string;
    type: string;
    outcome?: string;
    title?: string;
    description?: string;
  }) {
    const { agentId, leadId, type, outcome, title, description } = params;

    // Generate default title if not provided
    const defaultTitle = title || `${type.replace(/_/g, ' ').toLowerCase()}${outcome ? ` - ${outcome.replace(/_/g, ' ').toLowerCase()}` : ''}`;

    try {
      await ActivityService.logActivity({
        agentId,
        leadId,
        type: type as ActivityType,
        outcome: outcome as ActivityOutcome,
        title: defaultTitle,
        description,
      });

      console.log(chalk.green(`\n✅ Activity logged: ${type}`));
      if (outcome) console.log(chalk.gray(`Outcome: ${outcome}`));
      console.log('');
    } catch (error) {
      throw error;
    }
  },

  /**
   * List activities
   */
  async list(params: { agentId: string; leadId?: string; limit: number }) {
    let activities;

    if (params.leadId) {
      activities = await ActivityService.getLeadActivities(params.leadId, { limit: params.limit });
      console.log(chalk.cyan(`\n📝 Activities for Lead: ${params.leadId}\n`));
    } else {
      activities = await ActivityService.getAgentActivities(params.agentId, { limit: params.limit });
      console.log(chalk.cyan(`\n📝 Recent Activities\n`));
    }

    if (activities.length === 0) {
      console.log(chalk.yellow('No activities found\n'));
      return;
    }

    // Format data for table
    const data = [
      [
        chalk.cyan('Date'),
        chalk.cyan('Type'),
        chalk.cyan('Outcome'),
        chalk.cyan('Title'),
        chalk.cyan('Lead'),
      ],
    ];

    for (const activity of activities) {
      const lead = 'lead' in activity ? (activity as any).lead : undefined;
      const leadName = lead ? `${lead.firstName} ${lead.lastName}` : activity.leadId;

      data.push([
        new Date(activity.timestamp).toLocaleDateString(),
        getActivityTypeEmoji(activity.type) + ' ' + activity.type.replace(/_/g, ' '),
        activity.outcome ? activity.outcome.replace(/_/g, ' ') : '-',
        activity.title,
        leadName,
      ]);
    }

    console.log(`${table(data)}\n`);
  },

  /**
   * Show activity statistics
   */
  async stats(params: { agentId: string; leadId?: string }) {
    if (params.leadId) {
      const stats = await ActivityService.getLeadActivityStats(params.leadId);

      console.log(chalk.cyan(`\n📊 Activity Statistics for Lead: ${params.leadId}\n`));
      console.log(`${chalk.white('Total Activities:')} ${stats.total}`);
      console.log(`${chalk.white('First Activity:')} ${stats.firstActivity ? new Date(stats.firstActivity.timestamp).toLocaleDateString() : 'N/A'}`);
      console.log(`${chalk.white('Last Activity:')} ${stats.lastActivity ? new Date(stats.lastActivity.timestamp).toLocaleDateString() : 'N/A'}`);

      if (Object.keys(stats.byType).length > 0) {
        console.log(chalk.cyan('\nBy Type:'));
        for (const [type, count] of Object.entries(stats.byType)) {
          console.log(`  ${getActivityTypeEmoji(type)} ${type.replace(/_/g, ' ')}: ${count}`);
        }
      }

      if (Object.keys(stats.byOutcome).length > 0) {
        console.log(chalk.cyan('\nBy Outcome:'));
        for (const [outcome, count] of Object.entries(stats.byOutcome)) {
          console.log(`  ${outcome.replace(/_/g, ' ')}: ${count}`);
        }
      }
    } else {
      const stats = await ActivityService.getAgentActivityStats(params.agentId);

      console.log(chalk.cyan('\n📊 Agent Activity Statistics\n'));
      console.log(`${chalk.white('Total Activities:')} ${stats.total}`);
      console.log(`${chalk.white('Unique Leads Contacted:')} ${stats.uniqueLeads}`);
      console.log(`${chalk.white('Total Duration:')} ${stats.totalDuration} minutes`);

      if (Object.keys(stats.byType).length > 0) {
        console.log(chalk.cyan('\nBy Type:'));
        const sortedByType = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]);
        for (const [type, count] of sortedByType) {
          console.log(`  ${getActivityTypeEmoji(type)} ${type.replace(/_/g, ' ')}: ${count}`);
        }
      }

      if (Object.keys(stats.byOutcome).length > 0) {
        console.log(chalk.cyan('\nBy Outcome:'));
        const sortedByOutcome = Object.entries(stats.byOutcome).sort((a, b) => b[1] - a[1]);
        for (const [outcome, count] of sortedByOutcome) {
          console.log(`  ${outcome.replace(/_/g, ' ')}: ${count}`);
        }
      }
    }

    console.log('');
  },
};

function getActivityTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    CALL_INBOUND: '📞',
    CALL_OUTBOUND: '📞',
    EMAIL_SENT: '📧',
    EMAIL_RECEIVED: '📬',
    TEXT_SENT: '💬',
    TEXT_RECEIVED: '💬',
    MEETING_SCHEDULED: '📅',
    MEETING_COMPLETED: '🤝',
    NOTE: '📝',
    TASK_COMPLETED: '✅',
    PROPOSAL_SENT: '📄',
    APPLICATION_SENT: '📋',
    FOLLOW_UP: '🔄',
    VOICEMAIL_LEFT: '🎤',
    VOICEMAIL_RECEIVED: '🎤',
    APPOINTMENT_SET: '📅',
    APPOINTMENT_NO_SHOW: '❌',
    REFERRAL_RECEIVED: '👥',
    OTHER: '📌',
  };
  return emojis[type] || '';
}
