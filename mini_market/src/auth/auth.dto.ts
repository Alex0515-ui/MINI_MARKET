import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IsNotEmpty, IsString, MinLength } from "class-validator";
import { UserRole } from "src/users/users.entity";
import { JwtGuard, RoleGuard } from "./guards/guards.guard";

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

export const Role = Reflector.createDecorator<string>() // Декоратор для роли

export const AdminAuth = () => applyDecorators( // Укорачиваем декораторы, для чистого кода
    UseGuards(JwtGuard, RoleGuard),
    Role('admin')   
);




