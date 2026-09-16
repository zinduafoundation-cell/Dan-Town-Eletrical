export type CartItem = { images?: string[]; productId : string;slug : string;name : string;sku : string;unitPrice : number;imageUrl : string | null;quantity : number;stockStatus : "In stock" | "Low stock" | "Out of stock" | "Available on order";
};export type Cart = {items : CartItem[];addItem : (item: CartItem) => void;removeItem : (productId: string) => void;updateQuantity : (productId: string, quantity: number) => void;clearCart : () => void;getTotalCount : () => number;getSubtotal : () => number;getTotal : () => number;
};
