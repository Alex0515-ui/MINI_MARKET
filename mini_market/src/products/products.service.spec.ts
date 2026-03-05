import { Test } from "@nestjs/testing";
import { ProductService } from "./products.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Product } from "./products.entity";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { UserRole } from "src/users/users.entity";

describe('ProductService', () => {
    let service: ProductService;
    let product_rep;

    const mockProductRep = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        softDelete: jest.fn()
    }

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [ProductService, 
                {provide: getRepositoryToken(Product), useValue: mockProductRep}],
            
        }).compile()

        service = module.get(ProductService)
        product_rep = module.get(getRepositoryToken(Product))
    })

    afterEach(() => {
        jest.clearAllMocks();
    })

    
    // Тесты на создание продукта
    it('Долнжо успешно создать продукт!', async () => {
        const dto = { title: "prod1", description: "desc1", price: 1500, image: 'dedew', count: 5}
        const admin_id = 2
        product_rep.findOne.mockResolvedValue(null)

        product_rep.create.mockResolvedValue(dto)
        product_rep.save.mockResolvedValue({id: 5, title: "prod1", description: "desc1", 
            price: 1500, image: 'dedew', count: 5, creator_id: 2, creator: {id: 2}, deletedAt: null})
        
        const result = await service.create_product({title: "prod1", description: "desc1", 
            price: 1500, image: 'dedew', count: 5}, 1)

        expect(result).toEqual({id: 5, title: "prod1", description: "desc1",
             price: 1500, image: 'dedew', count: 5, creator_id: 2, creator: {id: 2}, deletedAt: null})
        
        expect(product_rep.findOne).toHaveBeenCalled();
        expect(product_rep.create).toHaveBeenCalled();
        expect(product_rep.save).toHaveBeenCalled();
    })

    it('Должно вывести ConflictException если продукт с таким названием существует', async () => {
        const mockprod = await product_rep.findOne.mockResolvedValue({id: 5, title: "prod1"})

        await expect(service.create_product({title: "prod1", description: "desc1", price: 1500, image: 'dedew', count: 5}, 1))
        .rejects.toThrow(ConflictException);

        expect(product_rep.save).not.toHaveBeenCalled();
    })


    // Тесты на обновление продукта
    it('Должно успешно обновить продукт', async () => {
        const dto = {title:"prod2"}
        const id = 1
        const seller_id = 1
        product_rep.findOne.mockResolvedValue({id: 1, title: "prod1", creator: {id: 1}})
        product_rep.save.mockImplementation((val) => Promise.resolve({...val, ...dto}))

        const result = await service.update_product(id, dto, seller_id, UserRole.ADMIN)

        expect(result.title).toEqual(dto.title)

        expect(product_rep.findOne).toHaveBeenCalled();
        expect(product_rep.save).toHaveBeenCalled();
    })

    it('Должно вывести NotFoundException если товар не найден', async () => {
        const mocked = await product_rep.findOne.mockResolvedValue(null)

        await expect(service.update_product(1, {title: "prod1"}, 1, UserRole.SELLER))
        .rejects.toThrow(NotFoundException)

        expect(product_rep.save).not.toHaveBeenCalled();
    })

    it('Должно вывести BadRequestException если у товара нету создателя', async () => {
        const mocked = await product_rep.findOne.mockResolvedValue({id: 1, creator: null})

        await expect(service.update_product(1, {title: "prod3"}, 2, UserRole.SELLER))
        .rejects.toThrow(BadRequestException)
    })

    it('Должно вывести ForbiddenException если товар чужой или не админ ты', async () => {
        const product = {id: 1, creator: {id: 5}}

        product_rep.findOne.mockResolvedValue(product)

        await expect(service.update_product(1, {title: "prod1"}, 3, UserRole.SELLER))
        .rejects.toThrow(ForbiddenException)

        expect(product_rep.save).not.toHaveBeenCalled();
    })


    // Тесты на удаление продукта
    it('Должно успешно удалить продукт', async () => {
        await product_rep.findOne.mockResolvedValue({id: 5, creator: {id: 2}})
        const mocked = {"message": "Продукт успешно удален!"}
        const result = await service.delete_product(5, 2, UserRole.SELLER)

        expect(result).toEqual(mocked)
        expect(product_rep.findOne).toHaveBeenCalled();
        expect(product_rep.softDelete).toHaveBeenCalled();
    })

    it('Должно вывести NotFoundException если товар не найден', async () => {
        await product_rep.findOne.mockResolvedValue(null)

        await expect(service.delete_product(5, 2, UserRole.SELLER)).rejects.toThrow(NotFoundException);
        expect(product_rep.softDelete).not.toHaveBeenCalled();
    })

    it('Должно вывести ошибку, если у товара нету создателя', async () =>{
        const product = await product_rep.findOne.mockResolvedValue({id: 5, creator: null})

        await expect(service.delete_product(5, 2, UserRole.SELLER)).rejects.toThrow(BadRequestException);
        expect(product_rep.softDelete).not.toHaveBeenCalled();
    })

    it('Должно вывести ForbiddenException если не ты создатель или админ', async () => {
        const product = await product_rep.findOne.mockResolvedValue({id: 5, creator: {id: 2, role: UserRole.SELLER}})

        await expect(service.delete_product(5, 3, UserRole.SELLER)).rejects.toThrow(ForbiddenException);
        expect(product_rep.softDelete).not.toHaveBeenCalled();
    })
})