import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

const logger = new Logger('ClientIpThrottlerGuard');
let repliSignale = false;

/**
 * IP du visiteur. En production le backend est derriere Cloudflare puis le
 * load balancer de Render : `req.ip` vaudrait l'adresse du load balancer,
 * partagee par TOUS les visiteurs (la limite deviendrait globale et bloquerait
 * tout le monde d'un coup). Cloudflare ecrase `CF-Connecting-IP` avec l'IP
 * reelle du visiteur ; un client ne peut pas la falsifier puisqu'il ne peut
 * joindre l'origine qu'a travers Cloudflare. En local (pas de proxy), repli
 * sur `req.ip`.
 */
export function clientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): string {
  const brut = req.headers?.['cf-connecting-ip'];
  const valeur = Array.isArray(brut) ? brut[0] : brut;
  if (typeof valeur === 'string' && valeur !== '') {
    return valeur;
  }
  if (process.env.RENDER === 'true' && !repliSignale) {
    repliSignale = true;
    logger.warn(
      'En-tete CF-Connecting-IP absent sur Render : repli sur req.ip, la limite de debit risque d etre partagee entre tous les visiteurs',
    );
  }
  return req.ip ?? 'inconnue';
}

@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(clientIp(req));
  }
}
