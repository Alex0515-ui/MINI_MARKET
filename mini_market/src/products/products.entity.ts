import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Product { // Модель сущности продукта в БД
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column()
    description: string;

    @Column()
    image: string;

    @Column('decimal')
    price: number;
}