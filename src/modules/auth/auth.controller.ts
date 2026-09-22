import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import type {
  JwtPayload,
  LoginResult,
  ProfilUtilisateur,
} from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto.js';
import { ChangerNomDto } from './dto/changer-nom.dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { ClientIpThrottlerGuard } from '../../common/throttle/client-ip-throttler.guard.js';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ClientIpThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @ApiBearerAuth('jwt')
  @UseGuards(ClientIpThrottlerGuard)
  @Patch('mot-de-passe')
  @HttpCode(HttpStatus.NO_CONTENT)
  changerMotDePasse(
    @Body() dto: ChangerMotDePasseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.authService.changerMotDePasse(user.sub, dto);
  }

  @ApiBearerAuth('jwt')
  @Patch('nom')
  changerNom(
    @Body() dto: ChangerNomDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ProfilUtilisateur> {
    return this.authService.changerNom(user.sub, dto);
  }

  @ApiBearerAuth('jwt')
  @Get('moi')
  moi(@CurrentUser() user: JwtPayload): Promise<ProfilUtilisateur> {
    return this.authService.moi(user.sub);
  }
}
