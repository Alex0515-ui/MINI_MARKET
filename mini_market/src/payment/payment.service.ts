import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { DataSource, Repository } from "typeorm";
import { Wallet, Transaction, TRANSACTION_TYPE } from "./payment.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { product_stat, TransactionFilterDTO } from "./payment.dto";
import { Order, Status } from "src/orders/order.entity";

@Injectable()
export class WalletService {

    constructor(
        @InjectRepository(Wallet)
        private wallet_rep: Repository<Wallet>,
        @InjectRepository(Transaction)
        private trans_rep: Repository<Transaction>,
        @InjectRepository(Order)
        private order_rep: Repository<Order>,
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
    // Проверка кошелька
    async check_wallet_balance(user_id: number) {
        const wallet = await this.wallet_rep.findOne({where: {user: {id: user_id}}})
        if (!wallet) {
            throw new NotFoundException("Кошелек не найден!")
        }
        return {
            balance: wallet.balance
        };
    }

    // Проверка собственного кошелька
    async get_user_wallet(id: number) {
        const wallet = await this.wallet_rep.findOne({where: {id}, relations: ['user']})
        if (!wallet) throw new NotFoundException("Такого кошелька нету")

        return {"wallet_id": wallet.id, "balance": wallet.balance}
    }

    // Получение всех своих транзакций (Пагинация/Фильтрация)
    async get_my_transactions(user_id: number, dto: TransactionFilterDTO) {
        const {limit = 10, offset = 0, minValue, maxValue, type} = dto

        const transaction_query = this.trans_rep.createQueryBuilder('trans')
        .leftJoin('trans.wallet', 'wallet')
        .leftJoin('wallet.user', 'user')
        .where('user.id = :user_id', {user_id})

        if (minValue) {
            transaction_query.andWhere('trans.amount >= :minValue', {minValue})
        }
        if (maxValue) {
            transaction_query.andWhere('trans.amount <= :maxValue', {maxValue})
        }
        if (type) {
            transaction_query.andWhere('trans.type = :type', {type})
        }
        transaction_query.take(limit).skip(offset).orderBy('trans.created_at', 'DESC')

        return transaction_query.getMany()
    }

    // Транзакции всего ПРИЛОЖЕНИЯ (Пагинация/Фильтрация)
    async get_all_transactions(dto: TransactionFilterDTO) {
        const {limit = 10, offset = 0, minValue, maxValue, type, user_id} = dto

        const transaction_query = this.trans_rep.createQueryBuilder('trans')

        if (user_id) {
            transaction_query.leftJoin('trans.wallet', 'wallet')
            .leftJoin('wallet.user', 'user')
            .where('user.id = :user_id', {user_id})
        }
        
        if (minValue) {
            transaction_query.andWhere('trans.amount >= :minValue', {minValue})
        }
        if (maxValue) {
            transaction_query.andWhere('trans.amount <= :maxValue', {maxValue})
        }
        if (type) {
            transaction_query.andWhere('trans.type = :type', {type})
        }
        
        transaction_query.take(limit).skip(offset).orderBy('trans.created_at', 'DESC')

        return transaction_query.getMany()
    }

    // Статистика продавца
    async get_seller_stats(seller_id: number) {
        const orders = await this.order_rep.createQueryBuilder('ord')
        .innerJoinAndSelect('ord.items', 'item')
        .innerJoinAndSelect('item.product', 'product')
        .where('product.creator_id = :seller_id', {seller_id}).getMany() // Поиск заказа с продуктом продавца

        let returned_earnings = 0 // Возвращено клиентам при отмене
        let returned_products = 0 // Возвращено продуктов на склад
        let Product_sold = 0 // Общее количество проданных товаров
        let Total_earnings = 0 // Общий доход
        let products : product_stat[] = []

        orders.forEach(order => { // Счет товаров и дохода

            order.items.forEach(item => {
                const item_total = item.purchase_price * item.quantity
                if (order.status === Status.CANCELLED) {
                    returned_earnings += item_total
                    returned_products += item.quantity
                }
                if (order.status === Status.SHIPPED || order.status === Status.COMPLETED) {
                    Total_earnings += item_total
                    Product_sold += item.quantity
                    products.push({id: item.product.id, count: item.quantity})
                }
            })
        })
    
        const best_product = products.length > 0 ? // Самый продаваемый продукт
        products.reduce((prev, current) => (prev.count > current.count) ? prev : current)
        : null

        return {
            "Доход" : Total_earnings,
            "Продано продуктов" : Product_sold,
            "Возвращено продуктов на склад" : returned_products,
            "Возвращено средств" : returned_earnings,
            "Лучший продукт" : best_product
        }

    }

    // Получение кошелька админа, там куда падает комиссия
    async get_wallet_admin() {
        const wallet = await this.wallet_rep.findOne({where: {user: {id: 1}}})

        return wallet
    }

    // Получение всех комиссионых транзакций (Пагинация/Фильтрация)
    async get_transactions_admin(dto: TransactionFilterDTO) {
        const {limit = 10, offset = 0, minValue, maxValue, type} = dto
        const user_id = 1

        const transactions_query = this.trans_rep.createQueryBuilder('trans')
        .leftJoin('trans.wallet', 'wallet')
        .leftJoin('wallet.user', 'user')
        .where('user.id = :user_id', {user_id})

        if (minValue) {
            transactions_query.andWhere('trans.amount >= :minValue', {minValue})
        }
        if (maxValue) {
            transactions_query.andWhere('trans.amount <= :maxValue', {maxValue})
        }
        if (type) {
            transactions_query.andWhere('trans.type = :type', {type})
        }

        transactions_query.take(limit).skip(offset).orderBy('trans.created_at', 'DESC')

        return transactions_query.getMany()

    }
}
