import { applyDecorators, UseGuards } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IsNotEmpty, IsString, MinLength } from "class-validator";
import { UserRole } from "src/users/users.entity";
import { JwtGuard, RoleGuard } from "../common/guards.guard";

export class LoginDTO { // Тип данных для логина

    @IsString({message: "Имя должно быть строкой!"})
    @IsNotEmpty({message: "Имя не должно быть пустым!"})
    name: string;

    @IsString({message: "Пароль должен быть строкой!"})
    @IsNotEmpty({message: "Пароль не должен быть пустым!"})
    password: string;
}

export type AuthPayload = { // Тип данных для полезной нагрузки в аутентификации
    sub: number,
    username: string,
    role: string
}

export const Roles = Reflector.createDecorator<UserRole[]>()

export const AdminAuth = () => applyDecorators( // Укорачиваем декораторы, для чистого кода
    UseGuards(JwtGuard, RoleGuard),
    Roles([UserRole.ADMIN])   
);

export const SellerAuth = () => applyDecorators(
    UseGuards(JwtGuard, RoleGuard),
    Roles([UserRole.SELLER, UserRole.ADMIN])
)



