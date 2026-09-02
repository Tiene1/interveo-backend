import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator.js';

@ApiTags('Sante')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
