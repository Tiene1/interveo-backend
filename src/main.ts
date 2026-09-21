import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { configOpenApi } from './openapi.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  // Swagger UI est desactive par defaut (surface d'API non exposee en
  // production) ; SWAGGER_ENABLED=true l'active (dev local, demo).
  const swaggerActif = config.get<string>('SWAGGER_ENABLED', 'false') === 'true';

  // En-tetes de securite HTTP. `X-Content-Type-Options: nosniff` est le plus
  // utile ici : GET /photos/:id sert des fichiers deposes par des utilisateurs.
  // Swagger UI a besoin de scripts/styles inline et de http en local : la CSP
  // par defaut de helmet est assouplie uniquement quand il est actif.
  if (swaggerActif) {
    // `null` (et non `delete`) : helmet refusionne sinon les directives par defaut.
    const directives: Record<string, string[] | null> = {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'upgrade-insecure-requests': null,
      'script-src': ["'self'", "'unsafe-inline'"],
      'style-src': ["'self'", 'https:', "'unsafe-inline'"],
    };
    app.use(helmet({ contentSecurityPolicy: { directives } }));
  } else {
    app.use(helmet());
  }

  const corsOrigins = config
    .get<string>('CORS_ORIGIN', 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({ origin: corsOrigins });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (swaggerActif) {
    const document = SwaggerModule.createDocument(app, configOpenApi());
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
await bootstrap();
