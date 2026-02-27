import * as bcrypt from 'bcrypt'

// Хэширование пароля
export const  hashPassword = async (password: string) => { 
    const salt = 10
    return await bcrypt.hash(password, salt)
}

// Сравнение паролей
export const comparePasswords = async (password: string, hash: string): Promise<boolean> => { 
    return await bcrypt.compare(password, hash)
}