import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { StockageModule } from './infrastructure/stockage/stockage.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UtilisateursModule } from './modules/utilisateurs/utilisateurs.module.js';
import { InterventionsModule } from './modules/interventions/interventions.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    StockageModule,
    AuthModule,
    UtilisateursModule,
    InterventionsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
