import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { Role } from '../auth.dto';

@Injectable()
export class JwtGuard extends AuthGuard("jwt") {} // JWT Guard

@Injectable()
export class RoleGuard implements CanActivate { // Guard для авторизации
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const role = this.reflector.get(Role, context.getHandler());

        if (!role) return true; // Если нету требуемой роли, пропускаем

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) return false;

        console.log('User role from JWT:', user.role);
        console.log('Role required by decorator:', role);
        return user.role == role
    }
    
}