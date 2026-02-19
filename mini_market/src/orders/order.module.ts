import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "src/products/products.entity";
import { AuthModule } from "src/auth/auth.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { Order, OrderItem } from "./order.entity";
import { BullModule } from "@nestjs/bull";
import { OrderProcessor } from "./order.processor";


@Module({
    imports: [TypeOrmModule.forFeature([Product, Order, OrderItem]),  
    BullModule.registerQueue({name: 'order-expiration',}), 
    AuthModule],
    controllers: [OrderController],
    providers: [OrderService, OrderProcessor],
    exports: [OrderService]
})

export class OrderModule {}