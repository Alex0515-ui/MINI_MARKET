import { forwardRef, Module } from "@nestjs/common";
import { UserContrroller } from "./users.controller";
import { UserService } from "./users.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "./users.entity";
import { AuthModule } from "src/auth/auth.module";
import { Wallet, Transaction } from "../payment/payment.entity";

@Module({
    imports: [TypeOrmModule.forFeature([User, Wallet, Transaction]), forwardRef(() => AuthModule) ],
    controllers: [UserContrroller],
    providers: [UserService],
    exports: [UserService]
})

export class UsersModule {}

    
