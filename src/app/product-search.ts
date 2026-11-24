import { Product } from './products';

type SortOrder = 'featured' | 'price-asc' | 'price-desc';

interface TrieNode {
  children: Map<string, TrieNode>;
  productNames: Set<string>;
}

function createTrieNode(): TrieNode {
  return { children: new Map(), productNames: new Set() };
}

export class ProductSearchEngine {
  private readonly root = createTrieNode();
  private readonly productsByName = new Map<string, Product>();
  private readonly productsByPrice = new Map<number, Set<string>>();

  constructor(products: Product[]) {
    for (const product of products) {
      this.productsByName.set(product.name, product);
      const productNames = this.productsByPrice.get(product.price) ?? new Set<string>();
      productNames.add(product.name);
      this.productsByPrice.set(product.price, productNames);

      const category = product.category.toLowerCase();
      const terms = `${product.name} ${category} ${category.slice(0, -1)}`;
      for (const term of terms.toLowerCase().split(/\s+/).filter(Boolean)) {
        this.insert(term, product.name);
      }
    }
  }

  search(query: string): Product[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];

    let matchingNames: Set<string> | undefined;
    for (const term of terms) {
      const names = this.findPrefix(term);
      if (!names) return [];
      matchingNames = matchingNames
        ? new Set([...matchingNames].filter((name) => names.has(name)))
        : new Set(names);
      if (!matchingNames.size) return [];
    }

    return [...(matchingNames ?? [])]
      .map((name) => this.productsByName.get(name))
      .filter((product): product is Product => product !== undefined);
  }

  filterByPrice(products: Product[], min: number, max: number): Product[] {
    if (min > max) return [];

    const matchingNames = new Set<string>();
    for (const [price, names] of this.productsByPrice) {
      if (price >= min && price <= max) {
        for (const name of names) matchingNames.add(name);
      }
    }
    return products.filter((product) => matchingNames.has(product.name));
  }

  rank(products: Product[], order: SortOrder): Product[] {
    const compare = (left: Product, right: Product): number => {
      if (order === 'price-asc') return left.price - right.price;
      if (order === 'price-desc') return right.price - left.price;
      return Number(Boolean(right.popular)) - Number(Boolean(left.popular))
        || Number(Boolean(right.recent)) - Number(Boolean(left.recent));
    };
    return this.mergeSort(products, compare);
  }

  private insert(term: string, productName: string): void {
    let node = this.root;
    for (const character of term) {
      let child = node.children.get(character);
      if (!child) {
        child = createTrieNode();
        node.children.set(character, child);
      }
      child.productNames.add(productName);
      node = child;
    }
  }

  private findPrefix(prefix: string): Set<string> | undefined {
    let node = this.root;
    for (const character of prefix) {
      const child = node.children.get(character);
      if (!child) return undefined;
      node = child;
    }
    return node.productNames;
  }

  private mergeSort<T>(items: T[], compare: (left: T, right: T) => number): T[] {
    if (items.length < 2) return [...items];

    const middle = Math.floor(items.length / 2);
    const left = this.mergeSort(items.slice(0, middle), compare);
    const right = this.mergeSort(items.slice(middle), compare);
    const sorted: T[] = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
      if (compare(left[leftIndex], right[rightIndex]) <= 0) {
        sorted.push(left[leftIndex++]);
      } else {
        sorted.push(right[rightIndex++]);
      }
    }
    return sorted.concat(left.slice(leftIndex), right.slice(rightIndex));
  }
}
