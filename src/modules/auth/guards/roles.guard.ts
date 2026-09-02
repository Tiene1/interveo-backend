import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { RoleUtilisateur } from '../../../generated/prisma/client.js';
import type { JwtPayload } from '../auth.service.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequis = this.reflector.getAllAndOverride<RoleUtilisateur[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!rolesRequis || rolesRequis.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const role = request.user?.role;
    if (!role || !rolesRequis.includes(role)) {
      throw new ForbiddenException(
        `Acces reserve : ${rolesRequis.join(', ')}`,
      );
    }
    return true;
  }
}
