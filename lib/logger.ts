type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, any> | undefined;
  userId?: string | undefined;
  requestId?: string | undefined;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private apiEndpoint = '/api/logs';

  private formatMessage(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      userId: this.getCurrentUserId(),
      requestId: this.getRequestId(),
    };
    if (metadata !== undefined) {
      entry.metadata = metadata;
    }
    return entry;
  }

  private getCurrentUserId(): string | undefined {
    // Get user ID from session/context
    // This would be implemented based on your auth system
    return undefined;
  }

  private getRequestId(): string | undefined {
    // Get request ID from headers or generate one
    return undefined;
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.isDevelopment) return true;
    
    // In production, only log warnings and errors
    return ['warn', 'error'].includes(level);
  }

  private consoleLog(entry: LogEntry) {
    const { level, message, metadata } = entry;
    
    switch (level) {
      case 'debug':
        console.debug(message, metadata);
        break;
      case 'info':
        console.info(message, metadata);
        break;
      case 'warn':
        console.warn(message, metadata);
        break;
      case 'error':
        console.error(message, metadata);
        break;
    }
  }

  private async sendToApi(entry: LogEntry) {
    try {
      await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      console.error('Failed to send log to API:', error);
    }
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    const entry = this.formatMessage(level, message, metadata);
    
    // Always log to console in development
    if (this.isDevelopment) {
      this.consoleLog(entry);
    }

    // Send to API in production or for errors
    if (!this.isDevelopment || level === 'error') {
      this.sendToApi(entry);
    }
  }

  debug(message: string, metadata?: Record<string, any>) {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>) {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>) {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, any>) {
    this.log('error', message, metadata);
  }

  // Specialized logging methods
  apiRequest(method: string, url: string, metadata?: Record<string, any>) {
    this.info(`API Request: ${method} ${url}`, metadata);
  }

  apiResponse(method: string, url: string, status: number, metadata?: Record<string, any>) {
    const level = status >= 400 ? 'error' : 'info';
    this.log(level, `API Response: ${method} ${url} - ${status}`, metadata);
  }

  userAction(action: string, metadata?: Record<string, any>) {
    this.info(`User Action: ${action}`, metadata);
  }

  routerEvent(routerId: string, event: string, metadata?: Record<string, any>) {
    this.info(`Router Event: ${routerId} - ${event}`, metadata);
  }

  paymentEvent(transactionId: string, event: string, metadata?: Record<string, any>) {
    this.info(`Payment Event: ${transactionId} - ${event}`, metadata);
  }
}

export const logger = new Logger();