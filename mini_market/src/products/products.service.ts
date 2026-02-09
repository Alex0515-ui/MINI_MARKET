import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "./products.entity";
import { Repository } from "typeorm";
import { CreateProductDTO, UpdateProductDTO } from "./products.dto";


@Injectable()
export class ProductService {

    constructor(@InjectRepository(Product) 
    private readonly repo: Repository<Product>) {}

    // Создание продукта
    async create_product(dto: CreateProductDTO): Promise<Product> {
        const product_exists = await this.repo.findOne({where: {title: dto.title}})

        if (product_exists) {
            throw new ConflictException("Продукт с таким названием уже существует! Попробуйте изменить название")
        }

        const product = this.repo.create(dto)
        const saved = await this.repo.save(product)
        return saved
    }

    // Получение одного продукта
    async get_product(id: number): Promise<Product> {
        const product = await this.repo.findOne({where: {id}})
        if (!product) {
            throw new NotFoundException("Продукта с таким ID нету!")
        }
        return product
    }

    // Получение всех продуктов
    async get_all_products() {
        const products = await this.repo.find({ take: 20, skip: 0, order: {id: 'DESC'}}) // Пагинация
        return products
    }

    // Обновление продукта
    async update_product(id: number, dto: UpdateProductDTO): Promise<Product> {
        const product = await this.get_product(id);
        Object.assign(product, dto);
        return await this.repo.save(product);
    }

    // Удаление продукта
    async delete_product(id: number) {
        const product = await this.get_product(id)
        await this.repo.remove(product)
        
        return {"message": "Продукт успешно удален!"}
    }

}