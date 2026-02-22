# Day 1 Test Script

This document provides a complete end-to-end test you can run immediately after setup to verify the Insurance Revenue Engine is working correctly.

## Prerequisites

Before running the test, ensure you have:
- Completed the installation steps in README.md
- Run `npm run db:setup` to initialize the database
- The database is running (Docker: `docker-compose up -d`)

## Complete Test Walkthrough

### Test 1: Dashboard Overview

**Command:**
```bash
npm run dev dashboard:overview
```

**Expected Output:**
- Dashboard header with "INSURANCE REVENUE ENGINE"
- Lead Statistics section showing 10 total leads
- Score Distribution (Hot, Warm, Cold, Inactive)
- Policy Statistics
- Commission Summary
- Recent Activities table
- Quick Actions section

**✅ PASS** if you see all sections populated with data.

---

### Test 2: List Leads

**Command:**
```bash
npm run dev lead:list
```

**Expected Output:**
- Table showing leads with columns: ID, Name, Phone, Status, Intent, Score, Activities
- Sample leads like "Emily Chen" (HOT, QUALIFIED)
- Sample leads like "James Moore" (PLACED)
- Summary statistics at bottom

**✅ PASS** if table displays 10 leads.

---

### Test 3: View Hot Leads

**Command:**
```bash
npm run dev lead:hot
```

**Expected Output:**
- List of leads with score >= 70
- Should include: Emily Chen, Sarah Davis, Robert Wilson, James Moore

**✅ PASS** if at least 3 leads are shown.

---

### Test 4: Add New Lead

**Command:**
```bash
npm run dev lead:add "Test" "User" "555-TEST" "test@example.com" --source "Day1 Test" --intent "WARM"
```

**Expected Output:**
```
✅ Lead added successfully: Test User
Phone: 555-TEST
Email: test@example.com
Source: Day1 Test

[EMAIL SIMULATION]
To: test@example.com
Subject: Welcome! Let's protect what matters most
...
```

**✅ PASS** if you see success message and email simulation.

**Save the lead ID from the output for next tests.**

---

### Test 5: Log Activities

**Commands (replace `<leadId>` with ID from Test 4):**

```bash
npm run dev activity:log <leadId> CALL_OUTBOUND LEFT_MESSAGE --title "Initial outreach call"
```

**Expected Output:**
```
✅ Activity logged: CALL_OUTBOUND
Outcome: LEFT_MESSAGE

[SCORING] Lead <leadId>: 0 → 5 (+5) - Status: +5, Activities: +0
```

```bash
npm run dev activity:log <leadId> CALL_INBOUND INTERESTED --title "Client called back, interested"
```

**Expected Output:**
```
✅ Activity logged: CALL_INBOUND
Outcome: INTERESTED

[AUTOMATION] [activity.logged] CALL_INBOUND - INTERESTED
[SCORING] Lead <leadId>: 5 → 28 (+23) - Status: +5, Activities: +10, Positive outcomes: +15
[SCORING] Lead <leadId>: 28 → 28 (0) - ...
[AUTOMATION] [automation] Hot lead detected - prioritize
```

```bash
npm run dev activity:log <leadId> MEETING_SCHEDULED --title "Meeting scheduled for Friday"
```

**Expected Output:**
```
✅ Activity logged: MEETING_SCHEDULED

[SCORING] Lead <leadId>: 28 → 48 (+20) - Activities: +20
```

**✅ PASS** if scores increase with each activity and automations fire.

---

### Test 6: Check Lead Details

**Command:**
```bash
npm run dev lead:show <leadId>
```

**Expected Output:**
- Lead details with updated score (~48)
- Activity Summary showing 3 activities
- Recent Activities list

**✅ PASS** if score reflects activities logged.

---

### Test 7: Add Policy

**Command:**
```bash
npm run dev policy:add <leadId> "Protective Life" TERM_LIFE 250000 300 --rate 0.9
```

**Expected Output:**
```
✅ Policy created successfully
Carrier: Protective Life
Product: TERM_LIFE
Face Amount: $250,000
Annual Premium: $300

[ACTIVITY] [APPLICATION_SENT] Application submitted: TERM_LIFE
[SCORING] Lead <leadId>: 48 → 88 (+40) - Activities: +40
[AUTOMATION] [policy.created] Policy application started: TERM_LIFE
```

