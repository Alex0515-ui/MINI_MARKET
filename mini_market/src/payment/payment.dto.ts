import { IsNotEmpty, IsNumber } from "class-validator";

export class WalletDTO {
    @IsNumber()
    @IsNotEmpty({message: "Нужно ввести сумму!"})
    amount: number
}