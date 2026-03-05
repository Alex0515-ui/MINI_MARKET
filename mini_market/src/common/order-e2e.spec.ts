import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import * as request from 'supertest'
import { DataSource } from 'typeorm';


describe('Order system', () => {
    let app: INestApplication;
    let data_source: DataSource;
    let token: string;

    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [AppModule]
        })
    })

    
})