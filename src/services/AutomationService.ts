import { prisma } from '../utils/prisma';
import { Lead, LeadStatus, IntentLevel } from '@prisma/client';
import Logger from '../utils/logger';

const logger = new Logger('AutomationService');

/**
 * Automation trigger types
 */
export enum AutomationTrigger {
  LEAD_CREATED = 'lead.created',
  LEAD_STATUS_CHANGED = 'lead.status_changed',
  ACTIVITY_LOGGED = 'activity.logged',
  POLICY_CREATED = 'policy.created',
  POLICY_ISSUED = 'policy.issued',
  COMMISSION_EARNED = 'commission.earned',
  SCORE_CHANGED = 'score.changed',
  CUSTOM = 'custom',
}

/**
 * Automation action types
 */
export enum AutomationAction {
  SEND_EMAIL = 'send_email',
  SEND_SMS = 'send_sms',
  CREATE_TASK = 'create_task',
  UPDATE_LEAD_STATUS = 'update_lead_status',
  UPDATE_LEAD_SCORE = 'update_lead_score',
  SCHEDULE_CALL = 'schedule_call',
  ADD_TO_CAMPAIGN = 'add_to_campaign',
  WEBHOOK = 'webhook',
  LOG_NOTE = 'log_note',
}

/**
 * Trigger context passed to automation handlers
 */
export interface TriggerContext {
  trigger: AutomationTrigger;
  agentId: string;
  leadId?: string;
  policyId?: string;
  activityId?: string;
  data?: Record<string, unknown>;
}

/**
 * Message template for email/SMS simulation
 */
export interface MessageTemplate {
  to: string;
  subject?: string;
  body: string;
  channel: 'email' | 'sms';
}

/**
 * Automation Service
 * Handles all automated triggers and actions
 * Currently simulates external integrations (Twilio, SendGrid)
 * Ready for real API integration
 */
export class AutomationService {
  /**
   * Handle lead created trigger
   */
  static async handleLeadCreated(lead: Lead): Promise<void> {
    const context: TriggerContext = {
      trigger: AutomationTrigger.LEAD_CREATED,
      agentId: lead.agentId,
      leadId: lead.id,
      data: {
        leadName: `${lead.firstName} ${lead.lastName}`,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        source: lead.source,
      },
    };

    logger.automation('lead.created', 'New lead registered', {
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      email: lead.email,
      phone: lead.phone,
    });

    // Send welcome message (simulated)
    await this.sendWelcomeMessage(lead);

    // Check for matching campaigns
    await this.checkCampaigns(context);
  }

  /**
   * Handle lead status changed trigger
   */
  static async handleLeadStatusChanged(
    leadId: string,
    oldStatus: LeadStatus,
    newStatus: LeadStatus
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return;
    }

    const context: TriggerContext = {
      trigger: AutomationTrigger.LEAD_STATUS_CHANGED,
      agentId: lead.agentId,
      leadId,
      data: {
        oldStatus,
        newStatus,
        leadName: `${lead.firstName} ${lead.lastName}`,
      },
    };

    logger.automation('lead.status_changed', `Status updated: ${oldStatus} → ${newStatus}`, {
      leadId,
      leadName: `${lead.firstName} ${lead.lastName}`,
    });

    // Status-based automations
    await this.handleStatusChangeAutomations(lead, oldStatus, newStatus);

