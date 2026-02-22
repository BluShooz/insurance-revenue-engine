import { NextApiRequest, NextApiResponse } from 'next';

// Initialize Prisma Client (for Vercel serverless functions)
import { PrismaClient } from '@prisma/client';
import { LeadStatus, IntentLevel } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      coverageAmount,
      healthStatus,
      healthConditions,
      source = 'Web Form',
      productType,
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({
        message: 'Missing required fields',
        required: ['firstName', 'lastName', 'phone']
      });
    }

    // Get or create default agent (agentId = "1")
    const agentId = '1';

    // Check for duplicate lead (by phone or email)
    const existingLead = await prisma.lead.findFirst({
      where: {
        agentId,
        OR: [
          { phone: phone },
          ...(email ? [{ email: email }] : []),
        ],
      },
    });

    if (existingLead) {
      // Update existing lead if found
      await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          firstName: firstName || existingLead.firstName,
          lastName: lastName || existingLead.lastName,
          email: email || existingLead.email,
          notes: existingLead.notes
            ? `${existingLead.notes}\n\nNew inquiry via ${source} on ${new Date().toISOString()}: Looking for ${coverageAmount || 'coverage'}. Health: ${healthStatus || 'not specified'}. Conditions: ${healthConditions || 'none'}.`
            : `Inquiry via ${source} on ${new Date().toISOString()}: Looking for ${coverageAmount || 'coverage'}. Health: ${healthStatus || 'not specified'}. Conditions: ${healthConditions || 'none'}.`,
          updatedAt: new Date(),
        },
      });

      // Log activity for existing lead
      await prisma.activity.create({
        data: {
          agentId,
          leadId: existingLead.id,
          type: 'EMAIL_RECEIVED',
          title: 'New inquiry via landing page',
          description: `Lead submitted new inquiry via ${source}. Coverage amount: ${coverageAmount || 'not specified'}.`,
          outcome: 'INTERESTED',
        },
      });

      return res.status(200).json({
        success: true,
        message: 'Thank you! We found your previous inquiry and will update you shortly.',
        leadId: existingLead.id,
      });
    }

    // Create new lead
    const lead = await prisma.lead.create({
      data: {
        agentId,
        firstName,
        lastName,
        email,
        phone,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        status: LeadStatus.NEW,
        intentLevel: IntentLevel.WARM, // Leads from landing pages are typically warm
        source,
        notes: `Inquiry via ${source} on ${new Date().toISOString()}\nLooking for coverage: ${coverageAmount || 'not specified'}\nHealth status: ${healthStatus || 'not specified'}\nHealth conditions: ${healthConditions || 'none'}\nProduct interest: ${productType || 'not specified'}`,
        score: 30, // Base score for landing page leads
      },
    });

    // Log initial activity
    await prisma.activity.create({
      data: {
        agentId,
        leadId: lead.id,
        type: 'EMAIL_RECEIVED',
        title: 'New lead captured via landing page',
        description: `Lead submitted inquiry via ${source}. Coverage amount: ${coverageAmount || 'not specified'}. Health status: ${healthStatus || 'not specified'}.`,
        outcome: 'POSITIVE',
      },
    });

    // Trigger automation
    // This would normally be handled by the AutomationService
    console.log(`[AUTOMATION] New lead captured: ${lead.firstName} ${lead.lastName} (${lead.id})`);
    console.log(`[AUTOMATION] Source: ${source}`);
    console.log(`[AUTOMATION] Product interest: ${productType || 'General'}`);
    console.log(`[AUTOMATION] Coverage amount: ${coverageAmount || 'Not specified'}`);

    return res.status(201).json({
      success: true,
      message: 'Thank you! Your information has been received. One of our licensed agents will contact you within 24 hours.',
      leadId: lead.id,
    });

  } catch (error) {
    console.error('Error creating lead:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred. Please try again or call us directly.',
    });
  }
}