**✅ PASS** if policy created, activity logged, and score increased.

**Save the policy ID from the output.**

---

### Test 8: List Policies

**Command:**
```bash
npm run dev policy:list
```

**Expected Output:**
- Table showing all policies including your new one
- Should show "Test User" with Protectice Life TERM_LIFE

**✅ PASS** if your new policy appears in list.

---

### Test 9: Issue Policy

**Command:**
```bash
npm run dev policy:update-status <policyId> ISSUED
```

**Expected Output:**
```
✅ Policy status updated: APPLIED → ISSUED

💰 Commission calculated:
Amount: $270.00
Rate: 90.0%

[COMMISSION] [CREATED] $270.00
[ACTIVITY] [NOTE] Policy issued: TERM_LIFE
[AUTOMATION] [policy.issued] Policy issued with Protective Life

[EMAIL SIMULATION]
To: test@example.com
Subject: Great news! Your policy has been issued
...
```

**✅ PASS** if commission calculated and congratulations sent.

---

### Test 10: View Commissions

**Command:**
```bash
npm run dev commission:summary
```

**Expected Output:**
```
💰 Commission Summary

Pending Count: (number)
Paid Count: (number + 1 new)

Pending Amount: $X,XXX.XX
Paid YTD: $X,XXX.XX
Total: $X,XXX.XX

📋 Pending Commissions:
[table with commissions including your new one]
```

**✅ PASS** if your new commission appears.

---

### Test 11: Mark Commission as Paid

**Command:**
```bash
npm run dev commission:pay <policyId>
```

**Expected Output:**
```
✅ Commission marked as paid
```

**✅ PASS** if success message appears.

---

### Test 12: View Final Dashboard

**Command:**
```bash
npm run dev dashboard:overview
```

**Expected Output:**
- Total Leads should be 11 (was 10)
- Placed This Month should be 2 (was 1)
- Commission summary should include your new commission
- Recent Activities should include your logged activities

**✅ PASS** if all stats reflect your test data.

---

### Test 13: Score Distribution

**Command:**
```bash
npm run dev dashboard:scores
```

**Expected Output:**
- ASCII bar chart showing score distribution
- Top 10 leads table including your test lead (score ~100)

**✅ PASS** if test lead appears in top 10.

---

### Test 14: View Campaigns

**Command:**
```bash
npm run dev campaign:list
```

**Expected Output:**
- List of 3 campaigns:
  - New Lead Welcome (active)
  - Hot Lead Follow-up (active)
  - Unresponsive Re-engagement (active)

**✅ PASS** if 3 campaigns listed.

---

### Test 15: Activity Statistics

**Command:**
```bash
npm run dev activity:stats <leadId>
```

**Expected Output:**
```
📊 Activity Statistics for Lead: <leadId>

Total Activities: 6
First Activity: (date)
Last Activity: (date)

By Type:
  📞 CALL_OUTBOUND: 1
  📞 CALL_INBOUND: 1
  📅 MEETING_SCHEDULED: 1
  📋 APPLICATION_SENT: 1
  📝 NOTE: 2

By Outcome:
  Left message: 1
  Interested: 1
  Positive: 1
  Sold: 1
```

**✅ PASS** if stats show all your activities.

---

## Test Summary

If all 15 tests pass, your Insurance Revenue Engine is fully functional!

### You've Successfully Tested:
- ✅ Dashboard and analytics
- ✅ Lead management
- ✅ Activity logging
- ✅ Dynamic lead scoring
- ✅ Policy creation and tracking
- ✅ Commission calculation
- ✅ Automation triggers
- ✅ Campaign system
- ✅ CLI interface

### Your System Is Ready For:
1. Adding real client leads
2. Logging actual activities
3. Issuing real policies
4. Tracking commissions
5. Prioritizing hot leads
6. Automating follow-ups

## Cleanup (Optional)

To remove test data:

```bash
npm run db:reset
npm run db:seed
```

This will reset to the original sample data.

---

**Next Steps:**
- Start adding your real leads
- Customize commission rates in `src/services/CommissionService.ts`
- Adjust scoring weights in `src/services/ScoringService.ts`
- Create custom campaigns for your workflow
- Integrate with Twilio/SendGrid for real messaging
