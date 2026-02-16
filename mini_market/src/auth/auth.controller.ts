import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtGuard } from './guards/guards.guard';
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
