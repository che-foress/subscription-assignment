import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, ObserveInstrument } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Enable CORS for frontend client access
  app.enableCors();

  // 1. Enable Global Input Validation Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 2. Build Swagger Documentation Configuration
  const config = new DocumentBuilder()
    .setTitle('Subscription & Payment Reminder API')
    .setDescription(
      'Backend API layout managing automated billing notifications and subscription structures.',
    )
    .setVersion('1.0')
    .addTag('subscriptions', 'Endpoints for managing user subscriptions')
    .addTag('reminders', 'Endpoints for managing reminder notifications and logs')
    .addTag('health', 'Health check and service status')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // 3. Setup Swagger UI route dashboard
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Subscription API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      displayRequestDuration: true,
    },
  });

  // 4. Start the Application Server
  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on port ${port} (docs at /api)`);
}
void bootstrap();
