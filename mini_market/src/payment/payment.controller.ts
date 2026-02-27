import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { WalletService } from "./payment.service";
import { JwtGuard } from "src/common/guards.guard";
import { TransactionFilterDTO, WalletDTO } from "./payment.dto";
import { UserService } from "src/users/users.service";
import { AdminAuth, SellerAuth } from "src/auth/auth.dto";
import { DataInterceptor, ExcludeNullInterceptor } from "src/common/interceptors";

@Controller('wallet')
export class PaymentController {
    
    constructor (private readonly wallet_service: WalletService,
    ) {}

    @Patch('fill')
    @UseGuards(JwtGuard)                                // Пополнение кошелька
    fill_wallet(@Body() dto: WalletDTO, @Req() req) {
        return this.wallet_service.fill_wallet(req.user.id, dto.amount)
    }

    @Patch("withdraw")
    @UseGuards(JwtGuard)                                // Снятие с кошелька
    withdraw_wallet(@Body() dto: WalletDTO, @Req() req) {
        return this.wallet_service.withdrawal(req.user.id, dto.amount)
    }

    @Get("my")                                          // Проверка баланса кошелька
    @UseInterceptors(ExcludeNullInterceptor)
    @UseInterceptors(DataInterceptor)
    @UseGuards(JwtGuard)
    check_wallet(@Req() req) {
        return this.wallet_service.check_wallet_balance(req.user.id)
    }

    @Get(':id/find')                                    // Получение кошелька админом
    @UseInterceptors(ExcludeNullInterceptor)
    @UseInterceptors(DataInterceptor)
    @AdminAuth()
    find_wallet(@Param('id', ParseIntPipe) id: number) {
        return this.wallet_service.get_user_wallet(id)
    }

    @Get('transactions')                                // Получение всех своих транзакций
    @UseInterceptors(DataInterceptor)
    @UseGuards(JwtGuard)
    get_transactions(@Req() req, @Query() dto: TransactionFilterDTO) {
        return this.wallet_service.get_my_transactions(req.user.id, dto)
    }

    @Get('transactions/all')                            // Получение всех транзакций на платформе админом
    @UseInterceptors(DataInterceptor)
    @AdminAuth()
    get_all_transactions(@Query() dto: TransactionFilterDTO) {
        return this.wallet_service.get_all_transactions(dto)
    }

    @Get('seller/stats')                                // Получение статистики продавца
    @SellerAuth()
    get_stats(@Req() req) {
        return this.wallet_service.get_seller_stats(req.user.id)
    }

    @Get('admin')
    @AdminAuth()                                        // Получение кошелька, куда идет комиссия
    get_admin_wallet() {
        return this.wallet_service.get_wallet_admin()
    }

    @Get('transactions/admin')
    @AdminAuth()                                        // Получение комиссионных транзакций
    get_admin_transactions(@Query() dto: TransactionFilterDTO) {
        return this.wallet_service.get_transactions_admin(dto)
    }
}