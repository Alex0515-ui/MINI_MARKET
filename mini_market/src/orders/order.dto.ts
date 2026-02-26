import { IsArray, IsEnum, IsOptional } from "class-validator";
import { Status } from "./order.entity";
import { ValueFilterDTO } from "src/common/pagination.dto";

export class CreateOrderDTO { // DTO корзины заказа
    @IsArray()
    basket: {product_id: number; quantity: number}[];
}

export class OrderFilterDTO extends ValueFilterDTO { // Фильтр и пагинация для заказов
    @IsOptional()
    @IsEnum(Status)
    status?: Status
}