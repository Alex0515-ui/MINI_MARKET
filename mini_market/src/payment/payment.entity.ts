import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../users/users.entity";

export enum TRANSACTION_TYPE { // Виды транзакции
    REFILLING = "Пополнение",
    PAYMENT = "Оплата",
    WITHDRAWAL = "Вывод"
}

@Entity()
export class Wallet { // Кошелек пользователя
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(() => User, (user) => user.wallet)
    @JoinColumn()
    user: User;

    @Column({type: 'decimal', precision: 12, scale: 2, default: 0})
    balance: number
}

@Entity()
export class Transaction { // Сущность транзакции
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Wallet)
    wallet: Wallet;

    @Column({type:'decimal', precision: 12, scale: 2})
    amount: number;

    @Column({type: 'enum', enum: TRANSACTION_TYPE})
    type: TRANSACTION_TYPE

    @CreateDateColumn()
    created_at: Date;
}

