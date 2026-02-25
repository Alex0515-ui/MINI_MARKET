import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseInterceptors } from "@nestjs/common";
import { ProductService } from "./products.service";
import { CreateProductDTO, ProductFilterDTO, UpdateProductDTO } from "./products.dto";
import { AdminAuth} from "src/auth/auth.dto";
import { DataInterceptor, ExcludeNullInterceptor } from "src/common/interceptors";
import { PaginationDTO } from "src/common/pagination.dto";

@Controller('products')
export class ProductController {

    constructor(private readonly product_service: ProductService) {}

    @AdminAuth()
    @Post() // Создание
    create_prod(@Body() dto: CreateProductDTO, @Req() req) {
        return this.product_service.create_product(dto, req.user.id)
    }

    @AdminAuth()
    @UseInterceptors(DataInterceptor)
    @Get("admin") // Получение всех админом
    get_all_prod_admin(@Req() req, @Query() dto: ProductFilterDTO) {
        return this.product_service.get_products_by_admin(req.user.id, dto)
    }

    @Get(":id") // Получение одного
    @UseInterceptors(ExcludeNullInterceptor)
    get_prod(@Param('id', ParseIntPipe) id: number) {
        return this.product_service.get_product(id)
    }

    @Get() // Получение всех
    @UseInterceptors(DataInterceptor)
    get_all_prod(@Query() dto: PaginationDTO) {
        return this.product_service.get_all_products(dto)
    }

    @AdminAuth()
    @UseInterceptors(ExcludeNullInterceptor)
    @Get(":id/admin") // Получение одного админом
    get_prod_admin(@Param('id', ParseIntPipe) id: number, @Req() req) {
        return this.product_service.get_product_by_admin(id, req.user.id)
    }

    @AdminAuth()
    @UseInterceptors(DataInterceptor)
    @Put(':id/update') // Обновление
    update_prod(
     @Param('id', ParseIntPipe) id: number,
     @Body() dto: UpdateProductDTO,
     @Req() req
    ) {
        return this.product_service.update_product(id, dto, req.user.id)
    }

    @AdminAuth()
    @Delete(":id/delete") // Удаление
    delete_prod(@Param('id', ParseIntPipe) id: number, @Req() req) {
        return this.product_service.delete_product(id, req.user.id)
    }

}