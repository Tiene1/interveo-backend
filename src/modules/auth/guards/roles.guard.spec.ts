import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

function ctx(user?: unknown) {
  const req = { user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as never;
}

function reflector(roles: string[] | undefined): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(roles),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('laisse passer si aucun @Roles', () => {
    const guard = new RolesGuard(reflector(undefined));
    expect(guard.canActivate(ctx({ role: 'TECHNICIEN' }))).toBe(true);
  });

  it('laisse passer si le role correspond', () => {
    const guard = new RolesGuard(reflector(['DIRECTEUR']));
    expect(guard.canActivate(ctx({ role: 'DIRECTEUR' }))).toBe(true);
  });

  it('403 si le role ne correspond pas', () => {
    const guard = new RolesGuard(reflector(['DIRECTEUR']));
    expect(() => guard.canActivate(ctx({ role: 'TECHNICIEN' }))).toThrow(
      ForbiddenException,
    );
  });

  it('403 si pas d utilisateur sur la requete', () => {
    const guard = new RolesGuard(reflector(['DIRECTEUR']));
    expect(() => guard.canActivate(ctx(undefined))).toThrow(ForbiddenException);
  });
});
