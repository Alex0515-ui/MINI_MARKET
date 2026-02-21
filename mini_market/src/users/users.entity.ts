import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Wallet } from "../payment/payment.entity";
import { Product } from "src/products/products.entity";

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
    
    @Column({ select: false }) // Пароль будет скрыт! 
    password: string;

    @Column({type:'enum', enum: UserRole, default:UserRole.USER})
    role: UserRole;

    @OneToOne(() => Wallet, (wallet) => wallet.user)
    @JoinColumn()
    wallet: Wallet

    @OneToMany(() => Product, (product) => product.creator)
    products: Product[];
}


