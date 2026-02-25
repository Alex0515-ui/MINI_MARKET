import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { WalletService } from "./payment.service";
import { JwtGuard } from "src/common/guards.guard";
import { TransactionFilterDTO, WalletDTO } from "./payment.dto";
import { UserService } from "src/users/users.service";
import { AdminAuth } from "src/auth/auth.dto";
import { DataInterceptor, ExcludeNullInterceptor } from "src/common/interceptors";

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
    @UseInterceptors(ExcludeNullInterceptor)
    @UseInterceptors(DataInterceptor)
    @UseGuards(JwtGuard)
    check_wallet(@Req() req) {
        return this.user_service.check_wallet_balance(req.user.id)
    }

    @Get(':id/find')
    @UseInterceptors(ExcludeNullInterceptor)
    @UseInterceptors(DataInterceptor)
    @AdminAuth()
    find_wallet(@Param('id', ParseIntPipe) id: number) {
        return this.wallet_service.get_user_wallet(id)
    }

    @Get('transactions')
    @UseInterceptors(DataInterceptor)
    @UseGuards(JwtGuard)
    get_transactions(@Req() req, @Query() dto: TransactionFilterDTO) {
        return this.wallet_service.get_all_transactions(req.user.id, dto)
    }

    @Get('admin/stats')
    @AdminAuth()
    get_stats(@Req() req) {
        return this.wallet_service.get_admin_stats(req.user.id)
    }
}