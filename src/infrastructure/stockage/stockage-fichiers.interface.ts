/** Jeton d'injection pour l'implémentation de StockageFichiers. */
export const STOCKAGE_FICHIERS = Symbol('STOCKAGE_FICHIERS');

/**
 * Port de stockage de fichiers binaires (photos).
 * Le chemin relatif renvoyé par l'appelant est ce qui est persisté en base
 * (`photo.cheminFichier`). L'implémentation actuelle écrit sur le système de
 * fichiers du VPS ; elle pourra être remplacée par du stockage objet sans
 * toucher au métier.
 */
export interface StockageFichiers {
  /** Enregistre un contenu sous un chemin relatif (dossiers créés au besoin). */
  save(cheminRelatif: string, contenu: Buffer): Promise<void>;
  /** Lit le contenu d'un fichier par son chemin relatif. */
  read(cheminRelatif: string): Promise<Buffer>;
  /** Supprime un fichier par son chemin relatif. Idempotent. */
  delete(cheminRelatif: string): Promise<void>;
}
