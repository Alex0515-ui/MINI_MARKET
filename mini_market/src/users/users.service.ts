import { ConflictException, forwardRef, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CreateUserDTO } from "./users.dto";
import { UpdateRoleDTO } from "./users.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { User, UserRole } from "./users.entity";
import { Repository } from "typeorm";
import * as bcrypt from 'bcrypt'
import { AuthService } from "src/auth/auth.service";
import { Wallet } from "src/payment/payment.entity";

@Injectable()
export class UserService {

    constructor(
        @InjectRepository(User)
        @Inject(forwardRef(() => AuthService))
        private readonly repo: Repository<User>, // Обращения будущие к таблице Users в БД
        @InjectRepository(Wallet)
        private readonly wallet: Repository<Wallet>

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
        
        const user = this.repo.create({name: dto.name, password: hashed_password, role: UserRole.USER})
    
        const saved = await this.repo.save(user);
        const wallet = this.wallet.create({balance: 0, user: user});
        await this.wallet.save(wallet)

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

    // Получение пользователя по имени (Для аутентификации)
    async getUserByName(name: string): Promise<User> {
        const user = await this.repo.findOne({where: {name}, select: ['id', 'name', 'password', 'role']})
        if (!user) {
            throw new NotFoundException("Пользователя с таким именем нету!")
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

    // Проверка кошелька
    async check_wallet_balance(user_id: number) {
        const wallet = await this.wallet.findOne({where: {user: {id: user_id}}})
        if (!wallet) {
            throw new NotFoundException("Кошелек не найден!")
        }
        return wallet.balance;
    }
}

