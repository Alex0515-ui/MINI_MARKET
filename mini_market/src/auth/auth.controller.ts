import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDTO } from './auth.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly auth_service: AuthService) {} 
   
    @Post('login')
    async login(@Body() dto: LoginDTO) {
        const token = await this.auth_service.login(dto.name, dto.password)
        return token
    }

}
