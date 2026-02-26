import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from "class-validator";
import { ValueFilterDTO } from "src/common/pagination.dto";
import { TRANSACTION_TYPE } from "./payment.entity";

export class WalletDTO { 
    @IsNumber()
    @IsNotEmpty({message: "Нужно ввести сумму!"})
    amount: number
}

export class TransactionFilterDTO extends ValueFilterDTO {  // Фильтрация и пагинация транзакций
    @IsOptional()
    @IsEnum(TRANSACTION_TYPE)
    type?: TRANSACTION_TYPE;

    @IsOptional()
    @IsNumber()
    user_id: number
}

export type product_stat = {id: number, count: number} // Для админ статистики