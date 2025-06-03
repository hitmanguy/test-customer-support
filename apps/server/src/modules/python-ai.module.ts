import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PythonAIService } from '../services/python-ai.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [PythonAIService],
  exports: [PythonAIService],
})
export class PythonAIModule {}
