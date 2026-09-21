import { clientIp } from './client-ip-throttler.guard.js';

describe('clientIp', () => {
  it('prefere CF-Connecting-IP (IP reelle du visiteur derriere Cloudflare) a req.ip', () => {
    expect(
      clientIp({ headers: { 'cf-connecting-ip': '41.66.1.2' }, ip: '10.0.0.7' }),
    ).toBe('41.66.1.2');
  });

  it('prend la premiere valeur si l en-tete arrive en tableau', () => {
    expect(
      clientIp({ headers: { 'cf-connecting-ip': ['41.66.1.2', '1.1.1.1'] }, ip: '10.0.0.7' }),
    ).toBe('41.66.1.2');
  });

  it('retombe sur req.ip sans en-tete (dev local)', () => {
    expect(clientIp({ headers: {}, ip: '::1' })).toBe('::1');
  });

  it('ignore un en-tete vide', () => {
    expect(clientIp({ headers: { 'cf-connecting-ip': '' }, ip: '::1' })).toBe('::1');
  });

  it('ne plante pas sans IP du tout', () => {
    expect(clientIp({})).toBe('inconnue');
  });
});
