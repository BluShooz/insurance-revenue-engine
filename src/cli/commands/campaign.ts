import chalk from 'chalk';
import { table } from 'table';
import AutomationService, { AutomationTrigger } from '../../services/AutomationService';

export default {
  /**
   * Create a new campaign
   */
  async create(params: {
    agentId: string;
    name: string;
    description?: string;
  }) {
    try {
      await AutomationService.createCampaign({
        agentId: params.agentId,
        name: params.name,
        description: params.description,
        triggerCondition: {
          trigger: AutomationTrigger.CUSTOM,
        },
        actions: [
          {
            type: 'log_note',
            note: `Campaign "${params.name}" executed`,
          },
        ],
      });

      console.log(chalk.green(`\n✅ Campaign created: ${params.name}\n`));
      console.log(chalk.gray('Note: This is a basic campaign template.'));
      console.log(chalk.gray('To create advanced campaigns with custom triggers and actions,'));
      console.log(chalk.gray('edit the campaign directly in the database or extend this command.\n'));
    } catch (error) {
      throw error;
    }
  },

  /**
   * List campaigns
   */
  async list(params: { agentId: string }) {
    const campaigns = await AutomationService.listCampaigns(params.agentId);

    if (campaigns.length === 0) {
      console.log(chalk.yellow('\n📢 No campaigns found\n'));
      console.log(chalk.gray('Tip: Use "campaign:create" to create your first campaign\n'));
      return;
    }

    console.log(chalk.cyan('\n📢 Campaigns\n'));

    const data = [
      [
        chalk.cyan('Name'),
        chalk.cyan('Active'),
        chalk.cyan('Runs'),
        chalk.cyan('Last Run'),
        chalk.cyan('Description'),
      ],
    ];

    for (const campaign of campaigns) {
      const activeStatus = campaign.active ? chalk.green('✓') : chalk.red('✗');

      data.push([
        campaign.name,
        activeStatus,
        campaign.runCount.toString(),
        campaign.lastRunAt
          ? new Date(campaign.lastRunAt).toLocaleDateString()
          : 'Never',
        campaign.description || '-',
      ]);
    }

    console.log(`${table(data)}\n`);

    console.log(chalk.gray('Commands:'));
    console.log(chalk.gray('  campaign:run <name>  - Run a campaign manually'));
    console.log(chalk.gray('  campaign:create <name> - Create a new campaign\n'));
  },

  /**
   * Run a campaign
   */
  async run(campaignName: string) {
    try {
      const campaigns = await AutomationService.listCampaigns('1'); // Default agent
      const campaign = campaigns.find((c) => c.name.toLowerCase() === campaignName.toLowerCase());

      if (!campaign) {
        console.log(chalk.yellow(`\n⚠️  Campaign not found: ${campaignName}\n`));
        console.log(chalk.gray('Available campaigns:'));
        for (const c of campaigns) {
          console.log(chalk.gray(`  - ${c.name}${c.active ? '' : ' (inactive)'}`));
        }
        console.log('');
        return;
      }

      if (!campaign.active) {
        console.log(chalk.yellow(`\n⚠️  Campaign is inactive: ${campaignName}\n`));
        console.log(chalk.gray('Activate the campaign first or use campaign:create to make a new one\n'));
        return;
      }

      await AutomationService.runCampaign(campaign.id);
      console.log(chalk.green(`\n✅ Campaign "${campaignName}" completed\n`));
    } catch (error) {
      throw error;
    }
  },
};
