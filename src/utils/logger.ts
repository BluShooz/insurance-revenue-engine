/**
 * Simple logger utility for console output with color coding
 */

export enum LogLevel {
  INFO = 'INFO',
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG',
}

const colors = {
  [LogLevel.INFO]: '\x1b[36m', // Cyan
  [LogLevel.SUCCESS]: '\x1b[32m', // Green
  [LogLevel.WARNING]: '\x1b[33m', // Yellow
  [LogLevel.ERROR]: '\x1b[31m', // Red
  [LogLevel.DEBUG]: '\x1b[90m', // Gray
};

const reset = '\x1b[0m';

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    const color = colors[level];
    const prefix = `${color}[${timestamp}] [${level}] [${this.context}]${reset}`;

    if (data) {
      console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  success(message: string, data?: unknown): void {
    this.log(LogLevel.SUCCESS, message, data);
  }

  warning(message: string, data?: unknown): void {
    this.log(LogLevel.WARNING, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  debug(message: string, data?: unknown): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      this.log(LogLevel.DEBUG, message, data);
    }
  }

  /**
   * Log automation trigger event
   */
  automation(trigger: string, action: string, details?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    console.log(`\x1b[35m[${timestamp}] [AUTOMATION] [${trigger}] → ${action}\x1b[0m`);
    if (details) {
      console.log(JSON.stringify(details, null, 2));
    }
  }

  /**
   * Log commission event
   */
  commission(event: string, amount: number, details?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    console.log(`\x1b[32m[${timestamp}] [COMMISSION] [${event}] $${amount.toFixed(2)}\x1b[0m`);
    if (details) {
      console.log(JSON.stringify(details, null, 2));
    }
  }

  /**
   * Log scoring event
   */
  scoring(leadId: string, oldScore: number, newScore: number, reason: string): void {
    const timestamp = new Date().toISOString();
    const diff = newScore - oldScore;
    const sign = diff >= 0 ? '+' : '';
    console.log(
      `\x1b[36m[${timestamp}] [SCORING] Lead ${leadId}: ${oldScore} → ${newScore} (${sign}${diff}) - ${reason}\x1b[0m`
    );
  }
}

export default Logger;
