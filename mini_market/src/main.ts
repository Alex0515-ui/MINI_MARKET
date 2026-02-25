import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { MyGlobalExceptionFilter } from './common/exception.filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({ // Валидация
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {enableImplicitConversion: true},
    transform: true,
  }));

  app.useGlobalFilters(new MyGlobalExceptionFilter()) // Глобальный кастомный Фильтр ошибок

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)))
  const config = new DocumentBuilder() // Swagger документация для API 
  .setTitle('My Mini Market')
  .setDescription('API Documentation for my project')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
  
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();




