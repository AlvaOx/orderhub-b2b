import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

// Valida el cuerpo de una petición con un esquema Zod (normalmente de @orderhub/shared).
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    return result.data;
  }
}
