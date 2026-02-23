import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/products/products.entity";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { Order, OrderItem } from "./order.entity";
import { BullModule } from "@nestjs/bull";
import { OrderProcessor } from "./order.processor";
import { Wallet, Transaction } from "src/payment/payment.entity";

import { User } from "src/users/users.entity";


@Module({
    imports: [TypeOrmModule.forFeature([Product, Order, OrderItem, Wallet, Transaction, User]),  
    BullModule.registerQueue({name: 'order-expiration',}), 
    ],
    controllers: [OrderController],
    providers: [OrderService, OrderProcessor],
    exports: [OrderService]
})

export class OrderModule {}