import { IsArray } from "class-validator";

export class CreateOrderDTO { // DTO корзины заказа
    @IsArray()
    basket: {product_id: number; quantity: number}[];
}

export interface OrderExpirationPayload {
    orderId: number
}

