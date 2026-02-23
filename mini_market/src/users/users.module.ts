import { Module } from "@nestjs/common";
import { UserContrroller } from "./users.controller";
import { UserService } from "./users.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./users.entity";
import { Wallet, Transaction } from "../payment/payment.entity";

@Module({
    imports: [TypeOrmModule.forFeature([User, Wallet, Transaction])],
    controllers: [UserContrroller],
    providers: [UserService],
    exports: [UserService]
})

export class UsersModule {}

    
