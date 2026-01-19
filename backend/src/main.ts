import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { VALIDATION_PIPE_OPTIONS } from './common/pipes/validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.enableCors({
    origin: configService.get<string>('app.frontendUrl', 'http://localhost:3001'),
    credentials: true,
  });
  // Also set explicitly (not just via APP_PIPE) so pipes apply to anything
  // resolved outside the DI-registered pipeline.
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Swiply API')
    .setDescription('AI social media manager — dashboard and public Developer API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'Authorization', in: 'header' }, 'developer-api-key')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  logger.log(`Swiply backend listening on http://localhost:${port}/api`);
  logger.log(`API docs at http://localhost:${port}/api/docs`);
}

void bootstrap();
