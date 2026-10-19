import { redirect } from 'next/navigation';

// La raíz lleva directo a pedidos (el proxy manda al login si no hay sesión).
export default function Home() {
  redirect('/pedidos');
}
