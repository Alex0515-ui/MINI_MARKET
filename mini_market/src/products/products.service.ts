import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "./products.entity";
import { Not, Repository } from "typeorm";
import { CreateProductDTO, UpdateProductDTO } from "./products.dto";


@Injectable()
export class ProductService {

    constructor(@InjectRepository(Product) 
    private readonly repo: Repository<Product>) {}

    // Создание продукта
    async create_product(dto: CreateProductDTO, admin_id: number): Promise<Product> {
        const product_exists = await this.repo.findOne({where: {title: dto.title}})

        if (product_exists) {
            throw new ConflictException("Продукт с таким названием уже существует! Попробуйте изменить название")
        }

        const product = this.repo.create({...dto, creator: {id: admin_id}})
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

    // Получение с количеством на складе
    async get_product_with_count(id: number) {
        const product = await this.repo.findOne({
            where: {id}, 
            select: ['id', 'title', 'description', 'image', 'price', 'count']
        })
        if (!product) {
            throw new NotFoundException("Такого продукта нету")
        }
        return product
    }

    // Получение всех продуктов
    async get_all_products() {
        const products = await this.repo.find({ take: 20, skip: 0, order: {id: 'DESC'}}) // Пагинация
        return products
    }

    // Получение админом продукта (Для проверки на складе)
    async get_product_by_admin(id: number, admin_id: number) {
        const product = await this.repo.findOne({where: {id}, select: ["id", "title", "description", "image", "price", "count"]})
        if (!product) {
            throw new NotFoundException("Такого продукта нету")
        }
        if (product.creator.id != admin_id) {
            throw new ForbiddenException("Нельзя посмотреть товар другого админа!")
        }
        return product
    }

    // Получение админом продуктов (Для проверки на складе и отчетов)
    async get_products_by_admin(admin_id: number) {
        const products = await this.repo.find({where: {creator: {id: admin_id}}, select: ["id", "title", "description", "image", "price", "count"]})
        return products
    }

    // Обновление продукта
    async update_product(id: number, dto: UpdateProductDTO, admin_id: number): Promise<Product> {
        const product = await this.repo.findOne({where: {id}, relations: ['creator']})

        if (!product) {
            throw new NotFoundException(`Товара №${id} нету на складе`)
        }
        if (!product.creator) {
            throw new BadRequestException("У товара нету создателя")
        }
        if (product.creator.id !== admin_id) {
            throw new ForbiddenException("Нельзя изменить чужой товар!")
        }

        Object.assign(product, dto);
        return await this.repo.save(product);
    }

    // Удаление продукта
    async delete_product(id: number, admin_id: number) {
        const product = await this.repo.findOne({where: {id}, relations: ['creator']})

        if (!product) {
            throw new NotFoundException(`Продукт №${id} не найден`)
        }
        if (!product.creator) {
        throw new BadRequestException("У товара нет создателя");
        }
        if (product.creator.id !== admin_id) {
            throw new ForbiddenException("Нельзя удалить товар другого админа")
        }
        await this.repo.softDelete(product)
        
        return {"message": "Продукт успешно удален!"}
    }

    
}