import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsPositive, Min } from "class-validator";

export class PaginationDTO {
    @IsOptional()
    // @IsPositive()
    // @IsNumber()
    limit: number

    @IsOptional()
    // @Min(0)
    // @IsNumber()
    offset: number;
}

export class ValueFilterDTO extends PaginationDTO {
    @IsOptional()
    // @IsPositive()
    // @IsNumber()
    minValue: number;

    @IsOptional()
    // @IsPositive()
    // @IsNumber()
    maxValue: number;
}

