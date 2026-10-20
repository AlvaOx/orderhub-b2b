import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  type CreatedOrder,
  type CreateOrderInput,
  createOrderSchema,
  type ListOrdersQuery,
  listOrdersQuerySchema,
  type OrdersPage,
} from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // GET /api/orders?cursor=&limit=&status=&sellerId=&number=
  @RequirePermissions('orders:read')
  @Get()
  list(
    @Query(new ZodValidationPipe(listOrdersQuerySchema)) query: ListOrdersQuery,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<OrdersPage> {
    return this.orders.list(user, query);
  }

  // POST /api/orders  { items: [{ productId, quantity }] }  ->  201 { id, number }
  @RequirePermissions('orders:create')
  @Post()
  create(
    @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<CreatedOrder> {
    return this.orders.create(user, body);
  }
}
