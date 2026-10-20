// Un producto del catálogo de la empresa (para elegirlo al crear un pedido).
export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
};
