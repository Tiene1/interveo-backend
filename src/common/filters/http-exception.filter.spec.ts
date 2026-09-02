import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter.js';

function mockHost(url = '/test', method = 'GET') {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url, method }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('formate une HttpException dans l enveloppe uniforme', () => {
    const { host, status, json } = mockHost('/x', 'POST');

    filter.catch(new BadRequestException('champ invalide'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'champ invalide',
        error: 'Bad Request',
        path: '/x',
        method: 'POST',
      }),
    );
    expect(json.mock.calls[0][0].timestamp).toEqual(expect.any(String));
  });

  it('renvoie une 500 generique pour une erreur non HTTP, sans fuite du detail', () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { host, status, json } = mockHost();

    filter.catch(new Error('secret interne'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Erreur interne du serveur',
        error: 'Internal Server Error',
      }),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('secret interne');
  });
});
