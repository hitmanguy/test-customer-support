import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PythonAIService } from './python-ai.service';
import * as fs from 'fs';
import * as path from 'path';

export interface PerformanceMetric {
  timestamp: Date;
  responseTimeMs: number;
  status: 'healthy' | 'unhealthy';
}

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);
  private lastHealthStatus: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
  private failureCount = 0;
  private readonly MAX_FAILURES = 3; 
  
  
  private performanceMetrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS_HISTORY = 60; 
  private readonly logPath: string;
  private readonly metricsLogPath: string;

  constructor(private readonly pythonAIService: PythonAIService) {
    this.logPath = path.resolve(process.cwd(), 'logs');
    
    
    if (!fs.existsSync(this.logPath)) {
      try {
        fs.mkdirSync(this.logPath, { recursive: true });
        this.logger.log(`Created logs directory at ${this.logPath}`);
      } catch (error) {
        this.logger.error(`Failed to create logs directory: ${error.message}`);
      }
    }
    
    this.metricsLogPath = path.join(this.logPath, 'health-metrics.log');
    this.logger.log(`Health metrics will be logged to: ${this.metricsLogPath}`);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async checkPythonServiceHealth() {
    const startTime = Date.now();
    try {
      const healthStatus = await this.pythonAIService.checkHealth();
      
      const responseTime = Date.now() - startTime;
      this.trackPerformanceMetrics(responseTime, healthStatus.status);
      
      if (healthStatus.status === 'healthy') {
        if (this.lastHealthStatus === 'unhealthy') {
          this.logger.log('Python service has recovered and is now healthy');
        }
        this.lastHealthStatus = 'healthy';
        this.failureCount = 0;
      } else {
        this.failureCount++;
        this.lastHealthStatus = 'unhealthy';
        
        if (this.failureCount >= this.MAX_FAILURES) {
          this.logger.error(
            `Python AI service is unhealthy for ${this.failureCount} consecutive checks. ` +
            `Error: ${healthStatus.error || 'Unknown error'}`
          );
          
          
        } else {
          this.logger.warn(
            `Python AI service health check failed (${this.failureCount}/${this.MAX_FAILURES}): ${healthStatus.error || 'Unknown error'}`
          );
        }
      }
      
      return healthStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.trackPerformanceMetrics(responseTime, 'unhealthy');
      
      this.logger.error('Error during health check:', error);
      this.failureCount++;
      this.lastHealthStatus = 'unhealthy';
      
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  async runDiagnosticCheck() {
    try {
      return await this.pythonAIService.performDiagnosticCheck();
    } catch (error) {
      this.logger.error('Error running diagnostic check:', error);
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
        timestamp: new Date(),
        diagnosticDetails: {
          message: 'Diagnostic check failed with an exception',
          dbStatsAvailable: false
        }
      };
    }
  }
  getLastHealthStatus() {
    return {
      status: this.lastHealthStatus,
      failureCount: this.failureCount,
      lastChecked: new Date()
    };
  }
  
  getPerformanceMetrics(minutes: number = 60) {
    
    const cutoffTime = Date.now() - minutes * 60 * 1000;
    const filteredMetrics = this.performanceMetrics.filter(metric => 
      metric.timestamp.getTime() > cutoffTime
    );
    
    
    const healthyMetrics = filteredMetrics.filter(m => m.status === 'healthy');
    const avgResponseTime = healthyMetrics.length > 0 
      ? healthyMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / healthyMetrics.length 
      : 0;
    
    
    const uptimePercentage = filteredMetrics.length > 0
      ? (healthyMetrics.length / filteredMetrics.length) * 100
      : 0;
    
    return {
      metrics: filteredMetrics,
      stats: {
        total: filteredMetrics.length,
        healthy: healthyMetrics.length,
        unhealthy: filteredMetrics.length - healthyMetrics.length,
        avgResponseTimeMs: Math.round(avgResponseTime),
        uptimePercentage: Math.round(uptimePercentage)
      },
      timeSpan: `${minutes} minutes`
    };
  }
  private trackPerformanceMetrics(responseTimeMs: number, status: 'healthy' | 'unhealthy') {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      responseTimeMs,
      status
    };
    this.performanceMetrics.push(metric);
    
    
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.performanceMetrics = this.performanceMetrics.filter(metric => metric.timestamp.getTime() > oneHourAgo);
    
    
    this.logMetricToFile(metric);
  }
  
  private logMetricToFile(metric: PerformanceMetric): void {
    try {
      const logEntry = `${metric.timestamp.toISOString()},${metric.status},${metric.responseTimeMs}\n`;
      fs.appendFileSync(this.metricsLogPath, logEntry);
    } catch (error) {
      this.logger.error(`Failed to write to health metrics log: ${error.message}`);
    }
  }

  
  getHistoricalMetrics(days: number = 1): any {
    try {
      if (!fs.existsSync(this.metricsLogPath)) {
        return {
          metrics: [],
          summary: { 
            totalRecords: 0, 
            uptime: 0,
            avgResponseTime: 0,
            timeSpan: `${days} days`
          }
        };
      }

      const fileContent = fs.readFileSync(this.metricsLogPath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim().length > 0);
      
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - days);
      
      const metrics: PerformanceMetric[] = lines.map(line => {
        const [timestampStr, status, responseTimeStr] = line.split(',');
        return {
          timestamp: new Date(timestampStr),
          status: status as 'healthy' | 'unhealthy',
          responseTimeMs: parseInt(responseTimeStr, 10)
        };
      }).filter(metric => metric.timestamp > cutoffTime);
      
      
      const healthyMetrics = metrics.filter(m => m.status === 'healthy');
      const avgResponseTime = healthyMetrics.length > 0 
        ? healthyMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / healthyMetrics.length 
        : 0;
      
      const uptime = metrics.length > 0
        ? (healthyMetrics.length / metrics.length) * 100
        : 0;
      
      return {
        metrics,
        summary: {
          totalRecords: metrics.length,
          uptime: Math.round(uptime * 100) / 100,
          avgResponseTime: Math.round(avgResponseTime),
          timeSpan: `${days} days`
        }
      };
    } catch (error) {
      this.logger.error(`Failed to read health metrics log: ${error.message}`);
      return {
        metrics: [],
        summary: { 
          totalRecords: 0, 
          uptime: 0,
          avgResponseTime: 0,
          timeSpan: `${days} days`,
          error: error.message
        }
      };
    }
  }

  
  @Cron(CronExpression.EVERY_5_MINUTES)
  async attemptServiceRecovery(): Promise<boolean> {
    
    if (this.failureCount < this.MAX_FAILURES) {
      return false;
    }

    this.logger.warn(`Attempting recovery of Python AI service after ${this.failureCount} failures`);
    
    try {
      
      const healthStatus = await this.pythonAIService.checkHealth();
      
      if (healthStatus.status === 'healthy') {
        this.logger.log('Python service has recovered on its own, no recovery needed');
        return true;
      }
      
      this.logger.log('Python service remains unhealthy, logging detailed diagnostic information');
      
      
      const diagnostics = await this.runDiagnosticCheck();
      this.logger.debug('Diagnostics result:', diagnostics);
      
      
      
      
      
      
      
      this.logger.warn('Recovery attempt completed, but service may still be unhealthy');
      return false;
    } catch (error) {
      this.logger.error('Error during recovery attempt:', error);
      return false;
    }
  }
}
