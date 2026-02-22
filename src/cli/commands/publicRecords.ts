import chalk from 'chalk';
import { table } from 'table';
import PublicRecordsLeadFinder from '../../services/PublicRecordsLeadFinder';

export default {
  /**
   * Find new homeowners from public property records
   */
  async findNewHomeowners(params: { county?: string; daysBack?: number }) {
    console.log(chalk.cyan('\n🏠 Searching for New Homeowners...\n'));
    console.log(chalk.gray(`Source: Public Property Records${params.county ? ` - ${params.county} County` : ''}`));
    console.log(chalk.gray(`Timeframe: Last ${params.daysBack || 30} days\n`));

    try {
      const homeowners = await PublicRecordsLeadFinder.findNewHomeowners(
        params.county,
        params.daysBack || 30
      );

      if (homeowners.length === 0) {
        console.log(chalk.yellow('No new homeowners found\n'));
        return;
      }

      const data = [
        [chalk.cyan('Name'), chalk.cyan('Address'), chalk.cyan('Purchase Price'), chalk.cyan('Date')],
      ];

      for (const homeowner of homeowners) {
        data.push([
          `${homeowner.firstName} ${homeowner.lastName}`,
          homeowner.address,
          `$${homeowner.purchasePrice?.toLocaleString() || 'N/A'}`,
          new Date(homeowner.purchaseDate!).toLocaleDateString(),
        ]);
      }

      console.log(`${table(data)}\n`);
      console.log(chalk.green(`Found ${homeowners.length} new homeowners`));
      console.log(chalk.gray('\n💡 Next steps:'));
      console.log(chalk.gray('  1. Import these leads into the system'));
      console.log(chalk.gray('  2. Send mortgage protection mailer'));
      console.log(chalk.gray('  3. Call within 7-14 days of purchase\n'));

      // Ask if they want to import
      console.log(chalk.cyan('Import these leads now? (y/n)'));

    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : error}\n`));
    }
  },

  /**
   * Find new business owners
   */
  async findNewBusinesses(params: { state?: string; daysBack?: number }) {
    console.log(chalk.cyan('\n💼 Searching for New Businesses...\n'));
    console.log(chalk.gray(`Source: Secretary of State - ${params.state || 'CA'}`));
    console.log(chalk.gray(`Timeframe: Last ${params.daysBack || 30} days\n`));

    try {
      const businesses = await PublicRecordsLeadFinder.findNewBusinesses(
        params.state || 'CA',
        params.daysBack || 30
      );

      if (businesses.length === 0) {
        console.log(chalk.yellow('No new businesses found\n'));
        return;
      }

      const data = [
        [chalk.cyan('Business'), chalk.cyan('Owner'), chalk.cyan('Address'), chalk.cyan('Incorporation Date')],
      ];

      for (const business of businesses) {
        data.push([
          business.businessName,
          business.ownerName || 'N/A',
          business.address || 'N/A',
          new Date(business.incorporationDate!).toLocaleDateString(),
        ]);
      }

      console.log(`${table(data)}\n`);
      console.log(chalk.green(`Found ${businesses.length} new businesses`));
      console.log(chalk.gray('\n💡 These businesses may need:'));
      console.log(chalk.gray('  • Key person insurance'));
      console.log(chalk.gray('  • Buy-sell life insurance'));
      console.log(chalk.gray('  • Business overhead expense'));
      console.log(chalk.gray('  • Group health insurance\n'));

    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : error}\n`));
    }
  },

  /**
   * Find newlyweds from marriage licenses
   */
  async findNewlyweds(params: { county?: string; daysBack?: number }) {
    console.log(chalk.cyan('\n💒 Searching for Marriage Licenses...\n'));
    console.log(chalk.gray(`Source: Public Marriage Records${params.county ? ` - ${params.county} County` : ''}`));
    console.log(chalk.gray(`Timeframe: Last ${params.daysBack || 30} days\n`));

    try {
      const newlyweds = await PublicRecordsLeadFinder.findNewlyweds(
        params.county,
        params.daysBack || 30
      );

      if (newlyweds.length === 0) {
        console.log(chalk.yellow('No newlyweds found\n'));
        return;
      }

      const data = [
        [chalk.cyan('Bride'), chalk.cyan('Groom'), chalk.cyan('Wedding Date'), chalk.cyan('County')],
      ];

      for (const couple of newlyweds) {
        data.push([
          couple.brideName,
          couple.groomName,
          new Date(couple.weddingDate!).toLocaleDateString(),
          couple.county || 'N/A',
        ]);
      }

      console.log(`${table(data)}\n`);
      console.log(chalk.green(`Found ${newlyweds.length} newlywed couples`));
      console.log(chalk.gray('\n💡 Contact timing recommendation:'));
      console.log(chalk.gray('  Wait 30-60 days after wedding'));
      console.log(chalk.gray('  Focus on newlywed protection'));
      console.log(chalk.gray('  Suggest reviewing beneficiary designations\n'));

    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : error}\n`));
    }
  },

  /**
   * Import found leads
   */
  async importLeads() {
    console.log(chalk.cyan('\n📥 Importing Public Records Leads...\n'));

    console.log(chalk.yellow('\n⚠️  LEGAL NOTICE:'));
    console.log(chalk.gray('These records are obtained from public government sources.'));
    console.log(chalk.gray('Public records include:'));
    console.log(chalk.gray('  • Property deeds (county recorder)'));
    console.log(chalk.gray('  • Business filings (secretary of state)'));
    console.log(chalk.gray('  • Marriage licenses (county clerk)'));
    console.log(chalk.gray('\nAlways verify the current status before contacting.\n'));

    console.log(chalk.cyan('Running import...\n'));

    try {
      const result = await PublicRecordsLeadFinder.importLeads([], '1');

      console.log(chalk.green(`\n✅ Import complete!`));
      console.log(chalk.gray(`Imported: ${result.imported}`));
      console.log(chalk.gray(`Skipped: ${result.skipped} (duplicates)\n`));

      console.log(chalk.cyan('Next: View imported leads'));
      console.log(chalk.gray('  npm run dev lead:list\n'));

    } catch (error) {
      console.log(chalk.red(`Error: ${error instanceof Error ? error.message : error}\n`));
    }
  },
};
