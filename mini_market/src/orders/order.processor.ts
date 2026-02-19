import { Process, Processor } from "@nestjs/bull";
import type { Job } from "bull";
import { OrderService } from "./order.service";
import { OrderExpirationPayload } from "./order.dto";

@Processor('order-expiration')
export class OrderProcessor{ // Класс для удаления заказов в долгом ожидании
    constructor(private readonly order_service: OrderService) {}

    @Process('check-expiration')
    async process(job: Job<OrderExpirationPayload>) { // Процесс удаления
        const {orderId} = job.data;
        await this.order_service.cancelExpiredOrder(orderId)
    }

}