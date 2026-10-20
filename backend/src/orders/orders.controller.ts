import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type AdvanceOrderStatusInput,
  advanceOrderStatusSchema,
  type CreatedOrder,
  type CreateOrderInput,
  createOrderSchema,
  type ListOrdersQuery,
  listOrdersQuerySchema,
  type OrderDetail,
  orderNumberParamSchema,
  type OrdersPage,
} from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { OrdersService } from './orders.service.js';

const orderNumberPipe = new ZodValidationPipe(orderNumberParamSchema);

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

  // GET /api/orders/10001  ->  detalle con ítems e historial. 404 si no existe o no te corresponde.
  @RequirePermissions('orders:read')
  @Get(':number')
  findByNumber(
    @Param('number', orderNumberPipe) number: number,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<OrderDetail> {
    return this.orders.findByNumber(user, number);
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

  // PATCH /api/orders/10001/status  { status: "despachado" }  ->  detalle actualizado
  @RequirePermissions('orders:update_status')
  @Patch(':number/status')
  advanceStatus(
    @Param('number', orderNumberPipe) number: number,
    @Body(new ZodValidationPipe(advanceOrderStatusSchema)) body: AdvanceOrderStatusInput,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<OrderDetail> {
    return this.orders.advanceStatus(user, number, body.status);
  }

  // POST /api/orders/10001/cancel  ->  detalle actualizado (y el stock devuelto)
  @RequirePermissions('orders:cancel')
  @Post(':number/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('number', orderNumberPipe) number: number,
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<OrderDetail> {
    return this.orders.cancel(user, number);
  }
}
