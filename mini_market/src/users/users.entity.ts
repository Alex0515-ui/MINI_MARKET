import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum UserRole { // Только две роли пока что
    USER = "user",
    ADMIN = "admin"
}

@Entity()
export class User { // Модель таблицы сущности пользователя
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;
    
    @Column({select: false}) // <-- Пароль нельзя получить 
    password: string;

    @Column({type:'enum', enum: UserRole, default:UserRole.USER})
    role: UserRole;
}