import { Product } from "src/products/products.entity";
import { Column, 
    CreateDateColumn, 
    Entity, 
    ManyToOne,
    OneToMany, 
    PrimaryGeneratedColumn} from "typeorm";

import * as dayjs from 'dayjs'
import { Transform } from "class-transformer";

export enum Status { // Виды статуса заказа
    PENDING = "В ожидании",    
    SHIPPED = "Отправлено",
    COMPLETED = "Завершено",
    CANCELLED = "Отменено"
}

@Entity()
export class Order { // Сущность заказа
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    amount: string;

    @CreateDateColumn()
    created_at: Date;

    @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {cascade: true}) // Связь с товаром
    items: OrderItem[];

    @Column({ type: 'enum', enum: Status, default: Status.PENDING})
    status: Status;

}

@Entity()
export class OrderItem { // Сущность товара в заказе
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Order, (order) => order.items) // Связь товара с заказом
    order: Order

    @ManyToOne(() => Product)
    product: Product

    @Column()
    quantity: number;

    @Column({type: 'decimal', precision: 10, scale: 2}) // Макс. число: 99999999.99
    purchase_price: number; // Цена может менятся со временем

}

