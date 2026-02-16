import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "./products.entity";
import { ProductController } from "./products.controller";
import { ProductService } from "./products.service";
import { AuthModule } from "src/auth/auth.module";

@Module({
    imports: [TypeOrmModule.forFeature([Product]), AuthModule],
    controllers: [ProductController],
    providers: [ProductService],
    exports: [ProductService]
})

export class ProductModule {}