import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CreateUserDTO } from "./users.dto";
import { UpdateRoleDTO } from "./users.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { User, UserRole } from "./users.entity";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt'

@Injectable()
export class UserService {

    constructor(
        @InjectRepository(User)
        private readonly repo: Repository<User> // Обращения будущие к таблице Users в БД
    ) {}

    // Хэширование пароля
    async hashPassword(password: string) { 
        const salt = 10
        return await bcrypt.hash(password, salt)
    }

    // Сравнение паролей
    async comparePasswords(password: string, hash: string): Promise<boolean> { 
        return await bcrypt.compare(password, hash)
    }

    // Создание пользователя (регистрация)
    async createUser(dto:CreateUserDTO): Promise<User> { 
        const user_exists = await this.repo.findOne({where: {name:dto.name}});
        const hashed_password = await this.hashPassword(dto.password);

        if (user_exists) {
            throw new ConflictException('Пользователь с таким именем уже существует!')
        }

        const user = this.repo.create({...dto, password: hashed_password})
        const saved = await this.repo.save(user);

        return saved
    }

    // Получение пользователя
    async getUser(id: number): Promise<User> { 
        const user = await this.repo.findOne({ where: {id} })
        if (!user) {
            throw new NotFoundException("Пользователь с таким ID не существует!")
        }
        return user
    }

    // Обновление роли
    async updateRole(id:number, role: UserRole): Promise<User> { 
        const user = await this.getUser(id)
        user.role = role
        return await this.repo.save(user)
    }

    // Удаление пользователя
    async deleteUser(id:number): Promise<any> { 
        const user = await this.getUser(id)
        await this.repo.remove(user)
        return {"message": "Пользователь был успешно удален!"}
    }
}

