export type Category = 'Flower' | 'Bouquet Flowers' | 'Desk Pots' | 'Hanging Pots';

export interface Product {
  name: string;
  price: number;
  stock: number;
  category: Category;
  emoji: string;
  image: string;
  popular?: boolean;
  recent?: boolean;
}

export const CATEGORIES: { name: Category; blurb: string; image: string }[] = [
  { name: 'Flower', blurb: 'Single flowers and stems', image: '/images/single_flowers/sun.png' },
  { name: 'Bouquet Flowers', blurb: 'Bouquets wrapped by hand', image: '/images/boquet/assorted-wobg.png' },
  { name: 'Desk Pots', blurb: 'Potted flowers for desks and rooms', image: '/images/desk_potted/tulip_potted.png' },
  { name: 'Hanging Pots', blurb: 'Flowers for baskets and hanging displays', image: '/images/hangin_pot/wisteria.png' },
];

export const PRODUCTS: Product[] = [
  { name: 'Assorted Flower Bouquet', price: 34, stock: 12, category: 'Bouquet Flowers', emoji: '', image: '/images/boquet/assorted-wobg.png', popular: true },
  { name: 'Hydrangea Bouquet', price: 42, stock: 8, category: 'Bouquet Flowers', emoji: '', image: '/images/boquet/hydrangea-wobg.png', popular: true, recent: true },
  { name: 'Iris and Gerbera Bouquet', price: 36, stock: 10, category: 'Bouquet Flowers', emoji: '', image: '/images/boquet/iriseswithgarbera-wobg.png' },
  { name: 'Rose Bouquet', price: 38, stock: 12, category: 'Bouquet Flowers', emoji: '', image: '/images/boquet/rose-wobg.png', popular: true },
  { name: 'Rose and Carnation Bouquet', price: 39, stock: 7, category: 'Bouquet Flowers', emoji: '', image: '/images/boquet/rosewithcarnation-wobg.png', recent: true },
  { name: 'Yellow Flower Bouquet', price: 30, stock: 9, category: 'Bouquet Flowers', emoji: '', image: '/images/boquet/yellow_boq-removebg-preview.png' },
  { name: 'Bellflower', price: 14, stock: 18, category: 'Flower', emoji: '', image: '/images/single_flowers/bellflower.png' },
  { name: 'Carnation', price: 8, stock: 22, category: 'Flower', emoji: '', image: '/images/single_flowers/carnation.png', recent: true },
  { name: 'Lobelia', price: 12, stock: 17, category: 'Flower', emoji: '', image: '/images/single_flowers/lobelia.png' },
  { name: 'Peony', price: 16, stock: 12, category: 'Flower', emoji: '', image: '/images/single_flowers/peony.png', popular: true },
  { name: 'Rose', price: 10, stock: 20, category: 'Flower', emoji: '', image: '/images/single_flowers/rose.png' },
  { name: 'Sunflower', price: 9, stock: 20, category: 'Flower', emoji: '', image: '/images/single_flowers/sun.png', recent: true },
  { name: 'Coral Rose Assorted Planter', price: 48, stock: 6, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/coralroseassorted-wobg.png', popular: true, recent: true },
  { name: 'Parrot Tulips in Blue Vase', price: 42, stock: 8, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/parrottulips-wobg.png' },
  { name: 'Pink and White Rose Planter', price: 46, stock: 4, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/pinkwithwhiterose-wobg.png', popular: true },
  { name: 'Lucky Clover', price: 28, stock: 12, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/lucky_clover.jpg', recent: true },
  { name: 'Peach Rose', price: 40, stock: 7, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/peach_rose.jpg' },
  { name: 'Pink Verbena', price: 31, stock: 10, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/pink_verbana.jpg' },
  { name: 'Rustic Wildflower', price: 44, stock: 6, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/rustic_wildflower.jpg', recent: true },
  { name: 'Terracotta Planter', price: 38, stock: 7, category: 'Desk Pots', emoji: '', image: '/images/desk_potted/terracotta_planter.jpg' },
  { name: 'Azalea Hanging Basket', price: 45, stock: 5, category: 'Hanging Pots', emoji: '', image: '/images/hangin_pot/azaleas.png', popular: true },
  { name: 'Ivy Geranium Hanging Basket', price: 39, stock: 6, category: 'Hanging Pots', emoji: '', image: '/images/hangin_pot/ivy_geraniums.png' },
  { name: 'Wisteria Hanging Basket', price: 50, stock: 4, category: 'Hanging Pots', emoji: '', image: '/images/hangin_pot/wisteria.png', recent: true },
  { name: 'Bougainvillea Hanging Pot', price: 43, stock: 8, category: 'Hanging Pots', emoji: '', image: '/images/hangin_pot/bouganvilla.jpg', popular: true, recent: true },
  { name: 'Geranium Hanging Pot', price: 37, stock: 9, category: 'Hanging Pots', emoji: '', image: '/images/hangin_pot/geranium.jpg' },
  { name: 'Susan Vine Hanging Pot', price: 41, stock: 6, category: 'Hanging Pots', emoji: '', image: '/images/hangin_pot/susan_vine.jpg', recent: true },
];
