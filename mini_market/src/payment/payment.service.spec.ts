import { Test } from "@nestjs/testing";
import { WalletService } from "./payment.service"
import { DataSource } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Transaction, Wallet } from "./payment.entity";
import { Order, Status } from "src/orders/order.entity";
import { BadRequestException, InternalServerErrorException, NotFoundException } from "@nestjs/common";

describe('WalletService', () => {
    let service: WalletService;
    let wallet_rep;
    let order_rep;
    let data_source;
    let trans_rep;

    const mockQueryRunner = {
        connect: jest.fn(),
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        rollbackTransaction: jest.fn(),
        release: jest.fn(),
        manager: {
            create: jest.fn(),
            save: jest.fn()
        }
    }

    const mockWalletRep = {
        findOne: jest.fn()
    }

    const mockOrderRep = {
        createQueryBuilder: jest.fn(() => mockCreateQueryBuilder)
    }
    
    const mockCreateQueryBuilder  = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([])
    }

    const mockTransactionRep = {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn()
    }

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [
                WalletService,
                {provide: DataSource, useValue: {createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner)}},
                {provide: getRepositoryToken(Wallet), useValue: mockWalletRep},
                {provide: getRepositoryToken(Order), useValue: mockOrderRep},
                {provide: getRepositoryToken(Transaction), useValue: mockTransactionRep}
            ]
        }).compile();

        service = module.get(WalletService)
        wallet_rep = module.get(getRepositoryToken(Wallet));
        order_rep = module.get(getRepositoryToken(Order))
        data_source = module.get(DataSource)
        trans_rep = module.get(getRepositoryToken(Transaction))
    })

    afterEach(() => {
        jest.clearAllMocks();
    })


    // Тесты на пополнение кошелька
    it('Кошелек должен успешно пополниться', async () => {
        const user_id = 1 
        const amount = 1000
        const wallet = {id: 1, balance: 500, user: {id: user_id}}

        await wallet_rep.findOne.mockResolvedValue(wallet)
        mockQueryRunner.manager.save.mockResolvedValue(true)
        mockQueryRunner.manager.create.mockReturnValue({id: 123})

        const result = await service.fill_wallet(user_id, amount)

        expect(wallet_rep.findOne).toHaveBeenCalledWith({where: {user: {id: user_id}}})
        expect(wallet.balance).toEqual(1500)
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(wallet);
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    })
    
    it('Долнжо вывести ошибку если кошелек не найден', async () => {
        wallet_rep.findOne.mockResolvedValue(null)

        await expect(service.fill_wallet(1, 500)).rejects.toThrow(NotFoundException);
        expect(data_source.createQueryRunner).not.toHaveBeenCalled();
    })

    it('Должно вывести ошибку и сделать rollback', async () => {
        const wallet = await wallet_rep.findOne.mockResolvedValue({id: 1, user: {id: 1}, balance: 500})
        mockQueryRunner.manager.save.mockRejectedValue(new Error('DB Error'))

        await expect(service.fill_wallet(1, 1000)).rejects.toThrow(InternalServerErrorException)

        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    })


    // Тесты на вывод средств
    it('Должно успешно вывести средства', async () => {
        const user_id = 1
        const amount = 1000
        const wallet = {id: 1, user: {id: 1}, balance: 1500}

        await wallet_rep.findOne.mockResolvedValue(wallet)
        mockQueryRunner.manager.save.mockResolvedValue(true)
        mockQueryRunner.manager.create.mockReturnValue({id: 1})

        const result = await service.withdrawal(user_id, amount)

        expect(wallet_rep.findOne).toHaveBeenCalledWith({where: {user: {id: user_id}}});
        expect(wallet.balance).toEqual(500);
        expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(wallet)
        expect(mockQueryRunner.release).toHaveBeenCalled();
    })

    it('Должно вывести ошибку если кошелек не найден', async () => {
        await wallet_rep.findOne.mockResolvedValue(null)

        await expect(service.withdrawal(1, 500)).rejects.toThrow(NotFoundException);

        expect(data_source.createQueryRunner).not.toHaveBeenCalled();
    })

    it('Должно вывести ошибку если на балансе не хватает средств', async () => {
        const user_id = 1
        const amount = 1000
        const wallet = {id: 1, user: {id: user_id}, balance: 500}

        await wallet_rep.findOne.mockResolvedValue(wallet)
        await expect(service.withdrawal(user_id, amount)).rejects.toThrow(BadRequestException);

        expect(data_source.createQueryRunner).not.toHaveBeenCalled();
    })

    it('Должно сделать откат rollbackTransaction и вывести ошибку', async () => {
        const user_id = 1
        const amount = 1000
        const wallet = {id: 1, user: {id: user_id}, balance: 1500}
        await wallet_rep.findOne.mockResolvedValue(wallet)
        
        mockQueryRunner.manager.save.mockRejectedValue(new Error('DB Error'))

        await expect(service.withdrawal(user_id, amount)).rejects.toThrow(InternalServerErrorException)

        expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
        expect(mockQueryRunner.release).toHaveBeenCalled();
    })


    // Тесты на статистику продавца
    it('Должно успешно вывести статистику', async () => {
        const seller_id = 4
        const MockOrders = [
        {id: 5, items: [{id: 1, product: {id:1, creator_id: 4, price: 2000}, quantity: 2, purchase_price: 2000}],
        status: Status.COMPLETED},
        {id: 4, items:[{id: 2, product: {id: 3, creator_id: 4, price: 1000}, quantity: 3, purchase_price: 1000}],
        status: Status.SHIPPED},
        {id: 6, items:[{id: 3, product: {id: 5, creator_id: 4, price: 1500}, quantity: 4, purchase_price: 1500}], 
        status: Status.CANCELLED}
        ]

        await order_rep.createQueryBuilder().getMany.mockResolvedValue(MockOrders)
        const best_product = {id: 3, count: 3}

        const result = await service.get_seller_stats(seller_id)

        expect(result["Возвращено продуктов на склад"]).toEqual(4)
        expect(result["Возвращено средств"]).toEqual(6000)
        expect(result["Доход"]).toEqual(7000)
        expect(result["Лучший продукт"]).toEqual(best_product)
        expect(result["Продано продуктов"]).toEqual(5)
    })

    it('Должно вернуть ошибку если заказов нету', async () => {
        await order_rep.createQueryBuilder().getMany.mockResolvedValue([])

        const result = await service.get_seller_stats(1)

        expect(result["Доход"]).toBe(0);
        expect(result["Лучший продукт"]).toBeNull();
    })

    it('Должно вернуть ошибку если проблемы в БД', async () => {
        await order_rep.createQueryBuilder().getMany.mockRejectedValue(new Error('DB Error'))
        await expect(service.get_seller_stats(1)).rejects.toThrow('DB Error')
    })
})