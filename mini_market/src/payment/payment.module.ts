import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Transaction, Wallet } from "./payment.entity";
import { PaymentController } from "./payment.controller";
import { WalletService } from "./payment.service";
import { UsersModule } from "src/users/users.module";

@Module({
    imports: [TypeOrmModule.forFeature([Wallet, Transaction]), 
    
    forwardRef(() => UsersModule)  
    ],
    controllers: [PaymentController],
    providers: [WalletService],
    exports: [WalletService]
})

export class PaymentModule {}