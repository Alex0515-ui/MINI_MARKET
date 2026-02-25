import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transaction, Wallet } from "./payment.entity";
import { PaymentController } from "./payment.controller";
import { WalletService } from "./payment.service";
import { UsersModule } from "src/users/users.module";
import { OrderModule } from "src/orders/order.module";
import { Order } from "src/orders/order.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Wallet, Transaction, Order]), 
    
    forwardRef(() => UsersModule),
    ],
    controllers: [PaymentController],
    providers: [WalletService],
    exports: [WalletService]
})

export class PaymentModule {}