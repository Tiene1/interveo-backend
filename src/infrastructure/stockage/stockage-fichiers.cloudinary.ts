import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { StockageFichiers } from './stockage-fichiers.interface.js';

/**
 * `cheminRelatif` ("<interventionId>/<uuid>.jpg", deja persiste dans
 * `photo.cheminFichier`) devient le public_id Cloudinary, extension retiree :
 * Cloudinary gere le format separement. Le format de chemin stocke en base ne
 * change donc pas.
 */
function decouper(cheminRelatif: string): { publicId: string; format?: string } {
  const point = cheminRelatif.lastIndexOf('.');
  if (point === -1) {
    return { publicId: cheminRelatif };
  }
  return {
    publicId: cheminRelatif.slice(0, point),
    format: cheminRelatif.slice(point + 1),
  };
}

/**
 * Stockage objet Cloudinary (2026-09-21) : le disque de l'hebergeur de
 * production (Render, offre gratuite) est ephemere et efface a chaque
 * redeploiement, donc StockageFichiersFs y perdrait toutes les photos.
 *
 * Fichiers deposes en `type: 'authenticated'` : l'URL de livraison doit etre
 * signee (avec l'API secret), une photo n'est donc jamais accessible a qui
 * devinerait son adresse Cloudinary. Le controle d'acces reste celui de
 * `GET /photos/:id` ; ici la lecture se fait cote serveur, le navigateur ne
 * contacte jamais Cloudinary.
 */
@Injectable()
export class StockageFichiersCloudinary implements StockageFichiers {
  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  save(cheminRelatif: string, contenu: Buffer): Promise<void> {
    const { publicId, format } = decouper(cheminRelatif);
    return new Promise((resolve, reject) => {
      const flux = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          format,
          resource_type: 'image',
          type: 'authenticated',
          overwrite: true,
          unique_filename: false,
          use_filename: false,
        },
        (erreur) => (erreur ? reject(erreur) : resolve()),
      );
      flux.end(contenu);
    });
  }

  async read(cheminRelatif: string): Promise<Buffer> {
    const { publicId, format } = decouper(cheminRelatif);
    const url = cloudinary.url(publicId, {
      resource_type: 'image',
      type: 'authenticated',
      sign_url: true,
      secure: true,
      format,
    });
    const reponse = await fetch(url);
    if (!reponse.ok) {
      throw new Error(`Photo introuvable sur Cloudinary (HTTP ${reponse.status})`);
    }
    return Buffer.from(await reponse.arrayBuffer());
  }

  /** Idempotent : Cloudinary repond `{ result: 'not found' }` sans lever d'erreur. */
  async delete(cheminRelatif: string): Promise<void> {
    const { publicId } = decouper(cheminRelatif);
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
      type: 'authenticated',
    });
  }
}
