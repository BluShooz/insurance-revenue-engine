# Insurance Revenue Engine

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-purple?style=for-the-badge&logo=vercel)](https://insurance-revenue-engine-ie1e098en-jon-smiths-projects-a3dfc292.vercel.app)

A complete single-agent revenue engine for life and health insurance agents. Built with **Node.js / TypeScript + Prisma + PostgreSQL**.

## Features

- **Lead Management**: Track prospects from initial contact to closed sale
- **Activity Logging**: Record all interactions with automatic lead scoring
- **Policy Management**: Manage applications, underwriting, and issued policies
- **Commission Tracking**: Automatic commission calculation and payment tracking
- **Dynamic Lead Scoring**: AI-inspired scoring algorithm that prioritizes hot leads
- **Automation Triggers**: Built-in workflows for common scenarios
- **CLI-First Interface**: Operate entirely from the command line
- **Production-Ready**: Modular architecture ready to scale to multi-agent SaaS

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+ (or use Docker)

### Installation

1. **Clone and navigate to the project:**
   ```bash
   cd insurance-revenue-engine
   ```

2. **Start PostgreSQL (Docker - recommended):**
   ```bash
   docker-compose up -d
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Set up database:**
   ```bash
   cp .env.example .env
   npm run db:setup
   ```

5. **View dashboard:**
   ```bash
   npm run dev dashboard:overview
   ```

## CLI Commands

### Lead Commands

```bash
# Add a new lead
npm run dev lead:add "John" "Doe" "555-1234" "john@example.com"

# List all leads
npm run dev lead:list

# Filter leads by status
npm run dev lead:list -- --status QUALIFIED

# View hot leads (score >= 70)
npm run dev lead:hot

# Search leads
npm run dev lead:search "John"

# Show lead details
npm run dev lead:show <leadId>

# Update lead status
npm run dev lead:update-status <leadId> QUALIFIED

# Update intent level
npm run dev lead:update-intent <leadId> HOT
```

### Activity Commands

```bash
# Log an activity
npm run dev activity:log <leadId> CALL_OUTBOUND INTERESTED --title "Initial call"

# List activities for a lead
npm run dev activity:list <leadId>

# List all recent activities
npm run dev activity:list

# View activity statistics
npm run dev activity:stats <leadId>
npm run dev activity:stats
```

### Policy Commands

```bash
# Add a policy
npm run dev policy:add <leadId> "Protective Life" TERM_LIFE 500000 800

# List all policies
npm run dev policy:list

# Filter by status
npm run dev policy:list -- --status ISSUED

# Show policy details
npm run dev policy:show <policyId>

# Update policy status (e.g., mark as issued)
npm run dev policy:update-status <policyId> ISSUED
```

### Commission Commands

```bash
# View all commissions
npm run dev commission:view

# View pending commissions only
npm run dev commission:view -- --status PENDING

# Mark commission as paid
npm run dev commission:pay <policyId>

# View commission summary
npm run dev commission:summary
```

### Campaign Commands

```bash
# List campaigns
npm run dev campaign:list

# Create a campaign
npm run dev campaign:create "Follow-up Sequence" --description "Automated follow-up"

# Run a campaign
npm run dev campaign:run "Follow-up Sequence"
```

### Dashboard Commands

```bash
# View full dashboard
npm run dev dashboard:overview

# View lead score distribution
npm run dev dashboard:scores
```

## Day 1 Test Walkthrough

Follow this complete walkthrough to test the system with real scenarios:

### Step 1: View Initial Dashboard

```bash
npm run dev dashboard:overview
```

You'll see the default agent (Sarah Mitchell) with 10 sample leads, activities, policies, and commissions.

### Step 2: List Existing Leads

```bash
npm run dev lead:list
```

Note the various lead statuses (NEW, QUALIFIED, PROPOSAL, APPLICATION, UNDERWRITING, PLACED) and intent levels.

### Step 3: View Hot Leads

```bash
npm run dev lead:hot
```

These are leads with scores >= 70. They should be your priority for follow-up.

### Step 4: Add a New Lead

```bash
npm run dev lead:add "Jane" "Smith" "555-9999" "jane.smith@email.com" --source "Website" --intent "WARM"
```

Watch for:
- ✅ Lead creation confirmation
- 📧 Simulated welcome message (email)
- 📊 Automatic score calculation

### Step 5: Log Activities with Your New Lead

Use the lead ID from the previous step:

```bash
# Log an outbound call
npm run dev activity:log <leadId> CALL_OUTBOUND LEFT_MESSAGE --title "Initial call"

# Log a follow-up
npm run dev activity:log <leadId> CALL_INBOUND INTERESTED --title "Client called back"

# Schedule a meeting
npm run dev activity:log <leadId> MEETING_SCHEDULED --title "Meeting scheduled for Friday"
```

Watch for:
- ✅ Activity logged confirmation
- 📈 Score updates with each activity
- 🤖 Automation triggers firing

### Step 6: Check Updated Score

```bash
npm run dev lead:show <leadId>
```

Note how the score increased based on activities logged.

### Step 7: Add a Policy

```bash
npm run dev policy:add <leadId> "Protective Life" TERM_LIFE 500000 600
```

Watch for:
- ✅ Policy created confirmation
- 📝 Activity logged automatically
- 💰 Commission calculated
- 📊 Lead status updated to APPLICATION

### Step 8: Issue the Policy

```bash
# First, get the policy ID from the previous output or list
npm run dev policy:list

# Mark as issued
npm run dev policy:update-status <policyId> ISSUED
```

Watch for:
- ✅ Policy status updated
- 💰 Commission created and displayed
- 🎉 Lead status updated to PLACED
- 📧 Congratulations message simulated

### Step 9: View Commissions

```bash
npm run dev commission:summary
```

You'll see:
- Pending commissions
- Paid commissions
- Total amounts
- Detailed breakdown by policy

### Step 10: Mark Commission as Paid

```bash
npm run dev commission:pay <policyId>
```

### Step 11: View Final Dashboard

```bash
npm run dev dashboard:overview
```

See how your new lead, activities, policy, and commission are all reflected.

## Lead Scoring Algorithm

The scoring system considers multiple factors:

### Base Score Components

1. **Intent Level**
   - HOT: +50 points
   - WARM: +30 points
   - COLD: +10 points
   - UNKNOWN: 0 points
   - NONE: -10 points

2. **Lead Status**
   - NEW: 0 points
   - CONTACTED: +5 points
   - ENGAGED: +15 points
   - QUALIFIED: +30 points
   - PROPOSAL: +45 points
   - APPLICATION: +60 points
   - UNDERWRITING: +75 points
   - PLACED: +100 points
   - NOT_PLACED: -20 points
   - NOT_INTERESTED: -30 points
   - UNRESPONSIVE: -10 points
   - LOST: -20 points

3. **Activity Points**
   - MEETING_COMPLETED: +20 points
   - APPLICATION_SENT: +40 points
   - PROPOSAL_SENT: +15 points
   - CALL_INBOUND: +10 points
   - CALL_OUTBOUND: +5 points
   - TEXT_RECEIVED: +8 points
   - EMAIL_RECEIVED: +7 points
   - And more...

4. **Outcome Modifiers**
   - SOLD: +50 points
   - INTERESTED: +15 points
   - POSITIVE: +10 points
   - NOT_INTERESTED: -15 points
   - NO_ANSWER: -2 points

5. **Time Decay**
   - No activity for 30 days: -5 points
   - No activity for 60 days: -10 points
   - No activity for 90 days: -20 points

**Score Range**: 0-100

**Score Categories**:
- 🔥 Hot (70-100): Immediate follow-up required
- 🌡️ Warm (40-69): Engage within 24-48 hours
- ❄️ Cold (10-39): nurture with periodic touches
- 💤 Inactive (0-9): Consider re-engagement campaign

## Commission Structure

Default commission rates (configurable):

| Product Type | First Year | Renewal |
|--------------|------------|---------|
| Term Life | 90% | 0% |
| Whole Life | 55% | 3.5% |
| Universal Life | 55% | 3.5% |
| Final Expense | 60% | 3% |
| IUL | 50% | 2.5% |
| Health ACA | 4% | 4% |
| Medicare Supplement | 25% | 2.5% |
| Medicare Advantage | 30% | 0% |

Commission payments are typically scheduled 21 days after policy issue.

## Automation Triggers

The system automatically triggers actions on:

1. **Lead Created**: Welcome message, task creation
2. **Status Changed**: Follow-up actions based on new status
3. **Activity Logged**: Score update, potential follow-up tasks
4. **Policy Created**: Commission calculation, activity logging
5. **Policy Issued**: Congratulations message, final confirmation
6. **Score Changed**: Hot lead alerts when score crosses threshold

All automations are logged to console with timestamp and context.

## Database Schema

### Core Models

- **Agent**: Insurance agent (single-agent mode uses ID "1")
- **Lead**: Prospective clients with scoring
- **Policy**: Issued/applying policies
- **Activity**: All lead interactions
- **Commission**: Earnings tracking
- **Campaign**: Automated workflows

### Key Relationships

- Agent → Leads (1:N)
- Agent → Policies (1:N)
- Agent → Activities (1:N)
- Lead → Activities (1:N)
- Lead → Policies (1:N)
- Policy → Commissions (1:N)

## Project Structure

```
insurance-revenue-engine/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Seed data script
├── src/
│   ├── cli/
│   │   ├── index.ts           # CLI entry point
│   │   └── commands/          # Command modules
│   │       ├── lead.ts
│   │       ├── activity.ts
│   │       ├── policy.ts
│   │       ├── commission.ts
│   │       ├── campaign.ts
│   │       └── dashboard.ts
│   ├── services/              # Business logic
│   │   ├── LeadService.ts
│   │   ├── ActivityService.ts
│   │   ├── PolicyService.ts
│   │   ├── CommissionService.ts
│   │   ├── ScoringService.ts
│   │   └── AutomationService.ts
│   └── utils/
│       ├── prisma.ts          # Prisma client
│       └── logger.ts          # Logging utility
├── .env                       # Environment variables
├── .env.example
├── docker-compose.yml         # PostgreSQL container
├── package.json
└── tsconfig.json
```

## Customization

### Modify Commission Rates

Edit `src/services/CommissionService.ts`:

```typescript
export const DEFAULT_COMMISSION_RATES: Record<ProductType, number> = {
  TERM_LIFE: 0.90,  // Change to your rate
  // ... other products
};
```

### Adjust Scoring Algorithm

Edit `src/services/ScoringService.ts`:

```typescript
export const SCORING_CONFIG = {
  INTENT_HOT: 50,  // Adjust weights
  STATUS_QUALIFIED: 30,
  // ... other configurations
};
```

### Add Custom Automations

Edit `src/services/AutomationService.ts` or create new campaigns via CLI.

## Development

### Database Management

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema changes (development only)
npm run db:push

# View data in Prisma Studio
npm run db:studio

# Reset database (WARNING: deletes all data)
npm run db:reset

# Re-seed database
npm run db:seed
```

### Build and Run

```bash
# Build TypeScript
npm run build

# Run compiled CLI
npm start <command>

# Run in development mode
npm run dev <command>
```

## Future Roadmap (Multi-Agent SaaS)

The modular architecture makes it easy to scale:

1. **Authentication**: Add user login/registration
2. **Multi-Tenant**: Each agent has isolated data
3. **Web Dashboard**: React/Vue frontend
4. **API Layer**: REST/GraphQL endpoints
5. **Real Integrations**:
   - Twilio for SMS
   - SendGrid/Mailgun for email
   - Insurance carrier APIs
6. **Advanced Features**:
   - Document generation
   - E-signature integration
   - Reporting and analytics
   - Mobile apps

## License

MIT

## Support

For issues, questions, or contributions, please refer to the project repository.

---

**Built for independent insurance agents who need to start using today.**
