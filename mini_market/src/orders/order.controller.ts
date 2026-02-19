import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtGuard } from "src/auth/guards/guards.guard";
import { AdminAuth } from "src/auth/auth.dto";
import { OrderService } from "./order.service";
import { CreateOrderDTO } from "./order.dto";

@Controller('orders')
export class OrderController {

    constructor(
        private readonly order_service: OrderService
    ) {}

    @Get('my')
    @UseGuards(JwtGuard) // Получение всех своих заказов
    async get_my_orders(@Req() req) {
        return this.order_service.get_my_orders(req.user.id)
    }

    @Get(':id')
    @UseGuards(JwtGuard) // Получение заказа пользователем
    async get_my_order(@Param('id', ParseIntPipe) orderId: number, @Req() req) {
        return this.order_service.get_my_order(orderId, req.user.id)
    }

    @Get(':id/admin')
    @AdminAuth() // Получение заказа админом
    async get_order(@Param('id', ParseIntPipe) orderId: number) {
        return this.order_service.get_order(orderId)
    }

    @Post('create')
    @UseGuards(JwtGuard) // Создание заказа
    async createOrder(@Body() dto: CreateOrderDTO, @Req() req) {
        return this.order_service.createOrderCheckout(req.user.id, dto)
    }

    @Patch(':id/confirm')
    @AdminAuth() // Отправка заказа
    async confirmOrder(@Param('id', ParseIntPipe) orderId: number) {
        return this.order_service.confirmOrder(orderId)
    }

    @Patch(':id/complete')
    @AdminAuth() // Завершение заказа админом
    async completeOrder(@Param('id', ParseIntPipe) orderId: number) {
        return this.order_service.completeOrder(orderId)
    }

    @Patch(':id/admin/cancel')
    @AdminAuth() // Отмена заказа админом
    async cancelOrder(@Param('id', ParseIntPipe) orderId: number) {
        return this.order_service.cancelOrder(orderId)
    }

    @Patch(':id/cancel')
    @UseGuards(JwtGuard) // Отмена заказа пользователем
    async cancelOwnOrder(@Param('id', ParseIntPipe) orderId: number, @Req() req) {
        return this.order_service.userCancelOrder(orderId, req.user.id);
    }
}