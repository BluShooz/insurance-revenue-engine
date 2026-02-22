import { PrismaClient, LeadStatus, IntentLevel } from '@prisma/client';
import Logger from '../src/utils/logger';

const prisma = new PrismaClient();
const logger = new Logger('PublicRecordsScraper');

/**
 * LEGAL: Scrape public record APIs for lead generation
 * These are publicly available government records
 */
export class PublicRecordsLeadFinder {
  /**
   * Find new homeowners from public property records
   * These are PUBLIC RECORDS - anyone can access them
   */
  static async findNewHomeowners(county?: string, daysBack: number = 30) {
    logger.info('Searching for new homeowners...');

    // In production, connect to:
    // - County recorder APIs (many have them)
    // - County assessor databases
    // - Property tax records
    // - Zillow API (for recent sales)

    // Example: County Recorder API call
    // const recentDeeds = await fetch(`https://api.county-recorder.com/deeds?days=${daysBack}`);

    // DEMO: Return sample data
    const newHomeowners = [
      {
        firstName: 'Jennifer',
        lastName: 'Adams',
        address: '123 Oak Street, Anytown, CA',
        purchaseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        purchasePrice: 450000,
        source: 'Public Record - Property Deed',
      },
      {
        firstName: 'Michael',
        lastName: 'Chen',
        address: '456 Maple Ave, Anytown, CA',
        purchaseDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
        purchasePrice: 525000,
        source: 'Public Record - Property Deed',
      },
      // More records...
    ];

    logger.info(`Found ${newHomeowners.length} new homeowners`);

    return newHomeowners;
  }

  /**
   * Find new businesses from Secretary of State filings
   * These are PUBLIC RECORDS
   */
  static async findNewBusinesses(state: string = 'CA', daysBack: number = 30) {
    logger.info(`Searching for new businesses in ${state}...`);

    // In production, connect to:
    // - Secretary of State business entity search
    // - County clerk offices
    // - Chamber of commerce new member lists

    // Many states have APIs or bulk data downloads:
    // - California: https://bizfile.sos.ca.gov/
    // - Texas: https://www.sos.state.tx.us/corp/
    // - Florida: https://dos.myflorida.com/sunbiz/

    const newBusinesses = [
      {
        businessName: 'Chen Consulting LLC',
        ownerName: 'David Chen',
        address: '789 Business Park, Suite 100',
        incorporationDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        source: 'Public Record - Secretary of State',
      },
      // More records...
    ];

    logger.info(`Found ${newBusinesses.length} new businesses`);

    return newBusinesses;
  }

  /**
   * Find marriage licenses from public records
   * Newlyweds often need life insurance
   */
  static async findNewlyweds(county?: string, daysBack: number = 30) {
    logger.info('Searching for marriage licenses...');

    // County clerk offices maintain marriage license records
    // These are PUBLIC RECORDS (except the actual license details)

    const newlyweds = [
      {
        brideName: 'Sarah Johnson',
        groomName: 'Michael Smith',
        weddingDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        county: 'Orange County',
        source: 'Public Record - Marriage License',
      },
      // More records...
    ];

    logger.info(`Found ${newlyweds.length} newlywed couples`);

    return newlyweds;
  }

  /**
   * Import found leads into the system
   */
  static async importLeads(leadData: any[], agentId: string = '1') {
    let imported = 0;
    let skipped = 0;

    for (const data of leadData) {
      try {
        // Check for duplicates
        const existing = await prisma.lead.findFirst({
          where: {
            agentId,
            OR: [
              { firstName: data.firstName, lastName: data.lastName },
              ...(data.address ? [{ notes: { contains: data.address } }] : []),
            ],
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Create lead
        await prisma.lead.create({
          data: {
            agentId,
            firstName: data.firstName || data.ownerName?.split(' ')[0] || '',
            lastName: data.lastName || data.ownerName?.split(' ').slice(1).join(' ') || '',
            email: data.email,
            phone: data.phone,
            address: data.address,
            city: data.city,
            state: data.state,
            status: LeadStatus.NEW,
            intentLevel: IntentLevel.WARM,
            source: data.source,
            notes: this.generateLeadNote(data),
            score: 40, // Base score for public record leads
          },
        });

        imported++;
        logger.success(`Imported: ${data.firstName} ${data.lastName}`);
      } catch (error) {
        logger.error(`Failed to import lead`, { data, error });
      }
    }

    logger.info(`Import complete: ${imported} imported, ${skipped} skipped (duplicates)`);

    return { imported, skipped };
  }

  private static generateLeadNote(data: any): string {
    const parts: string[] = [`Source: ${data.source}`];

    if (data.purchasePrice) {
      parts.push(`Home purchase: $${data.purchasePrice.toLocaleString()}`);
      parts.push(`Likely needs mortgage protection insurance`);
    }

    if (data.incorporationDate) {
      parts.push(`New business owner`);
      parts.push(`May need key person insurance or buy-sell life insurance`);
    }

    if (data.weddingDate) {
      parts.push(`Recently married`);
      parts.push(`Newlyweds often need life insurance to protect each other`);
    }

    return parts.join('\n');
  }
}

export default PublicRecordsLeadFinder;
