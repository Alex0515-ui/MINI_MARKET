import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "./products.entity";
import { Repository } from "typeorm";
import { CreateProductDTO, ProductFilterDTO, UpdateProductDTO } from "./products.dto";
import { PaginationDTO } from "src/common/pagination.dto";
import { UserRole } from "src/users/users.entity";


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
    async get_product(id: number) {
        const product = await this.repo.findOne({where: {id}, relations: [ 'creator']})
        if (!product) {
            throw new NotFoundException("Продукта с таким ID нету!")
        }
        if (product.creator == null) throw new BadRequestException("У товара нету создателя")
            
        return {
            id: product.id,
            title: product.title,
            description: product.description,
            image: product.image,
            price: product.price
        }
    }

    // Получение всех продуктов
    async get_all_products(dto: PaginationDTO) {
        const {limit = 10, offset = 0} = dto // Пагинация
        const [data, total] = await this.repo.findAndCount({
            take: limit,
            skip: offset,
            order: {id: 'DESC'}
        })
        return {
            products: data,
            count: total,
            nextPage: total > limit + offset ? limit + offset : null
        }
    }

    // Получение админом продукта (Для проверки на складе)
    async get_product_by_seller(id: number, admin_id: number, role: UserRole) {
        const product = await this.repo.findOne({where: {id}, select: ["id", "title", "description", "image", "price", "count"]})
        if (!product) {
            throw new NotFoundException("Такого продукта нету")
        }
        if (product.creator.id != admin_id && role !== UserRole.ADMIN) {
            throw new ForbiddenException("Нельзя посмотреть товар другого админа!")
        }
        return product
    }

    // Получение продавцом продуктов с фильтрацией и пагинацией (Для проверки на складе и отчетов)
    async get_products_by_seller(seller_id: number, dto: ProductFilterDTO) {
        const { limit = 10, offset = 0, minValue, maxValue } = dto
        
        const product_query = this.repo.createQueryBuilder('prod')
        .innerJoin('prod.creator', 'user')
        .where('user.id = :seller_id', {seller_id})
        
        if (minValue) {
            product_query.andWhere('prod.price >= :minValue', {minValue})
        }
        if (maxValue) {
            product_query.andWhere('prod.price <= :maxValue', {maxValue})
        }
        
        product_query.take(limit).skip(offset).orderBy('prod.id', 'DESC')
        
        return product_query.getMany()
    }

    // Обновление продукта
    async update_product(id: number, dto: UpdateProductDTO, seller_id: number, role: UserRole): Promise<Product> {
        const product = await this.repo.findOne({where: {id}, relations: ['creator']})

        if (!product) {
            throw new NotFoundException(`Товара №${id} нету на складе`)
        }
        if (!product.creator) {
            throw new BadRequestException("У товара нету создателя")
        }
        if (product.creator.id !== seller_id && role !== UserRole.ADMIN) {
            throw new ForbiddenException("Нельзя изменить чужой товар!")
        }   

        Object.assign(product, dto);
        return await this.repo.save(product);
    }

    // Удаление продукта
    async delete_product(id: number, seller_id: number, role: UserRole) {
        const product = await this.repo.findOne({where: {id}, relations: ['creator']})

        if (!product) {
            throw new NotFoundException(`Продукт №${id} не найден`)
        }
        if (!product.creator) {
        throw new BadRequestException("У товара нет создателя");
        }

        if (product.creator.id !== seller_id && role !== UserRole.ADMIN) {
            throw new ForbiddenException("Нельзя удалить товар чужого продавца")
        }
        
        await this.repo.softDelete(id)  // Чтобы в любых прошлых заказов было видно его
        
        return {"message": "Продукт успешно удален!"}
    }

    
}