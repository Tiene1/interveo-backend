import { writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configOpenApi } from './openapi.config.js';

/**
 * Genere backend/openapi.json a partir des controleurs et DTO.
 * Mode preview : le graphe est analyse sans instancier les providers
 * (pas besoin d'une base PostgreSQL disponible).
 *
 *   npm run openapi
 */
async function generer(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const document = SwaggerModule.createDocument(app, configOpenApi());
  await writeFile('openapi.json', `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  // eslint-disable-next-line no-console
  console.log('openapi.json genere');
}

await generer();
