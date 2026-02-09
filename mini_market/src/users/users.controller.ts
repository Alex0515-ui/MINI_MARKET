import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { UserService } from "./users.service";
import { CreateUserDTO, UpdateRoleDTO } from "./users.dto";

@Controller('users')
export class UserContrroller {

    constructor(private readonly user_service: UserService) {}

    @Post() // Создание (Регистрация)
    register(@Body() dto: CreateUserDTO) {
        return this.user_service.createUser(dto)
    }

    @Get(':id') // Получение пользователя
    findUser(@Param('id', ParseIntPipe) id: number) {
        return this.user_service.getUser(id)
    }

    @Patch(':id/role') // Изменение роли пользователя
    updateRole(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateRoleDTO
    ) {
        return this.user_service.updateRole(id, dto.role);
    }

    @Delete(':id') // Удаление пользователя
    removeUser(@Param('id', ParseIntPipe) id: number) {
        return this.user_service.deleteUser(id)
    }

}