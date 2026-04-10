export type ErrandCategory = 'shopping' | 'delivery' | 'waiting' | 'custom';

export interface Errand {
  id: string;
  category: ErrandCategory;
  title: string;
  description: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';
  price: number | string;
  timestamp: number;
  location: string;
  pickupLocation?: string;
  dropLocation?: string;
  pickupCoords?: [number, number];
  dropCoords?: [number, number];
  routePoints?: [number, number][];
  imageUrl?: string;
  scheduledAt?: number;
  duration?: number;
}

export const CATEGORIES = [
  {
    id: 'shopping',
    title: 'Personal Shopping',
    description: 'Groceries, gifts, or retail items',
    icon: 'ShoppingBag',
    color: 'bg-blue-500',
    image: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?auto=format&fit=crop&q=80&w=800',
  },
  {
    id: 'delivery',
    title: 'Pickup & Delivery',
    description: 'Packages, documents, or forgotten items',
    icon: 'Package',
    color: 'bg-green-500',
    image: 'https://images.unsplash.com/photo-1566576721346-d4a3b4eaad5b?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'waiting',
    title: 'Standing in Line',
    description: 'Concerts, DMV, or limited releases',
    icon: 'Clock',
    color: 'bg-orange-500',
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'custom',
    title: 'Custom Errand',
    description: 'Anything else you need help with',
    icon: 'Plus',
    color: 'bg-purple-500',
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&q=80&w=400',
  },
];
