import { User } from "src/users/users.entity";
import { Column, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

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

    @Column({select: false})
    count: number;

    @ManyToOne(() => User)
    @JoinColumn({name: "creator_id"})
    creator: User;

    @DeleteDateColumn()
    deletedAt?: Date;
}