    // Check for matching campaigns
    await this.checkCampaigns(context);
  }

  /**
   * Handle activity logged trigger
   */
  static async handleActivityLogged(
    leadId: string,
    activityType: string,
    outcome: string | null
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return;
    }

    const context: TriggerContext = {
      trigger: AutomationTrigger.ACTIVITY_LOGGED,
      agentId: lead.agentId,
      leadId,
      data: {
        activityType,
        outcome,
        leadName: `${lead.firstName} ${lead.lastName}`,
      },
    };

    logger.automation('activity.logged', `${activityType} - ${outcome || 'no outcome'}`, {
      leadId,
      leadName: `${lead.firstName} ${lead.lastName}`,
    });

    // Activity-based automations
    await this.handleActivityAutomations(lead, activityType, outcome);

    // Check for matching campaigns
    await this.checkCampaigns(context);
  }

  /**
   * Handle policy created trigger
   */
  static async handlePolicyCreated(
    policyId: string,
    leadId: string,
    productType: string,
    premium: number
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return;
    }

    logger.automation('policy.created', `Policy application started: ${productType}`, {
      policyId,
      leadId,
      leadName: `${lead.firstName} ${lead.lastName}`,
      productType,
      premium,
    });

    const context: TriggerContext = {
      trigger: AutomationTrigger.POLICY_CREATED,
      agentId: lead.agentId,
      leadId,
      policyId,
      data: {
        productType,
        premium,
        leadName: `${lead.firstName} ${lead.lastName}`,
      },
    };

    // Check for matching campaigns
    await this.checkCampaigns(context);
  }

  /**
   * Handle policy issued trigger
   */
  static async handlePolicyIssued(
    policyId: string,
    leadId: string,
    carrier: string,
    productType: string
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return;
    }

    logger.automation('policy.issued', `Policy issued with ${carrier}`, {
      policyId,
      leadId,
      leadName: `${lead.firstName} ${lead.lastName}`,
      carrier,
      productType,
    });

    // Send congratulations message
    await this.sendPolicyIssuedMessage(lead, carrier, productType);

    const context: TriggerContext = {
      trigger: AutomationTrigger.POLICY_ISSUED,
      agentId: lead.agentId,
      leadId,
      policyId,
      data: {
        carrier,
        productType,
        leadName: `${lead.firstName} ${lead.lastName}`,
      },
    };

    // Check for matching campaigns
    await this.checkCampaigns(context);
  }

  /**
   * Handle commission earned trigger
   */
  static async handleCommissionEarned(
    policyId: string,
    leadId: string,
    amount: number
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return;
    }

    logger.automation('commission.earned', `Commission earned: $${amount.toFixed(2)}`, {
      policyId,
      leadId,
      leadName: `${lead.firstName} ${lead.lastName}`,
      amount,
    });
  }

  /**
   * Handle score changed trigger
   */
  static async handleScoreChanged(
    leadId: string,
    oldScore: number,
    newScore: number
  ): Promise<void> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) {
      return;
    }

    // Only trigger on significant score changes
    const threshold = 20;
    if (Math.abs(newScore - oldScore) < threshold) {
      return;
    }

    logger.automation('score.changed', `Lead score updated: ${oldScore} → ${newScore}`, {
      leadId,
      leadName: `${lead.firstName} ${lead.lastName}`,
    });

    const context: TriggerContext = {
      trigger: AutomationTrigger.SCORE_CHANGED,
      agentId: lead.agentId,
      leadId,
      data: {
        oldScore,
        newScore,
        leadName: `${lead.firstName} ${lead.lastName}`,
      },
    };

    // Score-based automations
    await this.handleScoreAutomations(lead, newScore);

    // Check for matching campaigns
    await this.checkCampaigns(context);
  }

  /**
   * Send welcome message to new lead (simulated)
   * TODO: Integrate with SendGrid/Mailgun
   */
  private static async sendWelcomeMessage(lead: Lead): Promise<void> {
    const message: MessageTemplate = {
      to: lead.email || lead.phone,
      subject: 'Welcome! Let\'s protect what matters most',
      body: this.getWelcomeMessageTemplate(lead),
      channel: lead.email ? 'email' : 'sms',
    };

    // Simulate sending message
    await this.simulateSendMessage(message);

    logger.info('Welcome message sent', {
      leadId: lead.id,
      channel: message.channel,
      to: message.to,
    });
  }

  /**
   * Get welcome message template
   */
  private static getWelcomeMessageTemplate(lead: Lead): string {
    const firstName = lead.firstName;

    return `Hi ${firstName}!

Thanks for reaching out! I'm excited to help you explore the best insurance options to protect your family's future.

I'll be reviewing your information and will reach out shortly to discuss your specific needs.

In the meantime, feel free to reply to this message if you have any questions.

Best regards`;
  }

  /**
   * Send policy issued message (simulated)
   * TODO: Integrate with SendGrid/Mailgun
   */
  private static async sendPolicyIssuedMessage(
    lead: Lead,
    carrier: string,
    productType: string
  ): Promise<void> {
    const message: MessageTemplate = {
      to: lead.email || lead.phone,
      subject: 'Great news! Your policy has been issued',
      body: this.getPolicyIssuedMessageTemplate(lead, carrier, productType),
      channel: lead.email ? 'email' : 'sms',
    };

    // Simulate sending message
    await this.simulateSendMessage(message);

    logger.info('Policy issued message sent', {
      leadId: lead.id,
      channel: message.channel,
      to: message.to,
    });
  }

  /**
   * Get policy issued message template
   */
  private static getPolicyIssuedMessageTemplate(
    lead: Lead,
    carrier: string,
    productType: string
  ): string {
    const firstName = lead.firstName;

    return `Congratulations ${firstName}!

Great news! Your ${productType.replace(/_/g, ' ')} policy with ${carrier} has been issued.

You should receive your policy documents directly from the carrier within 7-10 business days.

I'll be in touch to ensure you understand your coverage and answer any questions.

Thank you for your trust!

Best regards`;
  }

  /**
   * Simulate sending message (console log)
   * In production, integrate with Twilio (SMS) and SendGrid (Email)
   */
  private static async simulateSendMessage(message: MessageTemplate): Promise<void> {
    const timestamp = new Date().toISOString();

    if (message.channel === 'email') {
      console.log(`
═══════════════════════════════════════════════════════════════
📧 EMAIL SIMULATION
═══════════════════════════════════════════════════════════════
To: ${message.to}
Subject: ${message.subject}
Date: ${timestamp}

${message.body}
═══════════════════════════════════════════════════════════════
`);
    } else {
      console.log(`
═══════════════════════════════════════════════════════════════
📱 SMS SIMULATION
═══════════════════════════════════════════════════════════════
To: ${message.to}
Date: ${timestamp}

${message.body}
═══════════════════════════════════════════════════════════════
`);
    }
  }

  /**
   * Handle status-based automations
   */
  private static async handleStatusChangeAutomations(
    lead: Lead,
    oldStatus: LeadStatus,
    newStatus: LeadStatus
  ): Promise<void> {
    // Lead became qualified
    if (newStatus === 'QUALIFIED' && oldStatus !== 'QUALIFIED') {
      logger.automation('automation', 'Lead qualified - scheduling follow-up', {
        leadId: lead.id,
      });
      // TODO: Create task or schedule call
    }

    // Lead in underwriting
    if (newStatus === 'UNDERWRITING' && oldStatus !== 'UNDERWRITING') {
      logger.automation('automation', 'Application in underwriting', {
        leadId: lead.id,
      });
    }
  }

  /**
   * Handle activity-based automations
   */
  private static async handleActivityAutomations(
    lead: Lead,
    activityType: string,
    outcome: string | null
  ): Promise<void> {
    // Left message - schedule follow-up
    if (outcome === 'LEFT_MESSAGE' || outcome === 'NO_ANSWER') {
      logger.automation('automation', 'Follow-up scheduled (no answer)', {
        leadId: lead.id,
      });
      // TODO: Create task for follow-up in 2-3 days
    }

    // Expressed interest
    if (outcome === 'INTERESTED' || outcome === 'POSITIVE') {
      logger.automation('automation', 'Hot lead detected - prioritize', {
        leadId: lead.id,
      });
    }

    // Not interested
    if (outcome === 'NOT_INTERESTED') {
      logger.automation('automation', 'Lead marked as not interested', {
        leadId: lead.id,
      });
    }
  }

  /**
   * Handle score-based automations
   */
  private static async handleScoreAutomations(lead: Lead, newScore: number): Promise<void> {
    // Hot lead (score >= 70)
    if (newScore >= 70) {
      logger.automation('automation', '🔥 HOT LEAD ALERT - Immediate follow-up recommended', {
        leadId: lead.id,
        score: newScore,
      });
      // TODO: Create urgent task
    }

    // Lead warming up (score 40-69)
    if (newScore >= 40 && newScore < 70) {
      logger.automation('automation', 'Lead warming up - engage soon', {
        leadId: lead.id,
        score: newScore,
      });
    }

    // Lead cooling down (score dropped below 20)
    if (newScore < 20) {
      logger.automation('automation', 'Lead cooling - consider re-engagement campaign', {
        leadId: lead.id,
        score: newScore,
      });
    }
  }

  /**
   * Check for matching campaigns and execute them
   */
  private static async checkCampaigns(context: TriggerContext): Promise<void> {
    const campaigns = await prisma.campaign.findMany({
      where: {
        agentId: context.agentId,
        active: true,
      },
    });

    for (const campaign of campaigns) {
      const shouldTrigger = await this.evaluateCampaignTrigger(campaign.id, context);

      if (shouldTrigger) {
        await this.executeCampaign(campaign.id, context);
      }
    }
  }

  /**
   * Evaluate if a campaign should trigger based on conditions
   */
  private static async evaluateCampaignTrigger(
    campaignId: string,
    context: TriggerContext
  ): Promise<boolean> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return false;
    }

    try {
      const triggerCondition = JSON.parse(campaign.triggerCondition);

      // Check if trigger matches
      if (triggerCondition.trigger && triggerCondition.trigger !== context.trigger) {
        return false;
      }

      // Additional conditions can be evaluated here
      // For example: lead status, score, intent level, etc.

      return true;
    } catch (error) {
      logger.error(`Failed to evaluate campaign trigger: ${campaignId}`, { error });
      return false;
    }
  }

  /**
   * Execute campaign actions
   */
  private static async executeCampaign(
    campaignId: string,
    context: TriggerContext
  ): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return;
    }

    logger.automation('campaign', `Executing campaign: ${campaign.name}`, {
      campaignId,
      trigger: context.trigger,
    });

    try {
      const actions = JSON.parse(campaign.actions);

      // Execute each action in the campaign
      for (const action of actions) {
        await this.executeAction(action, context);
      }

      // Update campaign stats
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          runCount: { increment: 1 },
          lastRunAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Failed to execute campaign: ${campaignId}`, { error });
    }
  }

  /**
   * Execute a single action
   */
  private static async executeAction(
    action: any,
    context: TriggerContext
  ): Promise<void> {
    switch (action.type) {
      case AutomationAction.SEND_EMAIL:
        logger.automation('action', 'Send email (simulated)', {
          template: action.template,
          leadId: context.leadId,
        });
        // TODO: Integrate with SendGrid
        break;

      case AutomationAction.SEND_SMS:
        logger.automation('action', 'Send SMS (simulated)', {
          template: action.template,
          leadId: context.leadId,
        });
        // TODO: Integrate with Twilio
        break;

      case AutomationAction.UPDATE_LEAD_STATUS:
        if (context.leadId) {
          await prisma.lead.update({
            where: { id: context.leadId },
            data: { status: action.status },
          });
          logger.automation('action', `Updated lead status to ${action.status}`, {
            leadId: context.leadId,
          });
        }
        break;

      case AutomationAction.CREATE_TASK:
        logger.automation('action', 'Create task (simulated)', {
          task: action.task,
          dueDate: action.dueDate,
          leadId: context.leadId,
        });
        // TODO: Integrate with task system
        break;

      case AutomationAction.LOG_NOTE:
        logger.automation('action', 'Log note', {
          note: action.note,
          leadId: context.leadId,
        });
        break;

      case AutomationAction.WEBHOOK:
        logger.automation('action', 'Webhook call (simulated)', {
          url: action.url,
          method: action.method || 'POST',
        });
        // TODO: Make actual webhook call
        break;

      default:
        logger.warning(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Create a new campaign
   */
  static async createCampaign(params: {
    agentId: string;
    name: string;
    description?: string;
    triggerCondition: Record<string, unknown>;
    actions: unknown[];
  }): Promise<void> {
    await prisma.campaign.create({
      data: {
        agentId: params.agentId,
        name: params.name,
        description: params.description,
        triggerCondition: JSON.stringify(params.triggerCondition),
        actions: JSON.stringify(params.actions),
        active: true,
      },
    });

    logger.success(`Campaign created: ${params.name}`);
  }

  /**
   * Run a campaign manually
   */
  static async runCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Get all leads for the agent
    const leads = await prisma.lead.findMany({
      where: {
        agentId: campaign.agentId,
      },
    });

    logger.info(`Running campaign "${campaign.name}" for ${leads.length} leads`);

    for (const lead of leads) {
      const context: TriggerContext = {
        trigger: AutomationTrigger.CUSTOM,
        agentId: campaign.agentId,
        leadId: lead.id,
        data: {
          leadName: `${lead.firstName} ${lead.lastName}`,
        },
      };

      await this.executeCampaign(campaignId, context);
    }

    logger.success(`Campaign "${campaign.name}" completed`);
  }

  /**
   * List all campaigns for an agent
   */
  static async listCampaigns(agentId: string) {
    return prisma.campaign.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Toggle campaign active status
   */
  static async toggleCampaign(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { active: !campaign.active },
    });

    logger.info(`Campaign "${campaign.name}" ${!campaign.active ? 'activated' : 'deactivated'}`);
  }
}

export default AutomationService;
