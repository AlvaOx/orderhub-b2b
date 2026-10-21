import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  type RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { Public } from '../auth/public.decorator.js';
import { PaymentsService } from './payments.service.js';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  // POST /api/webhooks/fake-pay  ->  200 { received: true }
  // Público (la pasarela no tiene sesión); la seguridad es la firma HMAC.
  @Public()
  @Post('fake-pay')
  @HttpCode(HttpStatus.OK)
  async fakePay(@Req() request: RawBodyRequest<Request>): Promise<{ received: true }> {
    if (!request.rawBody) {
      throw new BadRequestException('Cuerpo vacío');
    }
    await this.payments.handleWebhook(request.rawBody, request.headers);
    return { received: true };
  }
}
