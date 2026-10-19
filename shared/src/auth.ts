import { z } from 'zod';

export const roleSchema = z.enum(['admin', 'vendedor', 'bodega']);
export type Role = z.infer<typeof roleSchema>;

// Lo que envía el formulario de login.
export const loginSchema = z.object({
  email: z.email('Correo inválido'),
  password: z.string().min(8, 'La clave debe tener al menos 8 caracteres'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Lo que el backend devuelve sobre el usuario autenticado.
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenant: { id: string; name: string };
};
