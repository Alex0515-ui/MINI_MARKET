import { Test } from "@nestjs/testing";
import { OrderService } from "./order.service"
import { DataSource } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Order, Status } from "./order.entity";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { User, UserRole } from "src/users/users.entity";

describe('OrderService', () => {
    let service: OrderService;
    let order_rep;
    let data_source;
    
    const order_id = 1
    const user_id = 4
    const seller_id1 = 2
    const seller_id2 = 3
    const product1 = {id: 1, creator: {id: 2}, price: 1000}
    const product2 = {id: 1, creator: {id: 3}, price: 1500}

    const mockOrderRep = {
        find: jest.fn()
    }
    const mockTransaction = {
        manager: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
        }
    }
    beforeEach(async () => {
        jest.resetAllMocks()
        const module = await Test.createTestingModule({
            providers: [OrderService,
                {provide: DataSource, useValue: {transaction: jest.fn().mockImplementation((cb) => cb(mockTransaction.manager))}},
                {provide: getRepositoryToken(Order), useValue: mockOrderRep}
            ]
        }).compile();
        service = module.get(OrderService)
        order_rep = module.get(getRepositoryToken(Order))
        data_source = module.get(DataSource)
    })

    afterEach(() => {
        jest.clearAllMocks();
    })


    // Тесты на создание заказа
    it('Успешное создание заказа', async () => {
        const user_id = 2

        const product11 = {id: 11, creator: {id: 1}, count: 15, price: 1000}
        const product8 = {id: 8, creator: {id: 5}, count: 10, price: 1500}
        const mockedBasket = [  
            {
                product_id: product11.id,
                quantity: 1
            },
            {
                product_id: product8.id,
                quantity: 1
            }
        ]
        mockTransaction.manager.findOne.mockResolvedValueOnce(product11)
        .mockResolvedValueOnce(product8)
        mockTransaction.manager.create.mockImplementation((_, entity) => entity)
        mockTransaction.manager.save.mockImplementation(entity => entity) 
        const result = await service.createOrderCheckout(user_id, {basket: mockedBasket})
        
        expect(data_source.transaction).toHaveBeenCalled();
        expect(result.amount).toEqual("2500")
        expect(product11.count).toEqual(14)
        expect(product8.count).toEqual(9)
        expect(mockTransaction.manager.create).toHaveBeenCalled();
    })

    it('Должно вывести ошибку если продукта нету', async () => {
        const mockedBasket = [  
            {
                product_id: 11,
                quantity: 1
            } 
        ]
        mockTransaction.manager.findOne.mockResolvedValue(null)

        await expect(service.createOrderCheckout(1, {basket: mockedBasket}))
        .rejects.toThrow(NotFoundException)
        expect(mockTransaction.manager.create).not.toHaveBeenCalled();
    })

    it('Должно вывести ошибку если продавец покупает у самого себя', async () => {
        const user_id = 5
        const product11 = {id: 11, creator: {id: 1}, count: 7, price: 1000}
        const product8 = {id: 8, creator: {id: 5}, count: 10, price: 1500}
        const mockedBasket = [  
            {
                product_id: product11.id,
                quantity: 6
            },
            {
                product_id: product8.id,
                quantity: 1
            }
        ]
        mockTransaction.manager.findOne.mockResolvedValueOnce(product11)
        .mockResolvedValueOnce(product8)

        await expect(service.createOrderCheckout(user_id, {basket: mockedBasket}))
        .rejects.toThrow(BadRequestException)
        expect(mockTransaction.manager.create).not.toHaveBeenCalled();
    })
    
    it('Должно вывести ошибку если товаров на складе не хватает', async () => {
        const product11 = {id: 11, creator: {id: 1}, count: 5, price: 1000}
        const product8 = {id: 8, creator: {id: 5}, count: 10, price: 1500}
        const mockedBasket = [  
            {
                product_id: product11.id,
                quantity: 6
            },
            {
                product_id: product8.id,
                quantity: 1
            }
        ]
        mockTransaction.manager.findOne.mockResolvedValue(product11)

        await expect(service.createOrderCheckout(2, {basket: mockedBasket}))
        .rejects.toThrow(ConflictException)
        expect(mockTransaction.manager.create).not.toHaveBeenCalled();
    })


    // Тесты на оформление заказа
    it('Заказ должен успешно оформиться', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller2 = {id: seller_id2, wallet: {id: 3, balance: 20000}}
        const admin = {id: 1, name: "admin", role: UserRole.ADMIN, wallet: {id: 1, balance: 100000}}
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.PENDING
    }

        mockTransaction.manager.findOne.mockImplementation((entity, options) => {
            if (entity == Order) return order
            if (entity === User && options.where.id === 4) return user
            if (entity === User && options.where.id === 2) return seller1
            if (entity === User && options.where.id === 3) return seller2
            if (entity === User && options.where.id === 1) return admin
            return null
        })
        mockTransaction.manager.save.mockResolvedValue(user.wallet)
        mockTransaction.manager.save.mockResolvedValueOnce(seller1.wallet)
        .mockResolvedValueOnce(seller2.wallet).mockResolvedValueOnce(admin.wallet)

        await service.confirmOrder(order_id, user_id)

        expect(user.wallet.balance).toEqual(6500)
        expect(seller1.wallet.balance).toEqual(16900)
        expect(seller2.wallet.balance).toEqual(21425)
        expect(admin.wallet.balance).toEqual(100175)
        expect(order.status).toEqual(Status.SHIPPED)
    })

    it('Должна выйти ошибка что заказ не найден', async () => {
        mockTransaction.manager.findOne.mockResolvedValue(null)

        await expect(service.confirmOrder(1, 2)).rejects.toThrow(NotFoundException)
    })

    it('Должна выйти ошибка если это чужой заказ', async () => {
        const order = {id: order_id, user_id: 5, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.PENDING
    }
    mockTransaction.manager.findOne.mockResolvedValue(order)

    await expect(service.confirmOrder(order_id, user_id)).rejects.toThrow(ConflictException)

    expect(mockTransaction.manager.save).not.toHaveBeenCalled();
    })

    it('Должна выйти ошибка если заказ уже обработан', async () => {
        const order_id = 1
        const user_id = 4
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.SHIPPED
    }
    mockTransaction.manager.findOne.mockResolvedValue(order)

    await expect(service.confirmOrder(order_id, user_id)).rejects.toThrow(BadRequestException)
    expect(mockTransaction.manager.save).not.toHaveBeenCalled();
    })

    it('Должна выйти ошибка если клиент не найден', async () => {
        const order_id = 1
        const user_id = 4
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.PENDING
    }
    mockTransaction.manager.findOne.mockResolvedValueOnce(order).mockResolvedValueOnce(null)

    await expect(service.confirmOrder(order_id, user_id)).rejects.toThrow(NotFoundException)
    expect(mockTransaction.manager.save).not.toHaveBeenCalled();
    })

    it('Должна выйти ошибка если недостаточно средств', async () => {
       
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 100}}
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.PENDING
    }
    mockTransaction.manager.findOne.mockResolvedValueOnce(order).mockResolvedValueOnce(user)

    await expect(service.confirmOrder(order_id, user_id)).rejects.toThrow(BadRequestException)
    expect(mockTransaction.manager.save).not.toHaveBeenCalled();
    })

    it('Должна выйти ошибка если товар не найден в заказе', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.PENDING
    }
    mockTransaction.manager.findOne.mockResolvedValueOnce(order).mockResolvedValueOnce(user)
    .mockResolvedValueOnce(product1).mockResolvedValueOnce(null)

    await expect(service.confirmOrder(order_id, user_id)).rejects.toThrow(NotFoundException)
    })

    it('Должна выйти ошибка если продавец не найден', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller2 = {id: seller_id2, wallet: {id: 3, balance: 20000}}
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.PENDING
    }
    mockTransaction.manager.findOne.mockResolvedValueOnce(order).mockResolvedValueOnce(user)
    .mockResolvedValueOnce(product1).mockResolvedValueOnce(product2)
    .mockResolvedValueOnce(seller1).mockResolvedValueOnce(null)

    await expect(service.confirmOrder(order_id, user_id)).rejects.toThrow(NotFoundException)
    })

    it('Должна выйти ошибка если админ не найден', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller2 = {id: seller_id2, wallet: {id: 3, balance: 20000}}
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.PENDING
    }
    mockTransaction.manager.findOne.mockResolvedValueOnce(order).mockResolvedValueOnce(user)
    .mockResolvedValueOnce(product1).mockResolvedValueOnce(product2)
    .mockResolvedValueOnce(seller1)
    .mockResolvedValueOnce(seller2).mockResolvedValueOnce(null)

    await expect(service.confirmOrder(order_id, user_id)).rejects.toThrow(NotFoundException)
    })


    // Тесты на отмену заказа
    it('Заказ должен успешно отмениться при оплаченном заказе', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller2 = {id: seller_id2, wallet: {id: 3, balance: 20000}}
        const admin = {id: 1, name: "admin", role: UserRole.ADMIN, wallet: {id: 1, balance: 100000}}
        const order = {id: order_id, user_id: user_id, amount: "3500", items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
        ],
        status: Status.SHIPPED
    }

    mockTransaction.manager.findOne.mockImplementation((entity, options) => {
        if (entity === Order) return order
        if (entity === User && options.where.id === 4) return user
        if (entity === User && options.where.id === 2) return seller1
        if (entity === User && options.where.id === 3) return seller2
        if (entity === User && options.where.id === 1) return admin
        return null
    })

    mockTransaction.manager.save.mockResolvedValueOnce(product1)
    .mockResolvedValueOnce(product2)
    .mockResolvedValue(user.wallet)
    .mockResolvedValueOnce(seller1.wallet).mockResolvedValueOnce(seller2.wallet)
    .mockResolvedValueOnce(admin.wallet)
    .mockResolvedValueOnce(order)

    await service.cancelOrder(order_id)

    expect(user.wallet.balance).toEqual(13500)
    expect(seller1.wallet.balance).toEqual(13100)
    expect(seller2.wallet.balance).toEqual(18575)
    expect(admin.wallet.balance).toEqual(99825)
    expect(mockTransaction.manager.save).toHaveBeenCalled();
    })

    it('Должно успешно отменить заказ при статусе в ожидании', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller2 = {id: seller_id2, wallet: {id: 3, balance: 20000}}
        const admin = {id: 1, name: "admin", role: UserRole.ADMIN, wallet: {id: 1, balance: 100000}}
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
            ],
            status: Status.PENDING
        }
        mockTransaction.manager.findOne.mockResolvedValue(order)
        mockTransaction.manager.save.mockResolvedValueOnce(product1).mockResolvedValueOnce(product2)
        mockTransaction.manager.save.mockResolvedValueOnce(order)

        await service.cancelOrder(order_id)

        expect(order.status).toEqual(Status.CANCELLED)
        expect(user.wallet.balance).toEqual(10000)
        expect(seller1.wallet.balance).toEqual(15000)
        expect(seller2.wallet.balance).toEqual(20000)
        expect(admin.wallet.balance).toEqual(100000)
    })

    it('Должно вывести ошибку если заказ не найден', async () => {
        mockTransaction.manager.findOne.mockResolvedValue(null)
        await expect(service.cancelOrder(1)).rejects.toThrow(NotFoundException)
    })

    it('Должно вывести ошибку если заказ уже отменен', async () => {
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
            ],
            status: Status.CANCELLED
        }
        mockTransaction.manager.findOne.mockResolvedValue(order)
        await expect(service.cancelOrder(order_id)).rejects.toThrow(BadRequestException)

    })

    it('Должно вывести ошибку если заказ уже завершен', async () => {
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
            ],
            status: Status.COMPLETED
        }
        mockTransaction.manager.findOne.mockResolvedValue(order)
        await expect(service.cancelOrder(order_id)).rejects.toThrow(BadRequestException)
    })

    it('Должно вывести ошибку если пользователь не найден', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller2 = {id: seller_id2, wallet: {id: 3, balance: 20000}}
        const seller1Copy = JSON.parse(JSON.stringify(seller1))
        const seller2Copy = JSON.parse(JSON.stringify(seller2))
        const admin = {id: 1, name: "admin", role: UserRole.ADMIN, wallet: {id: 1, balance: 100000}}
        const adminCopy = JSON.parse(JSON.stringify(admin))
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
            ],
            status: Status.SHIPPED
        }
        // mockTransaction.manager.findOne.mockResolvedValueOnce(order)
        // .mockResolvedValueOnce(seller1Copy)
        // .mockResolvedValueOnce(seller2Copy).mockResolvedValueOnce(adminCopy).mockResolvedValueOnce(null)

        mockTransaction.manager.findOne.mockImplementation((entity, options) => {
            if (entity === Order) return order
            if (entity === User && options.where.id === 2) return seller1Copy
            if (entity === User && options.where.id === 3) return seller2Copy
            if (entity === User && options.where.id === 1) return adminCopy
            if (entity === User && options.where.id === 4) return null
            return null

        })
        await expect(service.cancelOrder(order_id)).rejects.toThrow(NotFoundException)
        expect(seller1.wallet.balance).toEqual(15000)
        expect(seller2.wallet.balance).toEqual(20000)
        expect(admin.wallet.balance).toEqual(100000)
    })

    it('Должно вывести ошибку если продавец не найден', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller1Copy = JSON.parse(JSON.stringify(seller1))
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
            ],
            status: Status.SHIPPED
        }
        mockTransaction.manager.findOne.mockResolvedValueOnce(order)
        .mockResolvedValueOnce(seller1Copy)
        .mockResolvedValueOnce(null)

        await expect(service.cancelOrder(order_id)).rejects.toThrow(NotFoundException)
        expect(order.status).not.toBe(Status.CANCELLED)
        expect(user.wallet.balance).toEqual(10000)
        expect(seller1.wallet.balance).toEqual(15000)
    })

    it('Должно вывести ошибку если админ не найден', async () => {
        const user = {id: user_id, name: "user1", role: UserRole.USER, wallet: {id: 4, balance: 10000}}
        const seller1 = {id: seller_id1, wallet: {id: 2, balance: 15000}}
        const seller2 = {id: seller_id2, wallet: {id: 3, balance: 20000}}
        const seller1Copy = JSON.parse(JSON.stringify(seller1))
        const seller2Copy = JSON.parse(JSON.stringify(seller2))
        const order = {id: order_id, user_id: user_id, amount: 3500, items: [
            {
                id: 1,
                product: product1,
                quantity: 2,
                purchase_price: 1000
            },
            {
                id: 2,
                product: product2,
                quantity: 1,
                purchase_price: 1500
            }
            ],
            status: Status.SHIPPED
        }
        mockTransaction.manager.findOne.mockResolvedValueOnce(order)
        .mockResolvedValueOnce(seller1Copy).mockResolvedValueOnce(seller2Copy).mockResolvedValueOnce(null)

        await expect(service.cancelOrder(order_id)).rejects.toThrow(NotFoundException)
        expect(user.wallet.balance).toEqual(10000)
        expect(seller2.wallet.balance).toEqual(20000)
        expect(seller1.wallet.balance).toEqual(15000)
        
    })
})