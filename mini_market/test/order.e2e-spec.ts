import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing';
import { AppModule } from 'src/app.module';
import { User, UserRole } from 'src/users/users.entity';
import  request from 'supertest'
import { DataSource } from 'typeorm';
import { hashPassword } from '../src/common/password.fn';
import { Wallet } from 'src/payment/payment.entity';
import { Product } from 'src/products/products.entity';
import { Order, Status } from 'src/orders/order.entity';


describe('Order system', () => {
    let app: INestApplication;
    let data_source: DataSource;
    let token: string;
    let prod1 = {
        title: "product1",
        description: "desc1",
        image: "eelelwlgdfswefrtheewe",
        price: 5000,
        count: 15
    }
    let prod2 = {
        title: "product2",
        description: "desc2",
        image: "eelelwlgdfswefrtheewe",
        price: 5000,
        count: 15
    }
    
    beforeAll(async () => {
        const module = await Test.createTestingModule({
            imports: [AppModule]
        }).compile()

        app = module.createNestApplication();
        await app.init();
        data_source = app.get(DataSource)   
    })

    beforeEach(async () => {
        await data_source.query('TRUNCATE "order", "user", "product", "wallet" RESTART IDENTITY CASCADE');
        const hashed = await hashPassword("123456")
        const admin_wallet = data_source.manager.create(Wallet, { balance: 0})
        const admin = data_source.manager.create(User, {name: "admin", password: hashed, role: UserRole.ADMIN, wallet: admin_wallet})
        await data_source.manager.save(User, admin)
        await data_source.manager.save(Wallet, admin_wallet)
    })

    afterAll(async () => {
        await app.close()
    })

    it('Авторизованный пользователь создает заказ, после чего оплатив получает его', async () => {
        const user = await request(app.getHttpServer()).post("/users")               // Регистрируем пользователя
        .send({name: "testuser1", password: "123456"}).expect(201)

        const login = await request(app.getHttpServer()).post("/auth/login")    // Авторизуем его
        .send({name: "testuser1", password: "123456"}).expect(201)

        token = login.body.access_token;

        const fill_wallet = await request(app.getHttpServer())                 // Пополняем кошелек
        .patch("/wallet/fill").set('Authorization', `Bearer ${token}`) 
        .send({amount: 50000}).expect(200)

        const admin_login = await request(app.getHttpServer())                 // Авторизуем админа
        .post("/auth/login").send({name: "admin", password: "123456"}).expect(201)

        const admin_token = admin_login.body.access_token;

        const seller = await request(app.getHttpServer())                      // Регистрируем будущего продавца
        .post("/users").send({name: "seller", password: "123456"}).expect(201)

        const update_role = await request(app.getHttpServer())                 // Повышаем его до продавца
        .patch(`/users/${seller.body.id}/role`) 
        .set('Authorization', `Bearer ${admin_token}`).send({role: UserRole.SELLER})

        const loginSeller = await request(app.getHttpServer())                 // Авторизуем его тоже
        .post("/auth/login")   
        .send({name: "seller", password: "123456"}).expect(201)

        const seller_token = loginSeller.body.access_token;

        const product1 = await request(app.getHttpServer())                    // Создаем 1 продукт
        .post("/products")
        .set('Authorization', `Bearer ${seller_token}`).send(prod1).expect(201)

        const product2 = await request(app.getHttpServer())                    // Создаем 2 продукт
        .post("/products")
        .set('Authorization', `Bearer ${seller_token}`).send(prod2).expect(201)

        let order = {
            basket: [
                {
                    product_id: product1.body.id,
                    quantity: 1
                },
                {
                    product_id: product2.body.id,
                    quantity: 1
                }
            ]
        }
        const create_order = await request(app.getHttpServer())                // Создаем заказ
        .post("/orders/create").set('Authorization', `Bearer ${token}`)
        .send(order).expect(201)

        const orderId = create_order.body.id

        const confirm_order = await request(app.getHttpServer())               // Оплачиваем его
        .patch(`/orders/${orderId}/confirm`)
        .set('Authorization', `Bearer ${token}`).send().expect(200)

        const complete_order = await request(app.getHttpServer())              // Завершаем его 
        .patch(`/orders/${orderId}/complete`).set('Authorization', `Bearer ${admin_token}`)
        .send().expect(200)

        const check_user_wallet = await request(app.getHttpServer())           // Проверяем кошелек пользователя
        .get("/wallet/my").set('Authorization', `Bearer ${token}`)
        .send().expect(200)
        
        const check_seller_wallet = await request(app.getHttpServer())         // Проверяем кошелек продавца
        .get("/wallet/my").set('Authorization', `Bearer ${seller_token}`)
        .send().expect(200)
       
        const check_admin_wallet = await request(app.getHttpServer())          // Проверяем кошелек админа
        .get("/wallet/my").set('Authorization', `Bearer ${admin_token}`)
        .send().expect(200)

        expect(check_user_wallet.body.data.balance).toEqual(40000)
        expect(check_seller_wallet.body.data.balance).toEqual(9500)
        expect(check_admin_wallet.body.data.balance).toEqual(500)
    })

    it('Должно вернуть ошибку если недостаточно средств', async () => {
        const hashed = await hashPassword("123456")
        const wallet = await data_source.manager.save(Wallet, {balance: 500})
        const user = await data_source.manager.save(User, {name: 'us1', password: hashed, role: UserRole.USER, wallet: wallet})

        const order = await data_source.manager.save(Order, {
            user_id: user.id,
            amount: "2000",
            status: Status.PENDING
        })

        const login = await request(app.getHttpServer()).post("/auth/login").send({name: "us1", password: "123456"});
        const token = login.body.access_token;

        const res = await request(app.getHttpServer()).patch(`/orders/${order.id}/confirm`)
        .set('Authorization', `Bearer ${token}`).send();
        console.log(res.body)
        expect(res.status).toBe(400)

    })

    it('Должно вернуть ошибку если нету товара не хватает на складе', async () => {
        const hashed = await hashPassword("123456")
        const seller = await data_source.manager.save(User, {name: "sel1", password: hashed, role: UserRole.SELLER})
        const product = await data_source.manager.save(Product, {title: "prod1", description: "des1", price: 1500, image: "1", count: 3, creator: seller})
        const user = await data_source.manager.save(User, {name: "user1", password: hashed, role: UserRole.USER})

        let order1 = {
            basket: [
                {
                    product_id: product.id,
                    quantity: 5
                }  
            ]
        }

        const login = await request(app.getHttpServer()).post("/auth/login")
        .send({name: "user1", password: "123456"}).expect(201)
        const token = login.body.access_token

        const order_res = await request(app.getHttpServer()).post("/orders/create")
        .set('Authorization', `Bearer ${token}`).send(order1)

        expect(order_res.status).toBe(409)
    })
    
})