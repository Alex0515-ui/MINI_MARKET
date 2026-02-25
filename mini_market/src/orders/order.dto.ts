import { IsArray, IsEnum, IsOptional } from "class-validator";
import { Status } from "./order.entity";
import { PaginationDTO, ValueFilterDTO } from "src/common/pagination.dto";

export class CreateOrderDTO { // DTO корзины заказа
    @IsArray()
    basket: {product_id: number; quantity: number}[];
}

export interface OrderExpirationPayload {
    orderId: number
}

export class OrderFilterDTO extends ValueFilterDTO {
    @IsOptional()
    @IsEnum(Status)
    status?: Status
}