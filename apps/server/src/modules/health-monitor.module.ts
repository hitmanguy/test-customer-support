import { Module } from '@nestjs/common';
import { HealthMonitorService } from '../services/health-monitor.service';
import { PythonAIModule } from './python-ai.module';

@Module({
  imports: [PythonAIModule],
  providers: [HealthMonitorService],
  exports: [HealthMonitorService],
})
export class HealthMonitorModule {}
