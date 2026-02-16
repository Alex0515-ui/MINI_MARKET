import { forwardRef, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/users/users.entity';
import jwtConfig from './jwt.config';
import { UsersModule } from 'src/users/users.module';
import { UserService } from 'src/users/users.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.registerAsync({
    imports: [ConfigModule.forFeature(jwtConfig)], // Регаем конфиг
    inject: [jwtConfig.KEY], // Ключ конфига
    global: true, // <== Чтобы не было лишних импортов
    useFactory: (config: ConfigType<typeof jwtConfig>) => ({ // Берет данные конфига асинхронно
      secret: config.secret,
      signOptions: config.signOptions
    }),
  }), 
  TypeOrmModule.forFeature([User]),
  forwardRef(() => UsersModule), 
  ConfigModule.forFeature(jwtConfig)
  ],

  controllers: [AuthController],
  providers: [AuthService, UserService, JwtStrategy]
})

export class AuthModule {}
