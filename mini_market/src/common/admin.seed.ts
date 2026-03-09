import 'dotenv/config'
import { User, UserRole } from "../users/users.entity";
import { DataSource } from "typeorm";
import { hashPassword } from "./password.fn";
import { Wallet } from '../payment/payment.entity';

// Функция создания админа(в проекте должен быть 1 всего), так как обычно пользователь регистрируется с ролью user
async function seedAdmin() {

    const data_source = new DataSource({
        type:"postgres",
        host: 'localhost',
        port: 5432,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        entities: [User, Wallet],
        synchronize: false,
    })

    await data_source.initialize();

    const user_repo = data_source.getRepository(User)

    const exists = await user_repo.findOne({where: {name: "admin"}})

    if (exists) {
        console.log("Admin already exists")
        return 
    }
    const hashed = await hashPassword("123456")
    const admin = user_repo.create({
        name: "admin",
        password: hashed,
        role: UserRole.ADMIN,
        wallet: {balance: 0}
    })
    
    await user_repo.save(admin)
    await data_source.destroy();
}

seedAdmin()