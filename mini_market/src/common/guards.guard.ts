import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/auth/auth.dto';

@Injectable()
export class JwtGuard extends AuthGuard("jwt") {} // JWT Guard


@Injectable()
export class RoleGuard implements CanActivate { // Guard для авторизации
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const roles = this.reflector.get(Roles, context.getHandler());

        if (!roles) return true; // Если нету требуемой роли, пропускаем

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) return false;

        return roles.includes(user.role)
    }
    
}