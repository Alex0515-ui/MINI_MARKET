import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "src/products/products.entity";
import { Repository } from "typeorm";
import { DataSource } from "typeorm";
import type { Queue } from "bull";
import { InjectQueue } from "@nestjs/bull";
import { Order, OrderItem, Status } from "./order.entity";
import { CreateOrderDTO } from "./order.dto";
import { CreateProductDTO } from "src/products/products.dto";

@Injectable()
export class OrderService {

    constructor(
        @InjectRepository(Product) private product: Repository<Product>,
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
                    select: ['id', 'title', 'description', 'image', 'price', 'count']
                }) // Поиск продукта

                if (!product) {
                    throw new BadRequestException(`Товар №${item.product_id} отсутствует`)
                }

                if (item.quantity > product.count) {
                    throw new BadRequestException(`Не хватает товаров на складе`)
                }
                const {count, ...productData} = product // Чтобы не было видно count при получении результата
                const item_price = item.quantity * productData.price
                total_amount += item_price // Добавление стоимости товара в общую стоимость

                const orderItem = new OrderItem() // Создание товара
                orderItem.product = productData as Product // Присваиваем объект без поля count
                orderItem.purchase_price = productData.price
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
            const order = await queryRunner.manager.findOne(Order, {where: {id: orderId}}); // Поиск заказа

            if (!order) {
                throw new BadRequestException(`Заказ №${orderId} не найден`)
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
                relations: ['items', 'items.product'] // Для получения всех деталей заказа
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
                const product = item.product;
                if (product) {
                    product.count += item.quantity;
                    await queryRunner.manager.save(product);
                }
            }

            order.status = Status.CANCELLED; // Изменение статуса
            await queryRunner.manager.save(order);
            await queryRunner.commitTransaction();

            return {"message": `Заказ №${orderId} был успешно отменен, товары возвращены на склад!`};
        }

        catch(e) {
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

        console.log(`Заказ №${orderId} уже обработан, авто-отмена не требуется`)

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
