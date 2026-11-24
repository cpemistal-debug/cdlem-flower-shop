export type Category = 'Flower' | 'Bouquet Flowers' | 'Potted Flowers';

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
  { name: 'Flower', blurb: 'Single flowers and stems', image: '/images/single_flowers/banner.png' },
  { name: 'Bouquet Flowers', blurb: 'Bouquets wrapped by hand', image: '/images/boquet/assorted-wobg.png' },
  { name: 'Potted Flowers', blurb: 'Potted and hanging flowers', image: '/images/desk_potted/tulip_potted.png' },
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
  { name: 'Coral Rose Assorted Planter', price: 48, stock: 6, category: 'Potted Flowers', emoji: '', image: '/images/desk_potted/coralroseassorted-wobg.png', popular: true, recent: true },
  { name: 'Parrot Tulips in Blue Vase', price: 42, stock: 8, category: 'Potted Flowers', emoji: '', image: '/images/desk_potted/parrottulips-wobg.png' },
  { name: 'Pink and White Rose Planter', price: 46, stock: 4, category: 'Potted Flowers', emoji: '', image: '/images/desk_potted/pinkwithwhiterose-wobg.png', popular: true },
  { name: 'Pink Tulips in Plastic Pot', price: 32, stock: 10, category: 'Potted Flowers', emoji: '', image: '/images/desk_potted/plastic-wobg.png', recent: true },
  { name: 'Pink Tulips in Vase', price: 35, stock: 9, category: 'Potted Flowers', emoji: '', image: '/images/desk_potted/tulip_potted.png' },
  { name: 'Decorative Potted Tulips', price: 37, stock: 6, category: 'Potted Flowers', emoji: '', image: '/images/desk_potted/tulip_potted_wbg.png' },
  { name: 'Azalea Hanging Basket', price: 45, stock: 5, category: 'Potted Flowers', emoji: '', image: '/images/hangin_pot/azaleas.png', popular: true },
  { name: 'Ivy Geranium Hanging Basket', price: 39, stock: 6, category: 'Potted Flowers', emoji: '', image: '/images/hangin_pot/ivy_geraniums.png' },
  { name: 'Wisteria Hanging Basket', price: 50, stock: 4, category: 'Potted Flowers', emoji: '', image: '/images/hangin_pot/wisteria.png', recent: true },
];
