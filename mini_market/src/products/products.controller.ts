import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from "@nestjs/common";
import { ProductService } from "./products.service";
import { CreateProductDTO, UpdateProductDTO } from "./products.dto";
import { JwtGuard, RoleGuard } from "src/auth/guards/guards.guard";
import { AdminAuth, Role } from "src/auth/auth.dto";

@Controller('products')
export class ProductController {

    constructor(private readonly product_service: ProductService) {}

    @AdminAuth()
    @Post() // Создание
    create_prod(@Body() dto: CreateProductDTO) {
        return this.product_service.create_product(dto)
    }
    
    @Get(":id") // Получение одного
    get_prod(@Param('id', ParseIntPipe) id: number) {
        return this.product_service.get_product(id)
    }

    @Get() // Получение всех
    get_all_prod() {
        return this.product_service.get_all_products()
    }

    @AdminAuth()
    @Put(':id/update') // Обновление
    update_prod(
     @Param('id', ParseIntPipe) id: number,
     @Body() dto: UpdateProductDTO
    ) {
        return this.product_service.update_product(id, dto)
    }

    @AdminAuth()
    @Delete(":id/delete") // Удаление
    delete_prod(@Param('id', ParseIntPipe) id: number) {
        return this.product_service.delete_product(id)
    }

}