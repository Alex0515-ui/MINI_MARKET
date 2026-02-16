import { forwardRef, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {

    constructor(
                @Inject(forwardRef(() => UserService))
                private readonly user_service: UserService,
                private readonly jwt_service: JwtService
    ) {}

    async login(name:string, password: string): Promise<any> {
        const user = await this.user_service.getUserByName(name)
        const passwords_match = await this.user_service.comparePasswords(password, user.password)
        
        if (!passwords_match) {
            throw new UnauthorizedException("Неверный пароль!")
        }
        const payload = {sub: user.id, username: user.name, role: user.role} // <== Сами данные

        const secret = await this.jwt_service.signAsync(payload) // <== Генерация токена с надежным шифрованием

        return {
            access_token : secret
        }
        
    }
}
