import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { configOpenApi } from './openapi.config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
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

  const document = SwaggerModule.createDocument(app, configOpenApi());
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
await bootstrap();
