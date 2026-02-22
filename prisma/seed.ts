import { PrismaClient } from '@prisma/client';
import chalk from 'chalk';
import { LeadStatus, IntentLevel, ActivityType, ActivityOutcome, ProductType, PolicyStatus, CommissionType, PremiumMode } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed script for Insurance Revenue Engine
 * Creates a default independent agent and sample data
 */
async function main() {
  console.log(chalk.cyan('\n🌱 Seeding Insurance Revenue Engine...\n'));

  // Clean existing data (for development)
  console.log(chalk.yellow('🧹 Cleaning existing data...'));
  await prisma.commission.deleteMany({});
  await prisma.activity.deleteMany({});
  await prisma.policy.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.agent.deleteMany({});

  // Create default agent
  console.log(chalk.blue('👤 Creating default agent...'));
  const agent = await prisma.agent.create({
    data: {
      id: '1', // Fixed ID for single-agent mode
      name: 'Sarah Mitchell',
      email: 'sarah.mitchell@example.com',
      phone: '555-0100',
      licenseNumber: 'INS-12345',
    },
  });
  console.log(chalk.green(`✅ Agent created: ${agent.name}\n`));

  // Create sample leads with varying characteristics
  console.log(chalk.blue('👥 Creating sample leads...'));

  const leads = [
    {
      firstName: 'John',
      lastName: 'Anderson',
      phone: '555-1001',
      email: 'john.anderson@email.com',
      status: LeadStatus.NEW,
      intentLevel: IntentLevel.WARM,
      source: 'Website',
      notes: 'Interested in term life for family protection',
    },
    {
      firstName: 'Emily',
      lastName: 'Chen',
      phone: '555-1002',
      email: 'emily.chen@email.com',
      status: LeadStatus.QUALIFIED,
      intentLevel: IntentLevel.HOT,
      source: 'Referral',
      notes: 'Referred by existing client, needs $500k term policy',
    },
    {
      firstName: 'Michael',
      lastName: 'Brown',
      phone: '555-1003',
      email: 'michael.brown@email.com',
      status: LeadStatus.PROPOSAL,
      intentLevel: IntentLevel.WARM,
      source: 'Cold Call',
      notes: 'Reviewing final expense options',
    },
    {
      firstName: 'Sarah',
      lastName: 'Davis',
      phone: '555-1004',
      email: 'sarah.davis@email.com',
      status: LeadStatus.APPLICATION,
      intentLevel: IntentLevel.HOT,
      source: 'LinkedIn',
      notes: 'Application submitted for IUL',
    },
    {
      firstName: 'Robert',
      lastName: 'Wilson',
      phone: '555-1005',
      email: 'robert.wilson@email.com',
      status: LeadStatus.UNDERWRITING,
      intentLevel: IntentLevel.HOT,
      source: 'Referral',
      notes: 'In underwriting for $1M term life',
    },
    {
      firstName: 'Jennifer',
      lastName: 'Martinez',
      phone: '555-1006',
      email: 'jennifer.martinez@email.com',
      status: LeadStatus.CONTACTED,
      intentLevel: IntentLevel.COLD,
      source: 'Networking Event',
      notes: 'Initial contact made, following up',
    },
    {
      firstName: 'David',
      lastName: 'Taylor',
      phone: '555-1007',
      email: 'david.taylor@email.com',
      status: LeadStatus.ENGAGED,
      intentLevel: IntentLevel.WARM,
      source: 'Website',
      notes: 'Asking about whole life options',
    },
    {
      firstName: 'Lisa',
      lastName: 'Garcia',
      phone: '555-1008',
      email: 'lisa.garcia@email.com',
      status: LeadStatus.NEW,
      intentLevel: IntentLevel.UNKNOWN,
      source: 'Facebook Ad',
      notes: 'New lead from campaign',
    },
    {
      firstName: 'James',
      lastName: 'Moore',
      phone: '555-1009',
      email: 'james.moore@email.com',
      status: LeadStatus.PLACED,
      intentLevel: IntentLevel.HOT,
      source: 'Referral',
      notes: 'Placed policy last month',
    },
    {
      firstName: 'Amanda',
      lastName: 'White',
      phone: '555-1010',
      email: 'amanda.white@email.com',
      status: LeadStatus.NOT_INTERESTED,
      intentLevel: IntentLevel.NONE,
      source: 'Cold Call',
      notes: 'Not interested at this time',
    },
  ];

  const createdLeads = [];
  for (const leadData of leads) {
    const lead = await prisma.lead.create({
      data: {
        agentId: agent.id,
        ...leadData,
        score: 0, // Will be updated by scoring service
      },
    });
    createdLeads.push(lead);
  }

  console.log(chalk.green(`✅ Created ${createdLeads.length} leads\n`));

  // Create sample activities
  console.log(chalk.blue('📝 Creating sample activities...'));

  const activities = [
    // John Anderson - New lead
    {
      leadId: createdLeads[0].id,
      type: ActivityType.CALL_OUTBOUND,
      outcome: ActivityOutcome.LEFT_MESSAGE,
      title: 'Left initial voicemail',
    },
    // Emily Chen - Hot lead with multiple activities
    {
      leadId: createdLeads[1].id,
      type: ActivityType.CALL_INBOUND,
      outcome: ActivityOutcome.INTERESTED,
      title: 'Initial consultation call',
    },
    {
      leadId: createdLeads[1].id,
      type: ActivityType.MEETING_SCHEDULED,
      outcome: ActivityOutcome.POSITIVE,
      title: 'Scheduled fact-finding meeting',
    },
    {
      leadId: createdLeads[1].id,
      type: ActivityType.MEETING_COMPLETED,
      outcome: ActivityOutcome.POSITIVE,
      title: 'Completed fact-finding meeting',
    },
    {
      leadId: createdLeads[1].id,
      type: ActivityType.PROPOSAL_SENT,
      outcome: ActivityOutcome.POSITIVE,
      title: 'Sent term life proposal',
    },
    // Michael Brown
    {
      leadId: createdLeads[2].id,
      type: ActivityType.CALL_OUTBOUND,
      outcome: ActivityOutcome.INTERESTED,
      title: 'Discussed final expense options',
    },
    {
      leadId: createdLeads[2].id,
      type: ActivityType.EMAIL_SENT,
      outcome: null,
      title: 'Sent final expense quote comparison',
    },
    // Sarah Davis
    {
      leadId: createdLeads[3].id,
      type: ActivityType.MEETING_COMPLETED,
      outcome: ActivityOutcome.POSITIVE,
      title: 'IUL presentation meeting',
    },
    {
      leadId: createdLeads[3].id,
      type: ActivityType.APPLICATION_SENT,
      outcome: ActivityOutcome.POSITIVE,
      title: 'Submitted IUL application',
    },
    // Robert Wilson
    {
      leadId: createdLeads[4].id,
      type: ActivityType.APPLICATION_SENT,
      outcome: ActivityOutcome.POSITIVE,
      title: 'Application submitted to carrier',
    },
    {
      leadId: createdLeads[4].id,
      type: ActivityType.NOTE,
      outcome: null,
      title: 'Underwriting requested lab work',
    },
    // Jennifer Martinez
    {
      leadId: createdLeads[5].id,
      type: ActivityType.CALL_OUTBOUND,
      outcome: ActivityOutcome.LEFT_MESSAGE,
      title: 'Follow-up call',
    },
    // David Taylor
    {
      leadId: createdLeads[6].id,
      type: ActivityType.CALL_INBOUND,
      outcome: ActivityOutcome.INTERESTED,
      title: 'Inquiry about whole life',
    },
    {
      leadId: createdLeads[6].id,
      type: ActivityType.EMAIL_SENT,
      outcome: null,
      title: 'Sent whole life illustration',
    },
  ];

  for (const activity of activities) {
    await prisma.activity.create({
      data: {
        agentId: agent.id,
        ...activity,
      },
    });
  }

  console.log(chalk.green(`✅ Created ${activities.length} activities\n`));

  // Create sample policies
  console.log(chalk.blue('📄 Creating sample policies...'));

  const policies = [
    {
      leadId: createdLeads[4].id, // Robert Wilson - in underwriting
      carrier: 'Protective Life',
      productType: ProductType.TERM_LIFE,
      faceAmount: 1000000,
      premium: 1200,
      commissionRate: 0.9,
      status: PolicyStatus.UNDERWRITING,
      policyNumber: 'PL-2024-001',
    },
    {
      leadId: createdLeads[8].id, // James Moore - placed
      carrier: 'Mutual of Omaha',
      productType: ProductType.FINAL_EXPENSE,
      faceAmount: 25000,
      premium: 180,
      commissionRate: 0.6,
      status: PolicyStatus.ISSUED,
      policyNumber: 'MOO-2024-089',
      issueDate: new Date('2024-01-15'),
    },
    {
      leadId: createdLeads[3].id, // Sarah Davis - application
      carrier: 'Pacific Life',
      productType: ProductType.IUL,
      faceAmount: 500000,
      premium: 8000,
      commissionRate: 0.5,
      status: PolicyStatus.APPLIED,
      policyNumber: null,
    },
  ];

  const createdPolicies = [];
  for (const policyData of policies) {
    const policy = await prisma.policy.create({
      data: {
        agentId: agent.id,
        ...policyData,
        commissionAmount: (policyData.premium * policyData.commissionRate),
      },
    });
    createdPolicies.push(policy);
  }

  console.log(chalk.green(`✅ Created ${createdPolicies.length} policies\n`));

  // Create commissions for issued policy
  console.log(chalk.blue('💰 Creating sample commissions...'));

  await prisma.commission.create({
    data: {
      policyId: createdPolicies[1].id, // James Moore's placed policy
      agentId: agent.id,
      amount: createdPolicies[1].commissionAmount,
      type: CommissionType.FIRST_YEAR,
      status: 'PAID',
      scheduledDate: new Date('2024-02-01'),
      paidDate: new Date('2024-02-05'),
      checkNumber: 'CHK-1001',
    },
  });

  console.log(chalk.green('✅ Created commissions\n'));

  // Create sample campaigns
  console.log(chalk.blue('📢 Creating sample campaigns...'));

  await prisma.campaign.createMany({
    data: [
      {
        agentId: agent.id,
        name: 'New Lead Welcome',
        description: 'Sends welcome message to new leads',
        triggerCondition: JSON.stringify({ trigger: 'lead.created' }),
        actions: JSON.stringify([
          { type: 'send_email', template: 'welcome' },
          { type: 'create_task', task: 'Follow up in 2 days', dueDays: 2 },
        ]),
        active: true,
      },
      {
        agentId: agent.id,
        name: 'Hot Lead Follow-up',
        description: 'Prioritize hot leads for immediate contact',
        triggerCondition: JSON.stringify({
          trigger: 'score.changed',
          minScore: 70,
        }),
        actions: JSON.stringify([
          { type: 'send_sms', template: 'hot_lead_followup' },
          { type: 'create_task', task: 'Call within 24 hours', priority: 'urgent' },
        ]),
        active: true,
      },
      {
        agentId: agent.id,
        name: 'Unresponsive Re-engagement',
        description: 'Re-engage leads with no recent activity',
        triggerCondition: JSON.stringify({
          trigger: 'activity.none',
          days: 14,
        }),
        actions: JSON.stringify([
          { type: 'send_email', template: 're_engage' },
          { type: 'update_lead_score', adjustment: -10 },
        ]),
        active: true,
      },
    ],
  });

  console.log(chalk.green('✅ Created campaigns\n'));

  // Update lead scores based on activities
  console.log(chalk.blue('📈 Calculating lead scores...'));

  for (const lead of createdLeads) {
    // Simple score calculation for seed data
    let score = 0;

    // Base score from status
    const statusScores: Record<string, number> = {
      NEW: 0,
      CONTACTED: 5,
      ENGAGED: 20,
      QUALIFIED: 35,
      PROPOSAL: 50,
      APPLICATION: 65,
      UNDERWRITING: 80,
      PLACED: 100,
      NOT_INTERESTED: -10,
    };
    score += statusScores[lead.status] || 0;

    // Intent level modifier
    const intentScores: Record<string, number> = {
      HOT: 20,
      WARM: 10,
      COLD: 5,
      UNKNOWN: 0,
      NONE: -10,
    };
    score += intentScores[lead.intentLevel] || 0;

    // Activity count bonus
    const activitiesCount = await prisma.activity.count({
      where: { leadId: lead.id },
    });
    score += Math.min(activitiesCount * 3, 20);

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    await prisma.lead.update({
      where: { id: lead.id },
      data: { score },
    });
  }

  console.log(chalk.green('✅ Lead scores calculated\n'));

  // Summary
  console.log(chalk.cyan.bold('╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                    SEEDING COMPLETE                       ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.white('Agent:'));
  console.log(chalk.gray(`  Name: ${agent.name}`));
  console.log(chalk.gray(`  Email: ${agent.email}`));
  console.log(chalk.gray(`  License: ${agent.licenseNumber}\n`));

  console.log(chalk.white('Summary:'));
  console.log(chalk.gray(`  Leads: ${createdLeads.length}`));
  console.log(chalk.gray(`  Activities: ${activities.length}`));
  console.log(chalk.gray(`  Policies: ${createdPolicies.length}`));
  console.log(chalk.gray(`  Campaigns: 3\n`));

  console.log(chalk.cyan.bold('🚀 Ready to use! Try these commands:\n'));
  console.log(chalk.white('  npm run dev dashboard:overview'));
  console.log(chalk.white('  npm run dev lead:list'));
  console.log(chalk.white('  npm run dev lead:hot'));
  console.log(chalk.white('  npm run dev policy:list'));
  console.log(chalk.white('  npm run dev commission:summary'));
  console.log('');
}

main()
  .catch((e) => {
    console.error(chalk.red('Error seeding database:'), e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
