import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/products/products.entity";
import { LessThan, Repository } from "typeorm";
import { DataSource } from "typeorm";
import { Order, OrderItem, Status } from "./order.entity";
import { CreateOrderDTO, OrderFilterDTO } from "./order.dto";
import { Transaction, TRANSACTION_TYPE, Wallet } from "src/payment/payment.entity";
import { User } from "src/users/users.entity";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class OrderService {

    constructor(
        @InjectRepository(Wallet) private wallet: Repository<Wallet>,
        @InjectRepository(Order) private order: Repository<Order>,
        private dataSource: DataSource, // Для гибкого управления транзакцией
    ) {}


    // Функция создания заказа в корзине
    async createOrderCheckout(userId: number, dto: CreateOrderDTO) {
        const saved_order = await this.dataSource.transaction(async (manager) => {
            
            let total_amount = 0
            let orderItems: OrderItem[] = []

            for (const item of dto.basket) {
                const product = await manager.findOne(Product, {
                    where: {id: item.product_id}, 
                    relations: ['creator'],
                    lock: {mode: 'pessimistic_write', tables: ['product']} // Чтобы сразу несколько людей могли покупать товар
                }) // Поиск продукта

                if (!product) {
                    throw new BadRequestException(`Товар №${item.product_id} отсутствует`)
                }
                if (item.quantity > product.count) {
                    throw new BadRequestException(`Не хватает товаров на складе`)
                }
                if (product.creator.id == userId) {
                    throw new BadRequestException("Нельзя купить товары у себя!")
                }

                const item_price = item.quantity * Number(product.price)
                total_amount += item_price // Добавление стоимости товара в общую стоимость

                const orderItem = new OrderItem() // Создание товара
                orderItem.product = product
                orderItem.purchase_price = Number(product.price)
                orderItem.quantity = item.quantity

                orderItems.push(orderItem)

                product.count -= item.quantity // Уменьшение товара на складе
                    
                await manager.save(product);
                    
            }

            const newOrder = manager.create(Order, { // Создание нового заказа
                user_id: userId, 
                amount: total_amount.toString(),
                items: orderItems, 
                status: Status.PENDING})
            
            return await manager.save(newOrder)
            
        })
        
        return {
            id: saved_order.id,
            items: saved_order.items.map(item => ({
                quantity: item.quantity,
                product: {
                    id: item.product.id,
                    title: item.product.title,
                    description: item.product.description,
                    image: item.product.image,
                    price: item.product.price
                }
            })),
            amount: saved_order.amount,
            status: saved_order.status,
            time: saved_order.created_at
        }
    }

    // Функция для подтверждения оплаты заказа
    async confirmOrder(orderId: number, userId: number) {
        return this.dataSource.transaction(async (manager) => {
        try {
            const order = await manager.findOne(Order, { // Поиск заказа
                where: {id: orderId}, 
                relations: ['items', 'items.product', 'items.product.creator', 'items.product.creator.wallet']
            }); 
            
            if (!order) {
                throw new BadRequestException(`Заказ №${orderId} не найден`)
            }
            if (order.user_id !== userId) {
                throw new BadRequestException("Нельзя оформить чужой заказ!")
            }
            if (order.status !== Status.PENDING) {
                throw new BadRequestException("Заказ уже обработан")
            }

            const user = await manager.findOne(User, {where: { id: order.user_id }, relations: ['wallet']});            
            if (!user) throw new BadRequestException("Клиент не найден")

            let total_amount = Number(order.amount)
            
            if (user.wallet.balance < total_amount) throw new BadRequestException("Недостаточно средств")
            user.wallet.balance -= total_amount // Списание с кошелька

            await manager.save(Transaction, { // 1 Транзакция
                    wallet: user.wallet, 
                    amount: total_amount, 
                    type: TRANSACTION_TYPE.PAYMENT
            })
            await manager.save(user.wallet)

            for (let item of order.items) {
                const product = item.product
                const creator_id = product.creator.id
                if (!product) throw new BadRequestException("Товар не найден")

                const admin = await manager.findOne(User, { // Поиск продавца товара
                    where: {id: creator_id}, 
                    relations: ['wallet']
                })

                if (!admin) throw new BadRequestException("Админ не найден")
                if (!admin.wallet) throw new BadRequestException("Кошелек админа не найден")
                if (!product) throw new BadRequestException("Товар не найден")

                const item_price = item.quantity * Number(product.price) // Начисление админу
                admin.wallet.balance += item_price

                await manager.save(Transaction, { // 2 Транзакция
                    wallet: admin.wallet, 
                    amount: item_price, 
                    type: TRANSACTION_TYPE.REFILLING
                })
                await manager.save(admin.wallet)
            }
            order.status = Status.SHIPPED; // Меняем статус

            await manager.save(order)
            return {"message": `Заказ №${order.id} успешно оплачен!`}
        }
        catch(e) {
            console.log(e)
        }
        })
    }

    // Функция завершения заказа
    async completeOrder(orderId:number) {
        return await this.dataSource.transaction(async (manager) => {
            
            const order = await manager.findOne(Order, {where: {id: orderId}}); // Поиск заказа

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
            await manager.save(order);
            return {"message": `Заказ №${order.id} был успешно завершен!`}

        })

        
    }

    // Функция для отмены заказа
    async cancelOrder(orderId: number) {

        return await this.dataSource.transaction(async (manager) => {
            
            const order = await manager.findOne(Order, {
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

            for (const item of order.items) { // Возврат товаров на склад
                    const product = await manager.findOne(Product, {
                        where: {id: item.product.id}, 
                        relations: ['creator']
                    })

                    if (product) {
                        product.count += item.quantity;
                        await manager.save(product);


            if (order.status == Status.SHIPPED) {
                const admin = await manager.findOne(User, {
                    where: {id: product.creator.id}, 
                    relations: ['wallet']
                })

                if (!admin) throw new BadRequestException("Админ не найден!")

                const item_price = item.purchase_price * item.quantity
                admin.wallet.balance -= item_price // Снимаем с продавца админа стоимость товара
                    

                const transaction = manager.create(Transaction, { // Создание транзакции
                    wallet: admin.wallet, 
                    amount: item_price, 
                    type: TRANSACTION_TYPE.WITHDRAWAL
                })

                await manager.save(transaction)
                await manager.save(admin)
                    
                    }
                }     
            }
            const user = await manager.findOne(User, {where: {id: order.user_id}, relations: ['wallet']}) 
            if (!user) throw new BadRequestException("Клиент не найден")
            user.wallet.balance += Number(order.amount)
            await manager.save(user.wallet) // Возврат средств пользователю

            const transaction = manager.create(Transaction, { // Создание транзакции
                wallet: user.wallet, 
                amount: Number(order.amount), 
                type: TRANSACTION_TYPE.REFILLING
            })
            await manager.save(transaction)

            order.status = Status.CANCELLED; // Изменение статуса
            await manager.save(order);

            return {"message": `Заказ №${orderId} был успешно отменен, товары возвращены на склад!`};
        
        })
        
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
        if (order.status !== Status.PENDING) {
            throw new BadRequestException("Нельзя отменить заказ который уже отправлен!")
        }
        return await this.cancelOrder(orderId)
    }

    // Удаление после 30 минут ожидания в статусе "PENDING"
    @Cron(CronExpression.EVERY_10_MINUTES)
    async checkExpirdOrders() {
        const time = new Date();
        time.setMinutes(time.getMinutes() - 30) // 30 минут максимум

        const orders = await this.order.find({where: {
            status: Status.PENDING, 
            created_at: LessThan(time)
        }})

        for (const order of orders) {
            await this.cancelOrder(order.id) // Авто удаление
        }
    }

    // Получение всех заказов в Личном кабинете   (Пагинация/Фильтрация)
    async get_my_orders(userId: number, dto: OrderFilterDTO) {
        const {limit = 10, offset = 0, minValue, maxValue, status} = dto

        const order_query = this.order.createQueryBuilder('ord').where('ord.user_id = :userId', {userId})

        if (minValue) {
            order_query.andWhere('ord.amount >= :minValue', {minValue});
        }
        if (maxValue) {
            order_query.andWhere('ord.amount <= :maxValue', {maxValue});
        }
        if (status) {
            order_query.andWhere('ord.status = :status', {status})
        }

        order_query.take(limit).skip(offset).orderBy('ord.created_at', 'DESC')
        return order_query.getMany()
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

        return {
            id: order.id,
            items: order.items.map(item => ({
                quantity: item.quantity,
                product: {
                    id: item.product.id,
                    title: item.product.title,
                    description: item.product.description,
                    image: item.product.image,
                    price: item.product.price
                }
            })),
            amount: order.amount,
            status: order.status,
            time: order.created_at
        }
    }

    // Получение заказа админом
    async get_order(orderId:number) {
        const order = await this.order.findOne({
            where: {id: orderId},
            relations: ['items', 'items.product']
        })
        if (!order) {
            throw new BadRequestException(`Заказ №${orderId} нету в базе`)
        }
        
        return order
    }
}
