import { CallHandler, ExecutionContext, Injectable, NestInterceptor, NotFoundException } from "@nestjs/common";
import { map, Observable } from "rxjs";

export interface Data<T> {
    data: T;
}

@Injectable() // Красивая обертка : {data: ""}
export class DataInterceptor<T> implements NestInterceptor<T, Data<T>> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<Data<T>> | Promise<Observable<Data<T>>> {
        return next.handle().pipe(map( data => ({data}) ));
    }
}

@Injectable() // Обертка если ответ будет NULL
export class ExcludeNullInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
        return next.handle().pipe(map(value => {
            if (value === null) {
                throw new NotFoundException("Данные не найдены")
            }
            return value
        }))
    }
}





