import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/products/products.entity";
import { Repository } from "typeorm";
import { DataSource } from "typeorm";
import type { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { Order, OrderItem, Status } from "./order.entity";
import { CreateOrderDTO } from "./order.dto";
import { Transaction, TRANSACTION_TYPE, Wallet } from "src/payment/payment.entity";
import { User } from "src/users/users.entity";

@Injectable()
export class OrderService {

    constructor(
        @InjectRepository(Wallet) private wallet: Repository<Wallet>,
        @InjectRepository(Order) private order: Repository<Order>,
        private dataSource: DataSource, // Для гибкого управления транзакцией
        @InjectQueue('order-expiration') private orderQueue: Queue // Очередь для отправки задач в Redis
    ) {}


    // Функция создания заказа в корзине
    async createOrderCheckout(userId: number, dto: CreateOrderDTO) {
        
        const queryRunner = this.dataSource.createQueryRunner(); // Создание
        await queryRunner.connect() // Подключение к БД
        await queryRunner.startTransaction(); // Начало транзакции
        
        try {
            let total_amount = 0
            let orderItems: OrderItem[] = []

            for (const item of dto.basket) {
                const product = await queryRunner.manager.findOne(Product, {
                    where: {id: item.product_id}, 
                    // lock: {mode: 'pessimistic_write'} // Чтобы сразу несколько людей могли покупать товар
                }) // Поиск продукта

                if (!product) {
                    throw new BadRequestException(`Товар №${item.product_id} отсутствует`)
                }

                if (item.quantity > product.count) {
                    throw new BadRequestException(`Не хватает товаров на складе`)
                }
                
                const item_price = item.quantity * Number(product.price)
                total_amount += item_price // Добавление стоимости товара в общую стоимость

                const orderItem = new OrderItem() // Создание товара
                orderItem.product = product
                orderItem.purchase_price = Number(product.price)
                orderItem.quantity = item.quantity

                orderItems.push(orderItem)

                product.count -= item.quantity // Уменьшение товара на складе
                
                await queryRunner.manager.save(product);
                
        }

        const newOrder = queryRunner.manager.create(Order, { // Создание нового заказа
            user_id: userId, 
            amount: total_amount.toString(),
            items: orderItems, 
            status: Status.PENDING})
        
        const saved_order = await queryRunner.manager.save(newOrder)
        
        await queryRunner.commitTransaction() // Сохранение транзакции

        await this.orderQueue.add('check-expiration', {orderId: saved_order.id}, { // Добавление заказа в очередь
            delay: 1800000, // 30 минут
            removeOnComplete: true  // Удаление из Redis 
        })
        
        return saved_order
        }

        catch(e) {
            await queryRunner.rollbackTransaction() // Полный откат, при любой ошибке
            if (e instanceof BadRequestException) throw e; // Если товара нет
            throw new InternalServerErrorException("Ошибка при создании заказа") // Другие ошибки
        }

        finally {
            await queryRunner.release()
        }
    }

    // Функция для подтверждения оплаты заказа
    async confirmOrder(orderId: number) {
        
        const queryRunner = this.dataSource.createQueryRunner(); // Создание
        await queryRunner.connect() // Подключение к БД
        await queryRunner.startTransaction(); // Начало транзакции

        try {
            const order = await queryRunner.manager.findOne(Order, { // Поиск заказа
                where: {id: orderId}, 
                relations: ['items', 'items.product']
            }); // Поиск заказа
            
            if (!order) {
                throw new BadRequestException(`Заказ №${orderId} не найден`)
            }
            if (order.status !== Status.PENDING) {
                throw new BadRequestException("Заказ уже обработан")
            }

            const user = await queryRunner.manager.findOne(User, { // Поиск пользователя
                where: { id: order.user_id },
                relations: ['wallet'] 
            });            
            if (!user) throw new BadRequestException("Пользователь не найден")
            let total_amount = 0

            for (let item of order.items) {                 // Счет суммы товаров
                const product = await queryRunner.manager.findOne(Product, {
                    where: {id: item.product.id}, 
                    select: ['id', 'title', 'description', 'image', 'price', 'count'],
                    relations: ['creator']
                }) 

                if (!product) throw new NotFoundException("Продукт не найден")
                let item_price = item.quantity * Number(product.price)
                
                total_amount += item_price

            }

            if (!user.wallet) { // Кошелек пользователя
                const wallet = await queryRunner.manager.findOne(Wallet, {where: {user: {id: user.id}}})
                console.log(wallet)
                if (wallet) {
                user.wallet = wallet
                }
                else {
                    const newWallet = queryRunner.manager.create(Wallet, {user: user, balance: 0})
                }
            }
            
            if (Number(user.wallet.balance) < total_amount) throw new BadRequestException("Недостаточно средств")
            user.wallet.balance -= total_amount // Списание с кошелька

            const transaction1 = queryRunner.manager.create(Transaction, { // 1 Транзакция
                    wallet: user.wallet, 
                    amount: total_amount, 
                    type: TRANSACTION_TYPE.PAYMENT
            })

            await queryRunner.manager.save(transaction1)
            await queryRunner.manager.save(user.wallet)

            for (let item of order.items) {
                const product = await queryRunner.manager.findOne(Product, { // Поиск товара
                    where: {id: item.product.id}, 
                    relations: ['creator']
                })
                if (!product) throw new BadRequestException("Товар не найден")

                const admin = await queryRunner.manager.findOne(User, { // Поиск продавца товара
                    where: {id: product.creator.id}, 
                    relations: ['wallet']
                })

                if (!admin) throw new BadRequestException("Админ не найден")
                if (!admin.wallet) {                                        // Кошелек админа продавца
                    const wallet = await queryRunner.manager.findOne(Wallet, {where: {user: {id: admin.id}}})
                    console.log(wallet)
                    if (wallet) {
                        admin.wallet = wallet
                    }
                    else {
                        const newWallet = queryRunner.manager.create(Wallet, {user: admin, balance: 0})
                        await queryRunner.manager.save(newWallet)
                    }
                }  
                if (!product) throw new BadRequestException("Товар не найден")

                const item_price = item.quantity * Number(product.price) // Начисление админу
                admin.wallet.balance = Number(admin.wallet.balance) + item_price

                const transaction2 = queryRunner.manager.create(Transaction, { // 2 Транзакция
                    wallet: admin.wallet, 
                    amount: item_price, 
                    type: TRANSACTION_TYPE.REFILLING
                })
                await queryRunner.manager.save(transaction2)
                await queryRunner.manager.save(admin.wallet)
            }
            order.status = Status.SHIPPED; // Меняем статус

            const saved_order = await queryRunner.manager.save(order)
            
            await queryRunner.commitTransaction()
            return saved_order
        }
        catch(e) {
            await queryRunner.rollbackTransaction() // Откат при ошибке
            if (e instanceof BadRequestException) throw e; // Если проблема с товаром
            throw new InternalServerErrorException("Произошла ошибка при оплате заказа") // Остальные ошибки
        }
        finally {
            await queryRunner.release() 
        }
        
    }

    // Функция завершения заказа
    async completeOrder(orderId:number) {
        const queryRunner = this.dataSource.createQueryRunner()
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const order = await queryRunner.manager.findOne(Order, {where: {id: orderId}}); // Поиск заказа

            if (!order) {
                throw new BadRequestException(`Заказ №${orderId} не существует`);
            }
            if (order.status == Status.COMPLETED) {
                throw new BadRequestException(`Заказ №${orderId} уже завершен!`);
            }
            if (order.status != Status.SHIPPED) {
                throw new BadRequestException(`Нельзя завершить заказ без оплаты и отправки!`)
            }

            order.status = Status.COMPLETED; // Изменение статуса
            const saved_order = await queryRunner.manager.save(order);
            await queryRunner.commitTransaction(); // Сохранение
            return saved_order;
        }

        catch(e) {
            await queryRunner.rollbackTransaction() // Откат при ошибке
            if (e instanceof BadRequestException) throw e;
            throw new InternalServerErrorException("Произошла ошибка при завершении заказа")
        }

        finally {
            await queryRunner.release();
        }
    }

    // Функция для отмены заказа
    async cancelOrder(orderId: number) {

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const order = await queryRunner.manager.findOne(Order, {
                where: {id: orderId}, 
                relations: ['items', 'items.product', ] // Для получения всех деталей заказа
            }) 

            if (!order) {
                throw new BadRequestException(`Заказ №${orderId} не найден`);
            }
            if (order.status == Status.CANCELLED) {
                throw new BadRequestException("Заказ уже отменен!");
            }
            if (order.status == Status.COMPLETED) {
                throw new BadRequestException("Завершенный заказ невозможно отменить");
            }
            if (order.status == Status.SHIPPED) {
                for (const item of order.items) { // Возврат товаров на склад
                    const product = await queryRunner.manager.findOne(Product, {where: {id: item.product.id}, relations: ['creator']})
                    if (product) {
                        product.count += item.quantity;
                        await queryRunner.manager.save(product);
                    console.log(product)
                    console.log(product.creator)
                    const admin = await queryRunner.manager.findOne(User, {
                        where: {id: product.creator.id}, 
                        relations: ['wallet']
                    })

                    if (!admin) throw new BadRequestException("Админ не найден!")
                    
                    if (!admin.wallet) {                                        // Кошелек админа продавца
                        const wallet = await queryRunner.manager.findOne(Wallet, {where: {user: {id: admin.id}}})
                        console.log(wallet)
                        if (wallet) {
                            admin.wallet = wallet
                        }
                        else {
                            const newWallet = queryRunner.manager.create(Wallet, {user: admin, balance: 0})
                            await queryRunner.manager.save(newWallet)
                        }
                    }

                    const item_price = item.purchase_price * item.quantity
                    admin.wallet.balance = Number(admin.wallet.balance) - item_price

                    const transaction = queryRunner.manager.create(Transaction, {
                        wallet: admin.wallet, 
                        amount: item_price, 
                        type: TRANSACTION_TYPE.WITHDRAWAL
                    })

                    await queryRunner.manager.save(transaction)
                    await queryRunner.manager.save(admin)
                    
                    }
                }
                const user = await queryRunner.manager.findOne(User, {where: {id: order.user_id}, relations: ['wallet']})
                if (!user) throw new BadRequestException("Клиент не найден")
                if (!user.wallet) {                                        // Кошелек админа продавца
                    const wallet = await queryRunner.manager.findOne(Wallet, {where: {user: {id: user.id}}})
                    console.log(wallet)
                    if (wallet) {
                        user.wallet = wallet
                    }
                    else {
                        const newWallet = queryRunner.manager.create(Wallet, {user: user, balance: 0})
                        await queryRunner.manager.save(newWallet)
                    }
                }
                user.wallet.balance = Number(user.wallet.balance) + Number(order.amount)

                const transaction = queryRunner.manager.create(Transaction, {
                    wallet: user.wallet, 
                    amount: Number(order.amount), 
                    type: TRANSACTION_TYPE.REFILLING
                })
                await queryRunner.manager.save(transaction)
                 // Изменение статуса
            }
            order.status = Status.CANCELLED;
            await queryRunner.manager.save(order);
            await queryRunner.commitTransaction();

            return {"message": `Заказ №${orderId} был успешно отменен, товары возвращены на склад!`};
        }

        catch(e) {
            console.log(e);
            await queryRunner.rollbackTransaction(); // Откат
            if (e instanceof BadRequestException) throw e;
            throw new InternalServerErrorException("Ошибка при отмене заказа");
        }

        finally {
            await queryRunner.release();
        }
    }

    // Удаление заказа пользователем
    async userCancelOrder(orderId: number, userId: number) {
        const order = await this.order.findOne({where: {id: orderId}})

        if (!order) {
            throw new BadRequestException(`Заказ №${orderId} не существует!`)
        }
        if (order.user_id != userId) {
            throw new BadRequestException("Нельзя отменить чужой заказ!")
        }

        return await this.cancelOrder(orderId)
    }

    // Авто-отмена в случае долгого ожидания в статусе PENDING
    async cancelExpiredOrder(orderId: number) {
        const order = await this.order.findOne({where: {id: orderId}})

        if (order && order?.status == Status.PENDING ) {
            console.log(`Заказ №${orderId} долго стоит в ожидании оплаты, начинаю авто-отмену...`)
            await this.cancelOrder(orderId)
        }
        else {
            console.log(`Заказ №${orderId} уже обработан, авто-отмена не требуется`)
        }
        
    }

    // Получение всех заказов в Личном кабинете
    async get_my_orders(userId: number) {
        return await this.order.find({
            where: {user_id: userId},
            relations: ['items', 'items.product'], // Чтобы видел товары в заказе
            order: {created_at: 'DESC'} // Новые заказы сначала
        })
    }

    // Просмотр конкретного заказа
    async get_my_order(orderId: number, userId: number) {
        const order = await this.order.findOne({
            where: {id: orderId, user_id: userId}, 
            relations: ['items', 'items.product']
        })
        if (!order) {
            throw new BadRequestException(`Заказ №${orderId} не существует`)
        }

        return order
    }

    // Получение заказа админом
    async get_order(orderId:number) {
        const order = this.order.findOne({
            where: {id: orderId},
            relations: ['items', 'items.product']
        })
        if (!order) {
            throw new BadRequestException(`Заказ №${orderId} нету в базе`)
        }

        return order
    }
}
