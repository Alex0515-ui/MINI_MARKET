import { IsInt, IsNotEmpty, IsString } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreateProductDTO { // Тип создания прожукта

    @IsString({message: "Название должно быть строкой!"})
    @IsNotEmpty({message: "Необходимо ввести название продукта!"})
    title: string;

    @IsString({message: "Описание должно быть в строковом виде!"})
    @IsNotEmpty({message: "Необходимо ввести описание продукта!"})
    description: string;

    @IsString({message: "Нужно вставить URL картинки в виде строки!"})
    @IsNotEmpty({message: "Необходимо ввести URL картинки!"})
    image: string;

    @IsInt({message: "Цена должно быть строкой!"})
    @IsNotEmpty({message: "Необходимо ввести цену товара!"})
    price: number;

}

// Тип редактирования продукта
export class UpdateProductDTO extends PartialType(CreateProductDTO) {}