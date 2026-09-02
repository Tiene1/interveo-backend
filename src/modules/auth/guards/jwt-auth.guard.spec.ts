import { UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function ctx(headers: Record<string, string> = {}) {
  const req: { headers: Record<string, string>; user?: unknown } = { headers };
  return {
    req,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => () => undefined,
      getClass: () => class {},
    },
  };
}

function reflector(isPublic: boolean): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
}

describe('JwtAuthGuard', () => {
  it('laisse passer une route @Public sans verifier le token', async () => {
    const jwt = { verifyAsync: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector(true), jwt);
    await expect(guard.canActivate(ctx().ctx as never)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('401 si pas de header Authorization', async () => {
    const jwt = { verifyAsync: vi.fn() } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector(false), jwt);
    await expect(guard.canActivate(ctx().ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('401 si le token est invalide', async () => {
    const jwt = {
      verifyAsync: vi.fn().mockRejectedValue(new Error('bad')),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector(false), jwt);
    await expect(
      guard.canActivate(ctx({ authorization: 'Bearer xxx' }).ctx as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attache le payload a request.user si le token est valide', async () => {
    const payload = { sub: 'u1', identifiant: 'koffi', role: 'TECHNICIEN' };
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue(payload),
    } as unknown as JwtService;
    const guard = new JwtAuthGuard(reflector(false), jwt);
    const c = ctx({ authorization: 'Bearer valid' });
    await expect(guard.canActivate(c.ctx as never)).resolves.toBe(true);
    expect(c.req.user).toEqual(payload);
  });
});
