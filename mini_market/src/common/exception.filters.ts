import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { QueryFailedError } from "typeorm";

@Catch(HttpException)
export class MyGlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter')

    catch(exception: HttpException | any, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const request = ctx.getRequest();
        const response = ctx.getResponse();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | object = "Internal server error"

        if (exception instanceof HttpException) {           // Для обычных ошибок
            status = exception.getStatus();
            const res = exception.getResponse();
            message = typeof res === 'object' ? res['message'] || res : res;
        }
        else if (exception instanceof QueryFailedError) {   // Для ошибок в БД
            status = HttpStatus.BAD_REQUEST;
            message = "Ошибка в базе данных: " + exception.message;
            this.logger.error(`БД Ошибка: ${exception.message}` )
        }
        else {                                              // Остальные ошибки
            this.logger.error(`Неизвестная ошибка: ${exception.message}`, exception.stack)
        }

        response.status(status).json({
            success: false,
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message: message
        });
    }
}