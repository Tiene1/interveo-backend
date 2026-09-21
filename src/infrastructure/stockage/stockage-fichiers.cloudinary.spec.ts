import type { ConfigService } from '@nestjs/config';

const mocks = vi.hoisted(() => ({
  config: vi.fn(),
  upload_stream: vi.fn(),
  destroy: vi.fn(),
  url: vi.fn(),
}));

vi.mock('cloudinary', () => ({
  v2: {
    config: mocks.config,
    uploader: { upload_stream: mocks.upload_stream, destroy: mocks.destroy },
    url: mocks.url,
  },
}));

import { StockageFichiersCloudinary } from './stockage-fichiers.cloudinary.js';

const variables: Record<string, string> = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'cle',
  CLOUDINARY_API_SECRET: 'secret',
};
const config = {
  getOrThrow: (nom: string) => variables[nom],
} as unknown as ConfigService;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StockageFichiersCloudinary', () => {
  it('configure le SDK avec les trois variables Cloudinary', () => {
    new StockageFichiersCloudinary(config);

    expect(mocks.config).toHaveBeenCalledWith({
      cloud_name: 'demo',
      api_key: 'cle',
      api_secret: 'secret',
      secure: true,
    });
  });

  it('save : depose le contenu en authenticated, extension retiree du public_id', async () => {
    let recu: Buffer | undefined;
    mocks.upload_stream.mockImplementation(
      (_options: unknown, rappel: (erreur?: Error) => void) => ({
        end: (contenu: Buffer) => {
          recu = contenu;
          rappel(undefined);
        },
      }),
    );
    const stockage = new StockageFichiersCloudinary(config);
    const contenu = Buffer.from('image binaire');

    await stockage.save('i1/abc.jpg', contenu);

    expect(mocks.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({
        public_id: 'i1/abc',
        format: 'jpg',
        resource_type: 'image',
        type: 'authenticated',
        overwrite: true,
      }),
      expect.any(Function),
    );
    expect(recu?.equals(contenu)).toBe(true);
  });

  it('save : rejette quand Cloudinary renvoie une erreur', async () => {
    mocks.upload_stream.mockImplementation(
      (_options: unknown, rappel: (erreur?: Error) => void) => ({
        end: () => rappel(new Error('quota depasse')),
      }),
    );
    const stockage = new StockageFichiersCloudinary(config);

    await expect(stockage.save('i1/abc.png', Buffer.from('x'))).rejects.toThrow(
      'quota depasse',
    );
  });

  it('save : un chemin sans extension devient le public_id entier, sans format', async () => {
    mocks.upload_stream.mockImplementation(
      (_options: unknown, rappel: (erreur?: Error) => void) => ({
        end: () => rappel(undefined),
      }),
    );
    const stockage = new StockageFichiersCloudinary(config);

    await stockage.save('i1/sans-extension', Buffer.from('x'));

    expect(mocks.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({ public_id: 'i1/sans-extension', format: undefined }),
      expect.any(Function),
    );
  });

  it('read : telecharge le fichier via une URL signee', async () => {
    mocks.url.mockReturnValue('https://res.cloudinary.com/demo/signee');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode('contenu').buffer),
    });
    vi.stubGlobal('fetch', fetchMock);
    const stockage = new StockageFichiersCloudinary(config);

    const lu = await stockage.read('i1/abc.png');

    expect(mocks.url).toHaveBeenCalledWith(
      'i1/abc',
      expect.objectContaining({
        type: 'authenticated',
        sign_url: true,
        format: 'png',
        secure: true,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith('https://res.cloudinary.com/demo/signee');
    expect(lu.toString()).toBe('contenu');
    vi.unstubAllGlobals();
  });

  it('read : leve une erreur quand Cloudinary ne trouve pas le fichier', async () => {
    mocks.url.mockReturnValue('https://res.cloudinary.com/demo/signee');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const stockage = new StockageFichiersCloudinary(config);

    await expect(stockage.read('i1/absent.jpg')).rejects.toThrow('HTTP 404');
    vi.unstubAllGlobals();
  });

  it('delete : detruit le fichier authenticated et reste idempotent', async () => {
    mocks.destroy.mockResolvedValue({ result: 'not found' });
    const stockage = new StockageFichiersCloudinary(config);

    await expect(stockage.delete('i1/abc.jpg')).resolves.toBeUndefined();

    expect(mocks.destroy).toHaveBeenCalledWith('i1/abc', {
      resource_type: 'image',
      type: 'authenticated',
    });
  });
});
