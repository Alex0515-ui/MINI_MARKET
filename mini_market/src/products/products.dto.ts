import { IsInt, IsNotEmpty, IsNumber, IsString } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreateProductDTO { // Тип создания продукта

    @IsString({message: "Название должно быть строкой!"})
    @IsNotEmpty({message: "Необходимо ввести название продукта!"})
    title: string;

    @IsString({message: "Описание должно быть в строковом виде!"})
    @IsNotEmpty({message: "Необходимо ввести описание продукта!"})
    description: string;

    @IsString({message: "Нужно вставить URL картинки в виде строки!"})
    @IsNotEmpty({message: "Необходимо ввести URL картинки!"})
    image: string;

    @IsNumber()
    @IsNotEmpty({message: "Необходимо ввести цену товара!"})
    price: number;

    @IsInt({message: "Количество товаров должно быть числом"})
    @IsNotEmpty({message: "Необходимо ввести количество товара на складе!"})
    count: number;
}

// Тип редактирования продукта
export class UpdateProductDTO extends PartialType(CreateProductDTO) {}