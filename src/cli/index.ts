#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { prisma } from '../utils/prisma';
import Logger from '../utils/logger';

// Import command modules
import leadCommands from './commands/lead';
import activityCommands from './commands/activity';
import policyCommands from './commands/policy';
import commissionCommands from './commands/commission';
import campaignCommands from './commands/campaign';
import dashboardCommands from './commands/dashboard';

const program = new Command();
const logger = new Logger('CLI');

// CLI Configuration
const DEFAULT_AGENT_ID = process.env.DEFAULT_AGENT_ID || '1';

program
  .name('insurance-engine')
  .description('Single-Agent Revenue Engine for Insurance Agents')
  .version('1.0.0');

// Helper function to get agent ID
const getAgentId = (options: any): string => {
  return options.agentId || DEFAULT_AGENT_ID;
};

// ==============================================================================
// LEAD COMMANDS
// ==============================================================================
const leadCmd = program.command('lead');

leadCmd
  .description('Lead management commands');

// lead:add
leadCmd
  .command('add')
  .description('Add a new lead')
  .argument('<firstName>', 'First name')
  .argument('<lastName>', 'Last name')
  .argument('<phone>', 'Phone number')
  .argument('[email]', 'Email address (optional)')
  .option('-s, --source <source>', 'Lead source')
  .option('-i, --intent <level>', 'Intent level (HOT, WARM, COLD, UNKNOWN)')
  .option('--agent-id <id>', 'Agent ID (default: from env or 1)')
  .action(async (firstName, lastName, phone, email, options) => {
    try {
      await leadCommands.add({
        agentId: getAgentId(options),
        firstName,
        lastName,
        phone,
        email,
        source: options.source,
        intentLevel: options.intent,
      });
    } catch (error) {
      logger.error('Failed to add lead', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// lead:list
leadCmd
  .command('list')
  .description('List all leads')
  .option('-s, --status <status>', 'Filter by status')
  .option('-i, --intent <level>', 'Filter by intent level')
  .option('--min-score <score>', 'Minimum score')
  .option('--max-score <score>', 'Maximum score')
  .option('--agent-id <id>', 'Agent ID')
  .option('--limit <n>', 'Limit results', '50')
  .action(async (options) => {
    try {
      await leadCommands.list({
        agentId: getAgentId(options),
        status: options.status,
        intentLevel: options.intent,
        minScore: options.minScore ? parseInt(options.minScore) : undefined,
        maxScore: options.maxScore ? parseInt(options.maxScore) : undefined,
        limit: parseInt(options.limit),
      });
    } catch (error) {
      logger.error('Failed to list leads', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// lead:show
leadCmd
  .command('show')
  .description('Show lead details')
  .argument('<leadId>', 'Lead ID')
  .action(async (leadId) => {
    try {
      await leadCommands.show(leadId);
    } catch (error) {
      logger.error('Failed to show lead', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// lead:update-status
leadCmd
  .command('update-status')
  .description('Update lead status')
  .argument('<leadId>', 'Lead ID')
  .argument('<status>', 'New status')
  .action(async (leadId, status) => {
    try {
      await leadCommands.updateStatus(leadId, status.toUpperCase().replace(/-/g, '_'));
    } catch (error) {
      logger.error('Failed to update lead status', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// lead:update-intent
leadCmd
  .command('update-intent')
  .description('Update lead intent level')
  .argument('<leadId>', 'Lead ID')
  .argument('<intent>', 'Intent level (HOT, WARM, COLD, UNKNOWN, NONE)')
  .action(async (leadId, intent) => {
    try {
      await leadCommands.updateIntent(leadId, intent.toUpperCase());
    } catch (error) {
      logger.error('Failed to update intent', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// lead:hot
leadCmd
  .command('hot')
  .description('Show hot leads (high scoring)')
  .option('--min-score <score>', 'Minimum score', '70')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (options) => {
    try {
      await leadCommands.hot({
        agentId: getAgentId(options),
        minScore: parseInt(options.minScore),
      });
    } catch (error) {
      logger.error('Failed to get hot leads', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// lead:search
leadCmd
  .command('search')
  .description('Search leads')
  .argument('<keyword>', 'Search keyword')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (keyword, options) => {
    try {
      await leadCommands.search({
        agentId: getAgentId(options),
        keyword,
      });
    } catch (error) {
      logger.error('Failed to search leads', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// ==============================================================================
// ACTIVITY COMMANDS
// ==============================================================================
const activityCmd = program.command('activity');

activityCmd.description('Activity logging and tracking');

// activity:log
activityCmd
  .command('log')
  .description('Log an activity')
  .argument('<leadId>', 'Lead ID')
  .argument('<type>', 'Activity type')
  .argument('[outcome]', 'Activity outcome')
  .option('-t, --title <title>', 'Activity title')
  .option('-d, --description <description>', 'Activity description')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (leadId, type, outcome, options) => {
    try {
      await activityCommands.log({
        agentId: getAgentId(options),
        leadId,
        type: type.toUpperCase().replace(/-/g, '_'),
        outcome: outcome?.toUpperCase().replace(/-/g, '_'),
        title: options.title,
        description: options.description,
      });
    } catch (error) {
      logger.error('Failed to log activity', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// activity:list
activityCmd
  .command('list')
  .description('List activities for a lead')
  .argument('[leadId]', 'Lead ID (optional, shows all agent activities if not provided)')
  .option('--agent-id <id>', 'Agent ID')
  .option('--limit <n>', 'Limit results', '20')
  .action(async (leadId, options) => {
    try {
      await activityCommands.list({
        agentId: getAgentId(options),
        leadId,
        limit: parseInt(options.limit),
      });
    } catch (error) {
      logger.error('Failed to list activities', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// activity:stats
activityCmd
  .command('stats')
  .description('Show activity statistics')
  .argument('[leadId]', 'Lead ID (optional)')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (leadId, options) => {
    try {
      await activityCommands.stats({
        agentId: getAgentId(options),
        leadId,
      });
    } catch (error) {
      logger.error('Failed to get activity stats', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// ==============================================================================
// POLICY COMMANDS
// ==============================================================================
const policyCmd = program.command('policy');

policyCmd.description('Policy management');

// policy:add
policyCmd
  .command('add')
  .description('Add a new policy')
  .argument('<leadId>', 'Lead ID')
  .argument('<carrier>', 'Insurance carrier')
  .argument('<productType>', 'Product type')
  .argument('<faceAmount>', 'Coverage amount')
  .argument('<premium>', 'Annual premium')
  .option('-r, --rate <rate>', 'Commission rate (decimal, e.g., 0.55 for 55%)')
  .option('-t, --term <years>', 'Policy term (for term life)')
  .option('-n, --policy-number <number>', 'Policy number')
  .option('-m, --mode <mode>', 'Premium mode (MONTHLY, QUARTERLY, etc.)', 'MONTHLY')
  .option('-s, --status <status>', 'Policy status', 'APPLIED')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (leadId, carrier, productType, faceAmount, premium, options) => {
    try {
      await policyCommands.add({
        agentId: getAgentId(options),
        leadId,
        carrier,
        productType: productType.toUpperCase().replace(/-/g, '_'),
        faceAmount: parseFloat(faceAmount),
        premium: parseFloat(premium),
        commissionRate: options.rate ? parseFloat(options.rate) : undefined,
        term: options.term ? parseInt(options.term) : undefined,
        policyNumber: options.policyNumber,
        mode: options.mode.toUpperCase(),
        status: options.status.toUpperCase().replace(/-/g, '_'),
      });
    } catch (error) {
      logger.error('Failed to add policy', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// policy:list
policyCmd
  .command('list')
  .description('List policies')
  .option('-s, --status <status>', 'Filter by status')
  .option('-c, --carrier <carrier>', 'Filter by carrier')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (options) => {
    try {
      await policyCommands.list({
        agentId: getAgentId(options),
        status: options.status?.toUpperCase().replace(/-/g, '_'),
        carrier: options.carrier,
      });
    } catch (error) {
      logger.error('Failed to list policies', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// policy:show
policyCmd
  .command('show')
  .description('Show policy details')
  .argument('<policyId>', 'Policy ID')
  .action(async (policyId) => {
    try {
      await policyCommands.show(policyId);
    } catch (error) {
      logger.error('Failed to show policy', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// policy:update-status
policyCmd
  .command('update-status')
  .description('Update policy status')
  .argument('<policyId>', 'Policy ID')
  .argument('<status>', 'New status (e.g., ISSUED, UNDERWRITING, DECLINED)')
  .action(async (policyId, status) => {
    try {
      await policyCommands.updateStatus(policyId, status.toUpperCase().replace(/-/g, '_'));
    } catch (error) {
      logger.error('Failed to update policy status', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// ==============================================================================
// COMMISSION COMMANDS
// ==============================================================================
const commissionCmd = program.command('commission');

commissionCmd.description('Commission tracking');

// commission:view
commissionCmd
  .command('view')
  .description('View commissions')
  .option('-s, --status <status>', 'Filter by status (PENDING, PAID)')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (options) => {
    try {
      await commissionCommands.view({
        agentId: getAgentId(options),
        status: options.status?.toUpperCase(),
      });
    } catch (error) {
      logger.error('Failed to view commissions', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// commission:pay
commissionCmd
  .command('pay')
  .description('Mark commission as paid')
  .argument('<policyId>', 'Policy ID')
  .action(async (policyId) => {
    try {
      await commissionCommands.pay(policyId);
    } catch (error) {
      logger.error('Failed to mark commission as paid', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// commission:summary
commissionCmd
  .command('summary')
  .description('Show commission summary')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (options) => {
    try {
      await commissionCommands.summary({
        agentId: getAgentId(options),
      });
    } catch (error) {
      logger.error('Failed to get commission summary', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// ==============================================================================
// CAMPAIGN COMMANDS
// ==============================================================================
const campaignCmd = program.command('campaign');

campaignCmd.description('Campaign automation');

// campaign:run
campaignCmd
  .command('run')
  .description('Run a campaign')
  .argument('<campaignName>', 'Campaign name')
  .action(async (campaignName) => {
    try {
      await campaignCommands.run(campaignName);
    } catch (error) {
      logger.error('Failed to run campaign', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// campaign:list
campaignCmd
  .command('list')
  .description('List campaigns')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (options) => {
    try {
      await campaignCommands.list({
        agentId: getAgentId(options),
      });
    } catch (error) {
      logger.error('Failed to list campaigns', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// campaign:create
campaignCmd
  .command('create')
  .description('Create a new campaign')
  .argument('<name>', 'Campaign name')
  .option('-d, --description <description>', 'Campaign description')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (name, options) => {
    try {
      await campaignCommands.create({
        agentId: getAgentId(options),
        name,
        description: options.description,
      });
    } catch (error) {
      logger.error('Failed to create campaign', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// ==============================================================================
// DASHBOARD COMMANDS
// ==============================================================================
const dashboardCmd = program.command('dashboard');

dashboardCmd.description('Dashboard and statistics');

// dashboard:overview
dashboardCmd
  .command('overview')
  .description('Show dashboard overview')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (options) => {
    try {
      await dashboardCommands.overview({
        agentId: getAgentId(options),
      });
    } catch (error) {
      logger.error('Failed to show dashboard', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// dashboard:scores
dashboardCmd
  .command('scores')
  .description('Show lead score distribution')
  .option('--agent-id <id>', 'Agent ID')
  .action(async (options) => {
    try {
      await dashboardCommands.scores({
        agentId: getAgentId(options),
      });
    } catch (error) {
      logger.error('Failed to show scores', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// ==============================================================================
// INIT COMMAND
// ==============================================================================
program
  .command('init')
  .description('Initialize the database (run migrations and seed)')
  .option('--skip-seed', 'Skip seeding data')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('\n🚀 Initializing Insurance Revenue Engine...\n'));

      // Check if .env file exists
      const fs = await import('fs');
      if (!fs.existsSync('.env')) {
        console.log(chalk.yellow('⚠️  No .env file found. Creating from .env.example...'));
        fs.copyFileSync('.env.example', '.env');
        console.log(chalk.green('✅ Created .env file'));
        console.log(chalk.yellow('⚠️  Please update DATABASE_URL in .env before continuing\n'));
        return;
      }

      console.log(chalk.blue('Running Prisma migrations...'));
      const { execSync } = await import('child_process');
      execSync('npx prisma migrate dev', { stdio: 'inherit' });

      if (!options.skipSeed) {
        console.log(chalk.blue('\nSeeding database...'));
        execSync('npm run db:seed', { stdio: 'inherit' });
      }

      console.log(chalk.green('\n✅ Initialization complete!\n'));
      console.log(chalk.cyan('Try these commands to get started:'));
      console.log(chalk.white('  npm run dev lead:list'));
      console.log(chalk.white('  npm run dev dashboard:overview'));
      console.log(chalk.white('  npm run dev lead:add "John" "Doe" "555-1234" "john@example.com"\n'));
    } catch (error) {
      logger.error('Initialization failed', { error: error instanceof Error ? error.message : error });
      process.exit(1);
    }
  });

// ==============================================================================
// ERROR HANDLING
// ==============================================================================
program.configureOutput({
  writeErr: (str) => {
    if (str.includes('error')) {
      console.error(chalk.red(str));
    } else {
      console.error(chalk.yellow(str));
    }
  },
});

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
