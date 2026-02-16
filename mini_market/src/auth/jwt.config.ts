import { JwtModuleOptions } from "@nestjs/jwt";
import { registerAs } from "@nestjs/config";

// Безопасное получение секретного ключа и времени истечения токена из .env
export default registerAs(
    'jwt', 
    (): JwtModuleOptions => ({
    secret: process.env.JWT_SECRET_KEY || "DEV_SECRET_KEY_123",
    signOptions: {
        expiresIn: process.env.JWT_EXPIRE_IN as any|| "3600s"
    },
}),
);