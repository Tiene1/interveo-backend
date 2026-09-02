import { Injectable } from '@nestjs/common';
import { SyncRepository } from './sync.repository.js';
import { PullSyncDto } from './dto/pull-sync.dto.js';
import type { Intervention } from '../../generated/prisma/client.js';
import type { JwtPayload } from '../auth/auth.service.js';

@Injectable()
export class SyncService {
  constructor(private readonly repo: SyncRepository) {}

  pull(dto: PullSyncDto, utilisateur: JwtPayload): Promise<Intervention[]> {
    return this.repo.pull(utilisateur.sub, dto.depuis);
  }
}
