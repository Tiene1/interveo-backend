import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Configuration commune du document OpenAPI.
 * Utilisee par main.ts (UI /docs) et par openapi.ts (export du fichier).
 */
export function configOpenApi() {
  return new DocumentBuilder()
    .setTitle('API Interveo')
    .setDescription(
      [
        'Suivi des interventions techniques pour PME du batiment (electricite, securite electronique, domotique...).',
        '',
        "Authentification par jeton JWT (Bearer). Recuperer un jeton via POST /auth/login,",
        'puis cliquer sur « Authorize » et le coller.',
        '',
        'Roles : DIRECTEUR (back-office) et TECHNICIEN (application mobile, synchronisation).',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();
}
