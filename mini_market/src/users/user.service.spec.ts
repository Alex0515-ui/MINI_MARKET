import { Test } from "@nestjs/testing";
import { UserService } from "./users.service"
import { getRepositoryToken } from "@nestjs/typeorm";
import { User, UserRole } from "./users.entity";
import { Wallet } from "src/payment/payment.entity";
import { ConflictException } from "@nestjs/common";

describe('UserService', () => {
    let service: UserService;
    let userRep;
    let walletRep;

    let mockUserRep = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn()
    }

    let mockWalletRep = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn()
    }

    beforeEach(async () => {
        const module = Test.createTestingModule({
            providers: [UserService,
                {provide: getRepositoryToken(User), useValue: mockUserRep}, 
                {provide: getRepositoryToken(Wallet), useValue: mockWalletRep}
            ]
        }).compile()

        service = (await module).get<UserService>(UserService)
        userRep = (await module).get(getRepositoryToken(User))
        walletRep = (await module).get(getRepositoryToken(Wallet))
    })

    afterEach(() => {
        jest.clearAllMocks();
    })

    // Тесты на регистрацию
    it('Успешное создание пользователя', async () => {
        const dto = {name: "user7", password: "123456"}
        userRep.findOne.mockResolvedValue(null)

        userRep.create.mockResolvedValue({name: "user7", password: "123456", role: UserRole.USER})
        userRep.save.mockResolvedValue({id: 1, name: "user7", role: UserRole.USER, wallet: {id: 1}}) 

        const wallet = await walletRep.create.mockResolvedValue({id: 1, user: {id: 10}, balance: 100})
        walletRep.save.mockResolvedValue({id: 1, user: {id: 10}, balance: 100})

        
        const result = await service.createUser(dto);


        expect(result).toEqual({
            id: 1,
            name: "user7",
            role: UserRole.USER,
            wallet_id: wallet.id
        });

        expect(userRep.findOne).toHaveBeenCalled();
        expect(userRep.save).toHaveBeenCalled();
        expect(walletRep.create).toHaveBeenCalled();
        expect(walletRep.save).toHaveBeenCalled();
    })

    it('Должно вывести ConflictException, если имя занято', async () => {
        
        userRep.findOne.mockResolvedValue({id: 1, name: 'user7'})

        await expect(service.createUser({name: 'user7', password: "123456"}))
        .rejects.toThrow(ConflictException);

        expect(userRep.save).not.toHaveBeenCalled();
    })

})