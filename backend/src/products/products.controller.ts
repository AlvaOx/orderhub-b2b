import { Controller, Get } from '@nestjs/common';
import type { ProductListItem } from '@orderhub/shared';

import type { AccessTokenPayload } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { RequirePermissions } from '../auth/require-permissions.decorator.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // GET /api/products
  @RequirePermissions('products:read')
  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<ProductListItem[]> {
    return this.products.list(user);
  }
}
