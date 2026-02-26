import { IsNumber, IsOptional, IsPositive, Min } from "class-validator";

export class PaginationDTO { // ДТО пагинации
    @IsOptional()
    @IsPositive()
    @IsNumber()
    limit: number

    @IsOptional()
    @Min(0)
    @IsNumber()
    offset: number;
}

export class ValueFilterDTO extends PaginationDTO { // Базовый фильтр по численным значениям
    @IsOptional()
    @IsPositive()
    @IsNumber()
    minValue: number;

    @IsOptional()
    @IsPositive()
    @IsNumber()
    maxValue: number;
}

