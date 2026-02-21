import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Request, UseGuards } from "@nestjs/common";
import { UserService } from "./users.service";
import { CreateUserDTO, UpdateRoleDTO } from "./users.dto";
import { AdminAuth } from "src/auth/auth.dto";
import { JwtGuard } from "src/auth/guards/guards.guard";


@Controller('users')
export class UserContrroller {

    constructor(private readonly user_service: UserService) {}

    @Post() // Создание (Регистрация)
    register(@Body() dto: CreateUserDTO) {
        return this.user_service.createUser(dto)
    }

    @AdminAuth()
    @Get(':id') // Получение пользователя
    findUser(@Param('id', ParseIntPipe) id: number) {
        return this.user_service.getUser(id)
    }

    @AdminAuth()
    @Patch(':id/role') // Изменение роли пользователя
    updateRole(
        @Param('id', ParseIntPipe   ) id: number,
        @Body() dto: UpdateRoleDTO
    ) {
        return this.user_service.updateRole(id, dto.role);
    }

    @AdminAuth()
    @Delete(':id') // Удаление пользователя
    removeUser(@Param('id', ParseIntPipe) id: number) {
        return this.user_service.deleteUser(id)
    }


    
}