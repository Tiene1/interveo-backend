import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UtilisateursService } from '../utilisateurs/utilisateurs.service.js';
import { LoginDto } from './dto/login.dto.js';
import { ChangerMotDePasseDto } from './dto/changer-mot-de-passe.dto.js';
import type { RoleUtilisateur } from '../../generated/prisma/client.js';

export interface JwtPayload {
  sub: string;
  identifiant: string;
  role: RoleUtilisateur;
}

export interface LoginResult {
  accessToken: string;
}

export interface ProfilUtilisateur {
  id: string;
  nom: string;
  identifiant: string;
  role: RoleUtilisateur;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly utilisateurs: UtilisateursService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const erreur = new UnauthorizedException(
      'Identifiant ou mot de passe incorrect',
    );

    const utilisateur = await this.utilisateurs.findByIdentifiant(
      dto.identifiant,
    );
    if (!utilisateur || !utilisateur.actif) {
      throw erreur;
    }

    const motDePasseOk = await argon2.verify(
      utilisateur.motDePasseHash,
      dto.motDePasse,
    );
    if (!motDePasseOk) {
      throw erreur;
    }

    const payload: JwtPayload = {
      sub: utilisateur.id,
      identifiant: utilisateur.identifiant,
      role: utilisateur.role,
    };
    return { accessToken: await this.jwt.signAsync(payload) };
  }

  /**
   * Libre-service, tout role. Un mot de passe actuel faux renvoie 400 et non
   * 401 : le client web purge le jeton (donc deconnecte) sur tout 401, ce qui
   * serait absurde pour une simple faute de frappe dans ce formulaire.
   */
  async changerMotDePasse(
    userId: string,
    dto: ChangerMotDePasseDto,
  ): Promise<void> {
    const utilisateur = await this.utilisateurs.findById(userId);
    if (!utilisateur || !utilisateur.actif) {
      throw new UnauthorizedException('Compte introuvable ou desactive');
    }

    const actuelCorrect = await argon2.verify(
      utilisateur.motDePasseHash,
      dto.motDePasseActuel,
    );
    if (!actuelCorrect) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }
    if (dto.motDePasseActuel === dto.nouveauMotDePasse) {
      throw new BadRequestException(
        'Le nouveau mot de passe doit etre different de l actuel',
      );
    }

    await this.utilisateurs.mettreAJourMotDePasse(
      userId,
      dto.nouveauMotDePasse,
    );
  }

  async moi(userId: string): Promise<ProfilUtilisateur> {
    const utilisateur = await this.utilisateurs.findById(userId);
    if (!utilisateur || !utilisateur.actif) {
      throw new UnauthorizedException('Compte introuvable ou desactive');
    }
    return {
      id: utilisateur.id,
      nom: utilisateur.nom,
      identifiant: utilisateur.identifiant,
      role: utilisateur.role,
    };
  }
}
