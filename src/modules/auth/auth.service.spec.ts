import { UnauthorizedException } from '@nestjs/common';

vi.mock('argon2', () => ({
  verify: vi.fn(),
  hash: vi.fn(),
}));

import * as argon2 from 'argon2';
import { AuthService } from './auth.service.js';
import type { UtilisateursService } from '../utilisateurs/utilisateurs.service.js';
import type { JwtService } from '@nestjs/jwt';

const verifyMock = argon2.verify as unknown as ReturnType<typeof vi.fn>;

const compteActif = {
  id: 'u1',
  identifiant: 'kouassi',
  nom: 'Kouassi Bertin',
  role: 'DIRECTEUR',
  actif: true,
  motDePasseHash: 'HASH',
  creeLe: new Date(),
  misAJourLe: new Date(),
};

function build(compte: unknown = compteActif) {
  const utilisateurs = {
    findByIdentifiant: vi.fn().mockResolvedValue(compte),
  } as unknown as UtilisateursService;
  const jwt = {
    signAsync: vi.fn().mockResolvedValue('TOKEN'),
  } as unknown as JwtService;
  return { service: new AuthService(utilisateurs, jwt), utilisateurs, jwt };
}

describe('AuthService.login', () => {
  beforeEach(() => {
    verifyMock.mockReset();
  });

  it('renvoie un accessToken avec le role dans le payload', async () => {
    verifyMock.mockResolvedValue(true);
    const { service, jwt } = build();

    const res = await service.login({ identifiant: 'kouassi', motDePasse: 'x' });

    expect(res).toEqual({ accessToken: 'TOKEN' });
    expect(jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'u1',
        role: 'DIRECTEUR',
        identifiant: 'kouassi',
      }),
    );
  });

  it('401 si identifiant inconnu', async () => {
    const { service } = build(null);
    await expect(
      service.login({ identifiant: 'inconnu', motDePasse: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401 si compte desactive', async () => {
    const { service } = build({ ...compteActif, actif: false });
    await expect(
      service.login({ identifiant: 'kouassi', motDePasse: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('401 si mot de passe faux', async () => {
    verifyMock.mockResolvedValue(false);
    const { service } = build();
    await expect(
      service.login({ identifiant: 'kouassi', motDePasse: 'faux' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
