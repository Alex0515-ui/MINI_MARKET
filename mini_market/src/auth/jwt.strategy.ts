import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import jwtConfig from "./jwt.config";
import type { ConfigType } from "@nestjs/config";
import { Inject, Injectable } from "@nestjs/common";
import { AuthPayload } from "./auth.dto";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        @Inject(jwtConfig.KEY)
        private jwtConfiguration: ConfigType<typeof jwtConfig> // Делаем "инъекцию" конфига jwt
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Достаем токен из заголовка запроса
            secretOrKey: jwtConfiguration.secret as string, // Секретный ключ
        }); 
    }

    // Обязательный метод для получения полезной нагрузки
    async validate(payload: AuthPayload) {
        return {id: payload.sub, name: payload.username, role: payload.role}
    }
}