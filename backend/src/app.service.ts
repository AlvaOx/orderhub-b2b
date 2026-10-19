import { Injectable } from '@nestjs/common';
import { orderStatusSchema, type OrderStatus } from '@orderhub/shared';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getOrderStatuses(): OrderStatus[] {
    return orderStatusSchema.options;
  }
}
