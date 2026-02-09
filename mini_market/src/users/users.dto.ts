import { IsString, IsInt, MinLength, IsNotEmpty, isNotEmpty, IsEnum, isInt } from "class-validator";
import { UserRole } from "./users.entity";

export class CreateUserDTO {
    @IsString({message: "Имя должно быть строкой!"})
    @MinLength(3, {message: "Слишком короткое имя!"})
    @IsNotEmpty({message: "Поле имени не должно быть пустым!"})
    name: string;

    @IsString({message: "Пароль должен быть строкой!"})
    @MinLength(6, {message: "Пароль должен быть длиной не меньше 6 символов!"})
    @IsNotEmpty({message: "Поле пароля не должно быть пустым!"})
    password: string;
}

export class UpdateRoleDTO {
    @IsEnum(UserRole, {message: "Доступны только роли 'admin' или 'user'!"})
    role: UserRole;
}
