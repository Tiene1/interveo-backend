import { SetMetadata } from '@nestjs/common';
import type { RoleUtilisateur } from '../../../generated/prisma/client.js';

export const ROLES_KEY = 'roles';

/** Restreint une route à un ou plusieurs rôles. */
export const Roles = (...roles: RoleUtilisateur[]) =>
  SetMetadata(ROLES_KEY, roles);
