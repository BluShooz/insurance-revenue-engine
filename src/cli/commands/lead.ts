import chalk from 'chalk';
import { table } from 'table';
import LeadService from '../../services/LeadService';
import { LeadStatus, IntentLevel } from '@prisma/client';

export default {
  /**
   * Add a new lead
   */
  async add(params: {
    agentId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    source?: string;
    intentLevel?: string;
  }) {
    const { agentId, firstName, lastName, phone, email, source, intentLevel } = params;

    // Validate intent level
    if (intentLevel && !['HOT', 'WARM', 'COLD', 'UNKNOWN', 'NONE'].includes(intentLevel.toUpperCase())) {
      console.log(chalk.red('Invalid intent level. Use: HOT, WARM, COLD, UNKNOWN, or NONE'));
      return;
    }

    try {
      await LeadService.createLead({
        agentId,
        firstName,
        lastName,
        phone,
        email,
        source,
        intentLevel: intentLevel?.toUpperCase() as IntentLevel,
      });

      console.log(chalk.green(`\n✅ Lead added successfully: ${firstName} ${lastName}`));
      console.log(chalk.gray(`Phone: ${phone}`));
      if (email) console.log(chalk.gray(`Email: ${email}`));
      if (source) console.log(chalk.gray(`Source: ${source}`));
      console.log('');
    } catch (error) {
      throw error;
    }
  },

  /**
   * List all leads
   */
  async list(params: {
    agentId: string;
    status?: string;
    intentLevel?: string;
    minScore?: number;
    maxScore?: number;
    limit: number;
  }) {
    const result = await LeadService.listLeads(params.agentId, {
      status: params.status?.toUpperCase() as LeadStatus,
      intentLevel: params.intentLevel?.toUpperCase() as IntentLevel,
      minScore: params.minScore,
      maxScore: params.maxScore,
      limit: params.limit,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });

    if (result.leads.length === 0) {
      console.log(chalk.yellow('\n📭 No leads found\n'));
      return;
    }

    // Format data for table
    const data = [
      [
        chalk.cyan('ID'),
        chalk.cyan('Name'),
        chalk.cyan('Phone'),
        chalk.cyan('Status'),
        chalk.cyan('Intent'),
        chalk.cyan('Score'),
        chalk.cyan('Activities'),
      ],
    ];

    for (const lead of result.leads) {
      const statusEmoji = getStatusEmoji(lead.status);
      const intentEmoji = getIntentEmoji(lead.intentLevel);
      const scoreColor = lead.score >= 70 ? chalk.green : lead.score >= 40 ? chalk.yellow : chalk.gray;

      data.push([
        lead.id.slice(0, 8),
        `${lead.firstName} ${lead.lastName}`,
        lead.phone,
        `${statusEmoji} ${lead.status}`,
        `${intentEmoji} ${lead.intentLevel}`,
        scoreColor(lead.score.toString()),
        lead._count.activities.toString(),
      ]);
    }

    console.log(`\n${table(data)}`);
    console.log(chalk.gray(`Showing ${result.leads.length} of ${result.total} leads\n`));

    // Show summary
    this.showSummary(result.leads);
  },

  /**
   * Show lead details
   */
  async show(leadId: string) {
    const lead = await LeadService.getLead(leadId);

    console.log(chalk.cyan(`\n📋 Lead Details\n`));
    console.log(`${chalk.white('Name:')} ${lead.firstName} ${lead.lastName}`);
    console.log(`${chalk.white('Phone:')} ${lead.phone}`);
    if (lead.email) console.log(`${chalk.white('Email:')} ${lead.email}`);
    console.log(`${chalk.white('Status:')} ${getStatusEmoji(lead.status)} ${lead.status}`);
    console.log(`${chalk.white('Intent:')} ${getIntentEmoji(lead.intentLevel)} ${lead.intentLevel}`);
    console.log(`${chalk.white('Score:')} ${chalk.cyan(lead.score.toString())}`);
    if (lead.source) console.log(`${chalk.white('Source:')} ${lead.source}`);
    console.log(`${chalk.white('Created:')} ${new Date(lead.createdAt).toLocaleDateString()}`);

    console.log(chalk.cyan(`\n📊 Activity Summary`));
    console.log(`${chalk.white('Total Activities:')} ${lead._count.activities}`);
    console.log(`${chalk.white('Policies:')} ${lead._count.policies}`);

    if (lead.activities.length > 0) {
      console.log(chalk.cyan(`\n📝 Recent Activities`));
      for (const activity of lead.activities.slice(0, 5)) {
        const timestamp = new Date(activity.timestamp).toLocaleDateString();
        console.log(`  ${chalk.gray(timestamp)} - ${chalk.white(activity.title)} (${activity.type})`);
      }
    }

    if (lead.policies.length > 0) {
      console.log(chalk.cyan(`\n📄 Policies`));
      for (const policy of lead.policies) {
        console.log(`  ${chalk.cyan(policy.carrier)} - ${policy.productType} - $${policy.faceAmount}`);
      }
    }

    console.log('');
  },

  /**
   * Update lead status
   */
  async updateStatus(leadId: string, status: string) {
    const lead = await LeadService.getLead(leadId);
    const oldStatus = lead.status;

    await LeadService.updateStatus(leadId, status as LeadStatus);

    console.log(chalk.green(`\n✅ Lead status updated: ${oldStatus} → ${status}\n`));
  },

  /**
   * Update lead intent level
   */
  async updateIntent(leadId: string, intent: string) {
    const lead = await LeadService.getLead(leadId);
    const oldIntent = lead.intentLevel;

    await LeadService.updateIntentLevel(leadId, intent as IntentLevel);

    console.log(chalk.green(`\n✅ Intent level updated: ${oldIntent} → ${intent}\n`));
  },

  /**
   * Show hot leads
   */
  async hot(params: { agentId: string; minScore: number }) {
    const leads = await LeadService.getHotLeads(params.agentId, params.minScore);

    if (leads.length === 0) {
      console.log(chalk.yellow(`\n🔥 No hot leads found (score >= ${params.minScore})\n`));
      return;
    }

    console.log(chalk.cyan(`\n🔥 Hot Leads (Score >= ${params.minScore})\n`));

    const data = [
      [chalk.cyan('Name'), chalk.cyan('Phone'), chalk.cyan('Score'), chalk.cyan('Status'), chalk.cyan('Last Activity')],
    ];

    for (const lead of leads) {
      const lastActivity = lead.activities[0]
        ? new Date(lead.activities[0].timestamp).toLocaleDateString()
        : 'Never';

      data.push([
        `${lead.firstName} ${lead.lastName}`,
        lead.phone,
        chalk.green(lead.score.toString()),
        lead.status,
        chalk.gray(lastActivity),
      ]);
    }

    console.log(`${table(data)}\n`);
  },

  /**
   * Search leads
   */
  async search(params: { agentId: string; keyword: string }) {
    const leads = await LeadService.searchLeads(params.agentId, params.keyword);

    if (leads.length === 0) {
      console.log(chalk.yellow(`\n🔍 No results found for "${params.keyword}"\n`));
      return;
    }

    console.log(chalk.cyan(`\n🔍 Search Results: "${params.keyword}"\n`));

    const data = [
      [chalk.cyan('Name'), chalk.cyan('Phone'), chalk.cyan('Email'), chalk.cyan('Score'), chalk.cyan('Status')],
    ];

    for (const lead of leads) {
      data.push([
        `${lead.firstName} ${lead.lastName}`,
        lead.phone,
        lead.email || '-',
        lead.score.toString(),
        lead.status,
      ]);
    }

    console.log(`${table(data)}\n`);
  },

  /**
   * Show summary statistics
   */
  showSummary(leads: any[]) {
    const byStatus: Record<string, number> = {};
    const byIntent: Record<string, number> = {};
    let totalScore = 0;

    for (const lead of leads) {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      byIntent[lead.intentLevel] = (byIntent[lead.intentLevel] || 0) + 1;
      totalScore += lead.score;
    }

    console.log(chalk.cyan('Summary:'));
    console.log(chalk.gray(`Average Score: ${(totalScore / leads.length).toFixed(1)}`));

    if (Object.keys(byStatus).length > 0) {
      console.log(chalk.gray('By Status:'));
      for (const [status, count] of Object.entries(byStatus)) {
        console.log(chalk.gray(`  ${status}: ${count}`));
      }
    }

    if (Object.keys(byIntent).length > 0) {
      console.log(chalk.gray('By Intent:'));
      for (const [intent, count] of Object.entries(byIntent)) {
        console.log(chalk.gray(`  ${intent}: ${count}`));
      }
    }

    console.log('');
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
