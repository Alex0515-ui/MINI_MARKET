import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { Wallet, Transaction, TRANSACTION_TYPE } from "./payment.entity";
import { InjectRepository } from "@nestjs/typeorm";

@Injectable()
export class WalletService {

    constructor(
        @InjectRepository(Wallet)
        private wallet_rep: Repository<Wallet>,
        private dataSource: DataSource // Для гибкого управления в ORM
    ) {}

    // Пополнение кошелька
    async fill_wallet(user_id: number, amount: number) {
        const wallet = await this.wallet_rep.findOne({where: {user: {id: user_id}}}) // Поиск кошелька
        if (!wallet) throw new NotFoundException("Такого кошелька нету")

        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect()
        await queryRunner.startTransaction()

        try {
            wallet.balance = Number(wallet.balance) + amount; // Пополнение кошелька
            await queryRunner.manager.save(wallet);

            const transaction = queryRunner.manager.create(Transaction, { // Создание транзакции
                wallet: wallet, 
                amount: amount, 
                type: TRANSACTION_TYPE.REFILLING
            })
            await queryRunner.manager.save(transaction)

            await queryRunner.commitTransaction()
            return {"message": `Вы успешно пополнили кошелек на сумму: ${amount} тг!`}
        }
        catch(e) {
            await queryRunner.rollbackTransaction();
            throw new InternalServerErrorException("Произошла ошибка при исполнении")
        }
        finally {
            await queryRunner.release();
        }
    }


    // Вывод средств с кошелька
    async withdrawal(user_id: number, amount: number) {
        const wallet = await this.wallet_rep.findOne({where: {user: {id: user_id}}}) // Поиск
        if (!wallet) throw new NotFoundException("Такого кошелька нету!")
        if (wallet.balance < amount) throw new BadRequestException(`Можно вывести максимум: ${wallet.balance} тг`)

        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            wallet.balance = Number(wallet.balance) - amount // Снимаем деньги с кошелька
            await queryRunner.manager.save(wallet)

            const transaction = queryRunner.manager.create(Transaction, { // Создаем транзакцию
                wallet: wallet,
                amount: amount,
                type: TRANSACTION_TYPE.WITHDRAWAL
            })
            await queryRunner.manager.save(transaction);

            await queryRunner.commitTransaction();
            return {"message" : `Сумма: ${amount} тг была успешно выведена!`}

        }
        catch(e) {
            await queryRunner.rollbackTransaction();
            throw new InternalServerErrorException("Ошибка при исполнении")
        }
        finally {
            await queryRunner.release();
        }
    }
}
