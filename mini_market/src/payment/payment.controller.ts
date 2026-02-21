import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import { WalletService } from "./payment.service";
import { JwtGuard } from "src/auth/guards/guards.guard";
import { WalletDTO } from "./payment.dto";
import { UserService } from "src/users/users.service";

@Controller('wallet')
export class PaymentController {
    
    constructor (private readonly wallet_service: WalletService,
        private user_service: UserService
    ) {}

    @Patch('fill')
    @UseGuards(JwtGuard)
    fill_wallet(@Body() dto: WalletDTO, @Req() req) {
        return this.wallet_service.fill_wallet(req.user.id, dto.amount)
    }

    @Patch("withdraw")
    @UseGuards(JwtGuard)
    withdraw_wallet(@Body() dto: WalletDTO, @Req() req) {
        return this.wallet_service.withdrawal(req.user.id, dto.amount)
    }

    @Get("my")
    @UseGuards(JwtGuard)
    check_wallet(@Req() req) {
        return this.user_service.check_wallet_balance(req.user.id)
    }

}