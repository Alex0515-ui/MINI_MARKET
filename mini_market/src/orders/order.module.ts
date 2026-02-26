import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/products/products.entity";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { Order, OrderItem } from "./order.entity";
import { Wallet, Transaction } from "src/payment/payment.entity";
import { User } from "src/users/users.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Product, Order, OrderItem, Wallet, Transaction, User])],
    controllers: [OrderController],
    providers: [OrderService],
    exports: [OrderService]
})

export class OrderModule {}