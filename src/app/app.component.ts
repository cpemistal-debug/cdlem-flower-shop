import { Component, HostListener, OnDestroy, computed, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, registerLocaleData } from '@angular/common';
import { FormsModule } from '@angular/forms';
import localeEnPH from '@angular/common/locales/en-PH';
import {
  GoogleAuthProvider,
  Unsubscribe,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { CATEGORIES, PRODUCTS, Category, Product } from './products';
import { ProductSearchEngine } from './product-search';
import { firebaseAuth, firestore } from './core/firebase';

registerLocaleData(localeEnPH);

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending / confirming' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'picking-up', label: 'Picking up' },
  { value: 'delivering', label: 'Delivering' },
  { value: 'received', label: 'Order received' },
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number]['value'];
type FulfillmentMethod = 'delivery' | 'pickup';

interface CartItem {
  productName: string;
  quantity: number;
}

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  image: string;
}

interface ShopOrder {
  id: string;
  customerUid: string;
  customerName: string;
  fullAddress: string;
  fulfillmentMethod: FulfillmentMethod;
  contactNumbers: { primary: string; secondary: string };
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  estimatedDuration: string;
  createdAt: Timestamp | null;
}

interface OrderDraft {
  status: OrderStatus;
  estimatedDuration: string;
}

interface ProductDraft {
  price: number;
  stock: number;
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return ORDER_STATUSES.some((status) => status.value === value);
}

function isOrderItem(value: unknown): value is OrderItem {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item['productName'] === 'string'
    && typeof item['quantity'] === 'number'
    && Number.isInteger(item['quantity'])
    && item['quantity'] > 0
    && typeof item['unitPrice'] === 'number'
    && Number.isFinite(item['unitPrice'])
    && item['unitPrice'] >= 0
    && typeof item['image'] === 'string';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CurrencyPipe, DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnDestroy {
  readonly categories = CATEGORIES;
  readonly catalog = signal<Product[]>(PRODUCTS);
  readonly popular = computed(() => this.catalog().filter((p) => p.popular));
  readonly shopProducts = computed(() => this.catalog().filter(
    (p) => this.category() === 'All' || p.category === this.category(),
  ));
  readonly adminRoute = window.location.pathname.replace(/\/+$/, '') === '/cdlem-admin';
  private productSearch = new ProductSearchEngine(PRODUCTS);
  private readonly authUnsubscribe: Unsubscribe;
  private readonly productsUnsubscribe: Unsubscribe;
  private customerOrdersUnsubscribe: Unsubscribe | null = null;
  private adminOrdersUnsubscribe: Unsubscribe | null = null;

  fixed = signal(false);
  searchOpen = signal(false);
  modalOpen = signal(false);
  query = signal('');
  minPrice = signal<string | number | null>('');
  maxPrice = signal<string | number | null>('');
  sortOrder = signal<'featured' | 'price-asc' | 'price-desc'>('featured');
  category = signal<Category | 'All'>('All');
  cartItems = signal<CartItem[]>([]);
  private readonly guestCartKey = 'cdlem_guest_cart';
  cartOpen = signal(false);
  cart = computed(() => this.cartItems().reduce((count, item) => count + item.quantity, 0));
  cartLines = computed(() => {
    const products = new Map(this.catalog().map((product) => [product.name, product]));
    return this.cartItems().flatMap((item) => {
      const product = products.get(item.productName);
      return product ? [{ product, quantity: item.quantity }] : [];
    });
  });
  cartTotal = computed(() => this.cartLines().reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  ));
  productDrafts = signal<Record<string, ProductDraft>>({});
  savingProduct = signal<string | null>(null);
  productErrors = signal<Record<string, string>>({});
  catalogError = signal('');
  readonly orderStatuses = ORDER_STATUSES;
  customerOrders = signal<ShopOrder[]>([]);
  customerOrdersLoading = signal(false);
  customerOrdersError = signal('');
  adminOrders = signal<ShopOrder[]>([]);
  adminOrdersLoading = signal(false);
  adminOrdersError = signal('');
  orderDrafts = signal<Record<string, OrderDraft>>({});
  savingOrder = signal<string | null>(null);
  orderErrors = signal<Record<string, string>>({});
  orderSubmitting = signal(false);
  placeOrderError = signal('');
  fulfillmentMethod = signal<FulfillmentMethod>('delivery');
  isAdminAccount = signal(false);
  notice = signal('');
  authUser = signal<User | null>(null);
  profileStatus = signal<'signed-out' | 'checking' | 'required' | 'complete' | 'error'>('signed-out');
  profileRequired = signal(false);
  profileSaving = signal(false);
  profileName = '';
  fullAddress = '';
  primaryContact = '';
  secondaryContact = '';
  profileError = signal('');
  authError = signal('');
  adminAccess = signal<'checking' | 'signed-out' | 'checking-access' | 'authorized' | 'denied'>('checking');
  adminEmail = '';
  adminPassword = '';
  adminError = signal('');

  results = computed(() => {
    const query = this.query().trim();
    if (!query) return [];

    const min = this.priceLimit(this.minPrice(), 0);
    const max = this.priceLimit(this.maxPrice(), Infinity);
    return this.productSearch.rank(
      this.productSearch.filterByPrice(this.productSearch.search(query), min, max),
      this.sortOrder(),
    );
  });

  recent = computed(() => this.catalog().filter(
    (p) => p.recent,
  ));

  constructor() {
    this.productsUnsubscribe = onSnapshot(
      collection(firestore, 'products'),
      (snapshot) => {
        const updates = new Map<string, Pick<Product, 'price' | 'stock'>>();
        for (const productDoc of snapshot.docs) {
          const data = productDoc.data();
          if (
            data['name'] === productDoc.id
            && typeof data['price'] === 'number'
            && Number.isFinite(data['price'])
            && typeof data['stock'] === 'number'
            && Number.isInteger(data['stock'])
            && data['stock'] >= 0
          ) {
            updates.set(productDoc.id, { price: data['price'], stock: data['stock'] });
          }
        }

        const products = PRODUCTS.map((product) => ({
          ...product,
          ...updates.get(product.name),
        }));
        this.productSearch = new ProductSearchEngine(products);
        this.catalog.set(products);
        this.catalogError.set('');
      },
      (error) => this.catalogError.set(`Could not load live prices and stock: ${this.errorMessage(error)}`),
    );

    this.authUnsubscribe = onAuthStateChanged(
      firebaseAuth,
      (user) => {
        this.authUser.set(user);
        this.isAdminAccount.set(false);
        if (!user) {
          this.profileRequired.set(false);
          this.profileStatus.set('signed-out');
          this.adminAccess.set('signed-out');
          this.stopCustomerOrders();
          this.stopAdminOrders();
          this.cartItems.set(this.readGuestCart());
          return;
        }

        if (this.adminRoute) {
          this.stopCustomerOrders();
          void this.verifyAdmin(user);
        } else {
          this.stopAdminOrders();
          this.listenToCustomerOrders(user);
          void this.loadCustomerProfile(user);
          void this.loadCustomerCart(user);
        }
      },
      (error) => {
        this.authError.set(this.errorMessage(error));
        this.adminError.set(this.errorMessage(error));
        this.profileStatus.set('error');
        this.adminAccess.set('denied');
      },
    );
  }

  ngOnDestroy() {
    this.authUnsubscribe();
    this.productsUnsubscribe();
    this.customerOrdersUnsubscribe?.();
    this.adminOrdersUnsubscribe?.();
    this.setSearchOpen(false);
  }

  private readGuestCart(): CartItem[] {
    try {
      const stored = JSON.parse(localStorage.getItem(this.guestCartKey) ?? '[]');
      if (!Array.isArray(stored)) return [];
      return stored
        .filter((item): item is CartItem =>
          typeof item === 'object'
          && item !== null
          && typeof item.productName === 'string'
          && typeof item.quantity === 'number'
          && Number.isInteger(item.quantity)
          && item.quantity > 0,
        )
        .slice(0, 30);
    } catch {
      return [];
    }
  }

  private mergeCarts(primary: CartItem[], secondary: CartItem[]): CartItem[] {
    const merged = new Map(primary.map((item) => [item.productName, item.quantity]));
    for (const item of secondary) {
      merged.set(item.productName, (merged.get(item.productName) ?? 0) + item.quantity);
    }
    return [...merged].map(([productName, quantity]) => ({ productName, quantity })).slice(0, 30);
  }

  private saveCart() {
    const items = this.cartItems();
    const user = this.authUser();
    if (!user || this.isAdminAccount()) {
      try {
        localStorage.setItem(this.guestCartKey, JSON.stringify(items));
      } catch {
        // The cart remains in memory when browser storage is disabled.
      }
      return;
    }
    try {
      localStorage.removeItem(this.guestCartKey);
    } catch {
      // Ignore browser storage cleanup failures.
    }
    void setDoc(doc(firestore, 'users', user.uid, 'cart', 'current'), {
      items,
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      this.placeOrderError.set(`Could not save your cart: ${this.errorMessage(error)}`);
    });
  }

  private async loadCustomerCart(user: User) {
    try {
      const cart = await getDoc(doc(firestore, 'users', user.uid, 'cart', 'current'));
      const firestoreItems: CartItem[] = [];
      if (cart.exists()) {
        const items = cart.data()['items'];
        if (Array.isArray(items)) {
          for (const item of items) {
            if (
              typeof item === 'object'
              && item !== null
              && typeof item.productName === 'string'
              && typeof item.quantity === 'number'
              && Number.isInteger(item.quantity)
              && item.quantity > 0
            ) {
              firestoreItems.push({ productName: item.productName, quantity: item.quantity });
            }
          }
        }
      }

      const guestItems = this.readGuestCart();
      const merged = guestItems.length
        ? this.mergeCarts(firestoreItems, guestItems)
        : firestoreItems;
      this.cartItems.set(merged);
      if (guestItems.length) {
        localStorage.removeItem(this.guestCartKey);
      }
      await setDoc(doc(firestore, 'users', user.uid, 'cart', 'current'), {
        items: merged,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      this.placeOrderError.set(`Could not load your saved cart: ${this.errorMessage(error)}`);
    }
  }

  @HostListener('window:scroll')
  onScroll() {
    this.fixed.set(window.scrollY > 80);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeAccountModal();
    this.setSearchOpen(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.searchOpen()) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.search, button[aria-label="Search products"]')) return;

    this.setSearchOpen(false);
  }

  toggleSearch() {
    const open = !this.searchOpen();
    this.setSearchOpen(open);
    if (open) setTimeout(() => document.getElementById('search-input')?.focus());
  }

  private setSearchOpen(open: boolean) {
    this.searchOpen.set(open);
    document.documentElement.classList.toggle('search-open', open);
  }

  openModal() {
    this.authError.set('');
    this.profileError.set('');
    this.modalOpen.set(true);
  }

  closeAccountModal() {
    if (!this.profileRequired()) this.modalOpen.set(false);
  }

  pick(c: Category | 'All') {
    this.category.set(c);
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
  }

  add(p: Product) {
    const product = this.catalog().find((item) => item.name === p.name);
    if (!product || product.stock <= 0) {
      this.notice.set(`${p.name} is out of stock.`);
      setTimeout(() => this.notice.set(''), 2200);
      return;
    }

    const quantity = this.cartItems().find((item) => item.productName === p.name)?.quantity ?? 0;
    if (quantity >= product.stock) {
      this.notice.set(`Only ${product.stock} ${p.name} available.`);
      setTimeout(() => this.notice.set(''), 2200);
      return;
    }

    this.cartItems.update((items) => {
      const existing = items.find((item) => item.productName === p.name);
      return existing
        ? items.map((item) => item.productName === p.name ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { productName: p.name, quantity: 1 }];
    });
    this.saveCart();
    this.notice.set('Added to cart');
    setTimeout(() => this.notice.set(''), 2200);
  }

  changeCartQuantity(productName: string, change: number) {
    const currentQuantity = this.cartItems().find((item) => item.productName === productName)?.quantity ?? 0;
    if (change > 0) {
      const product = this.catalog().find((item) => item.name === productName);
      if (!product || currentQuantity >= product.stock) {
        this.notice.set('No more stock is available for this item.');
        setTimeout(() => this.notice.set(''), 2200);
        return;
      }
    }

    this.cartItems.update((items) => items
      .map((item) => item.productName === productName ? { ...item, quantity: item.quantity + change } : item)
      .filter((item) => item.quantity > 0));
    this.saveCart();
  }

  removeCartItem(productName: string) {
    this.cartItems.update((items) => items.filter((item) => item.productName !== productName));
    this.saveCart();
  }

  async placeOrder() {
    const user = this.authUser();
    if (!user) {
      this.cartOpen.set(false);
      this.openModal();
      return;
    }

    if (this.isAdminAccount()) {
      this.placeOrderError.set('Please use a customer account to place a storefront order.');
      return;
    }

    if (this.profileStatus() === 'checking') {
      this.placeOrderError.set('Your customer profile is still loading. Please try again shortly.');
      return;
    }

    if (
      this.profileRequired()
      || this.profileStatus() !== 'complete'
      || !this.profileName.trim()
      || (this.fulfillmentMethod() === 'delivery' && !this.fullAddress.trim())
      || !this.primaryContact.trim()
      || !this.secondaryContact.trim()
    ) {
      this.cartOpen.set(false);
      this.profileRequired.set(true);
      this.modalOpen.set(true);
      this.profileError.set('Complete your customer profile before placing an order.');
      return;
    }

    const lines = this.cartLines();
    if (!lines.length) return;

    this.orderSubmitting.set(true);
    this.placeOrderError.set('');
    try {
      const orderRef = doc(collection(firestore, 'orders'));
      await runTransaction(firestore, async (transaction) => {
        const productRefs = lines.map(({ product }) => doc(firestore, 'products', product.name));
        const productSnapshots = await Promise.all(productRefs.map((productRef) => transaction.get(productRef)));
        const orderItems = lines.map(({ product, quantity }, index) => {
          const snapshot = productSnapshots[index];
          if (!snapshot.exists()) {
            throw new Error(`${product.name} is no longer available.`);
          }

          const data = snapshot.data();
          const stock = data['stock'];
          const price = data['price'];
          const image = data['image'];
          if (
            data['name'] !== product.name
            || typeof stock !== 'number'
            || !Number.isInteger(stock)
            || stock < 0
            || typeof price !== 'number'
            || !Number.isFinite(price)
            || price < 0
            || typeof image !== 'string'
          ) {
            throw new Error(`${product.name} has invalid catalog data. Please contact the shop.`);
          }
          if (stock < quantity) {
            throw new Error(`Only ${stock} of ${product.name} remain in stock.`);
          }

          return { productName: product.name, quantity, unitPrice: price, image, stock, price };
        });

        for (const [index, item] of orderItems.entries()) {
          transaction.update(productRefs[index], {
            stock: item.stock - item.quantity,
            lastOrderId: orderRef.id,
          });
        }

        transaction.set(orderRef, {
          customerUid: user.uid,
          customerName: this.profileName.trim(),
          fullAddress: this.fulfillmentMethod() === 'delivery' ? this.fullAddress.trim() : '',
          fulfillmentMethod: this.fulfillmentMethod(),
          contactNumbers: {
            primary: this.primaryContact.trim(),
            secondary: this.secondaryContact.trim(),
          },
          items: orderItems.map(({ productName, quantity, unitPrice, image }) => ({
            productName,
            quantity,
            unitPrice,
            image,
          })),
          total: orderItems.reduce((total, item) => total + item.price * item.quantity, 0),
          status: 'pending',
          estimatedDuration: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      this.cartItems.set([]);
      this.saveCart();
      this.cartOpen.set(false);
      this.notice.set('Order placed');
      setTimeout(() => this.notice.set(''), 3500);
    } catch (error) {
      this.placeOrderError.set(`Could not place your order: ${this.errorMessage(error)}`);
    } finally {
      this.orderSubmitting.set(false);
    }
  }

  productDraft(product: Product): ProductDraft {
    return this.productDrafts()[product.name] ?? { price: product.price, stock: product.stock };
  }

  updateProductDraft(product: Product, field: keyof ProductDraft, value: number | null) {
    const current = this.productDraft(product);
    this.productDrafts.update((drafts) => ({
      ...drafts,
      [product.name]: { ...current, [field]: Number(value) },
    }));
    this.productErrors.update((errors) => ({ ...errors, [product.name]: '' }));
  }

  async saveProduct(product: Product) {
    const draft = this.productDraft(product);
    if (!Number.isFinite(draft.price) || draft.price < 0 || !Number.isInteger(draft.stock) || draft.stock < 0) {
      this.productErrors.update((errors) => ({
        ...errors,
        [product.name]: 'Enter a valid non-negative price and whole-number stock count.',
      }));
      return;
    }

    this.savingProduct.set(product.name);
    this.productErrors.update((errors) => ({ ...errors, [product.name]: '' }));
    try {
      await setDoc(doc(firestore, 'products', product.name), {
        ...product,
        price: draft.price,
        stock: draft.stock,
        popular: Boolean(product.popular),
        recent: Boolean(product.recent),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const updatedProducts = this.catalog().map((item) => item.name === product.name
        ? { ...item, price: draft.price, stock: draft.stock }
        : item);
      this.productSearch = new ProductSearchEngine(updatedProducts);
      this.catalog.set(updatedProducts);
      this.productDrafts.update((drafts) => {
        const { [product.name]: _savedDraft, ...remaining } = drafts;
        return remaining;
      });
      this.notice.set(`${product.name} price and stock saved.`);
      setTimeout(() => this.notice.set(''), 2200);
    } catch (error) {
      this.productErrors.update((errors) => ({
        ...errors,
        [product.name]: this.errorMessage(error),
      }));
    } finally {
      this.savingProduct.set(null);
    }
  }

  orderDraft(order: ShopOrder): OrderDraft {
    return this.orderDrafts()[order.id] ?? {
      status: order.status,
      estimatedDuration: order.estimatedDuration,
    };
  }

  updateOrderDraft(order: ShopOrder, field: keyof OrderDraft, value: string) {
    const current = this.orderDraft(order);
    if (field === 'status') {
      if (!isOrderStatus(value)) {
        this.orderErrors.update((errors) => ({ ...errors, [order.id]: 'Choose a valid order status.' }));
        return;
      }
      this.orderDrafts.update((drafts) => ({
        ...drafts,
        [order.id]: { ...current, status: value },
      }));
    } else {
      this.orderDrafts.update((drafts) => ({
        ...drafts,
        [order.id]: { ...current, estimatedDuration: value },
      }));
    }
    this.orderErrors.update((errors) => ({ ...errors, [order.id]: '' }));
  }

  orderStatusIndex(status: OrderStatus): number {
    return ORDER_STATUSES.findIndex((step) => step.value === status);
  }

  orderStatusLabel(status: OrderStatus): string {
    return ORDER_STATUSES.find((step) => step.value === status)?.label ?? 'Unknown status';
  }

  async saveOrder(order: ShopOrder) {
    const draft = this.orderDraft(order);
    const estimatedDuration = draft.estimatedDuration.trim();
    if (!isOrderStatus(draft.status) || estimatedDuration.length > 80) {
      this.orderErrors.update((errors) => ({
        ...errors,
        [order.id]: 'Choose a valid status and keep the delivery estimate under 80 characters.',
      }));
      return;
    }

    this.savingOrder.set(order.id);
    this.orderErrors.update((errors) => ({ ...errors, [order.id]: '' }));
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: draft.status,
        estimatedDuration,
        updatedAt: serverTimestamp(),
      });
      this.orderDrafts.update((drafts) => {
        const { [order.id]: _savedDraft, ...remaining } = drafts;
        return remaining;
      });
      this.notice.set(`Order ${order.id.slice(0, 8)} updated.`);
      setTimeout(() => this.notice.set(''), 2500);
    } catch (error) {
      this.orderErrors.update((errors) => ({
        ...errors,
        [order.id]: this.errorMessage(error),
      }));
    } finally {
      this.savingOrder.set(null);
    }
  }

  async signInWithGoogle() {
    this.authError.set('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(firebaseAuth, provider);
    } catch (error) {
      this.authError.set(this.errorMessage(error));
    }
  }

  async saveProfile(event: Event) {
    event.preventDefault();
    const user = this.authUser();
    if (!user) {
      this.profileError.set('Sign in with Google before saving your profile.');
      return;
    }

    const fullName = this.profileName.trim();
    const fullAddress = this.fullAddress.trim();
    const primary = this.primaryContact.trim();
    const secondary = this.secondaryContact.trim();
    if (!fullName || !fullAddress || !primary || !secondary) {
      this.profileError.set('Complete all profile fields before continuing.');
      return;
    }

    this.profileSaving.set(true);
    this.profileError.set('');
    try {
      await setDoc(doc(firestore, 'users', user.uid), {
        fullName,
        fullAddress,
        contactNumbers: { primary, secondary },
        email: user.email ?? '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      this.profileName = fullName;
      this.profileRequired.set(false);
      this.profileStatus.set('complete');
      this.modalOpen.set(false);
      this.notice.set('Your profile has been saved.');
      setTimeout(() => this.notice.set(''), 2200);
    } catch (error) {
      this.profileError.set(this.errorMessage(error));
    } finally {
      this.profileSaving.set(false);
    }
  }

  async adminLogin(event: Event) {
    event.preventDefault();
    this.adminError.set('');
    this.adminAccess.set('checking');
    try {
      await signInWithEmailAndPassword(firebaseAuth, this.adminEmail.trim(), this.adminPassword);
    } catch (error) {
      this.adminAccess.set('signed-out');
      this.adminError.set(this.errorMessage(error));
    }
  }

  async logout() {
    try {
      await signOut(firebaseAuth);
      this.modalOpen.set(false);
    } catch (error) {
      const message = this.errorMessage(error);
      if (this.adminRoute) this.adminError.set(message);
      else this.authError.set(message);
    }
  }

  retryProfileLoad() {
    const user = this.authUser();
    if (user) void this.loadCustomerProfile(user);
  }

  private async loadCustomerProfile(user: User) {
    this.profileStatus.set('checking');
    this.profileError.set('');
    try {
      const admin = await getDoc(doc(firestore, 'admin', user.uid));
      const adminData = admin.data();
      if (admin.exists() && adminData?.['role'] === 'admin' && adminData?.['enabled'] === true) {
        this.isAdminAccount.set(true);
        this.profileName = typeof adminData['displayName'] === 'string'
          ? adminData['displayName']
          : user.displayName ?? user.email ?? '';
        this.fullAddress = '';
        this.primaryContact = '';
        this.secondaryContact = '';
        this.profileRequired.set(false);
        this.profileStatus.set('complete');
        this.modalOpen.set(false);
        return;
      }

      const profile = await getDoc(doc(firestore, 'users', user.uid));
      if (profile.exists()) {
        const data = profile.data();
        const fullName = data['fullName'];
        const contactNumbers = data['contactNumbers'];
        if (typeof fullName === 'string') this.profileName = fullName;
        this.fullAddress = typeof data['fullAddress'] === 'string' ? data['fullAddress'] : '';
        this.primaryContact = typeof contactNumbers?.['primary'] === 'string'
          ? contactNumbers['primary']
          : '';
        this.secondaryContact = typeof contactNumbers?.['secondary'] === 'string'
          ? contactNumbers['secondary']
          : '';
        this.profileRequired.set(false);
        this.profileStatus.set('complete');
        return;
      }

      this.profileName = user.displayName ?? '';
      this.fullAddress = '';
      this.primaryContact = '';
      this.secondaryContact = '';
      this.profileRequired.set(true);
      this.profileStatus.set('required');
      this.modalOpen.set(true);
    } catch (error) {
      this.profileRequired.set(false);
      this.profileStatus.set('error');
      this.profileError.set(this.errorMessage(error));
    }
  }

  private async verifyAdmin(user: User) {
    this.adminAccess.set('checking-access');
    this.adminError.set('');
    try {
      const admin = await getDoc(doc(firestore, 'admin', user.uid));
      const data = admin.data();
      if (admin.exists() && data?.['role'] === 'admin' && data?.['enabled'] === true) {
        this.adminAccess.set('authorized');
        this.listenToAdminOrders();
        void this.ensureCatalogInFirestore();
        return;
      }
      this.stopAdminOrders();
      this.adminAccess.set('denied');
      this.adminError.set('This Firebase account is not enabled as a CDLEM administrator.');
    } catch (error) {
      this.stopAdminOrders();
      this.adminAccess.set('denied');
      this.adminError.set(`Could not verify administrator access: ${this.errorMessage(error)}`);
    }
  }

  private listenToCustomerOrders(user: User) {
    this.customerOrdersUnsubscribe?.();
    this.customerOrders.set([]);
    this.customerOrdersLoading.set(true);
    this.customerOrdersError.set('');
    const ordersQuery = query(
      collection(firestore, 'orders'),
      where('customerUid', '==', user.uid),
    );
    this.customerOrdersUnsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const parsed = snapshot.docs.map((orderDoc) => this.parseOrder(orderDoc.id, orderDoc.data()));
        this.customerOrders.set(
          parsed
            .filter((order): order is ShopOrder => order !== null)
            .sort((left, right) => (right.createdAt?.toMillis() ?? 0) - (left.createdAt?.toMillis() ?? 0)),
        );
        this.customerOrdersError.set(
          parsed.some((order) => order === null) ? 'Some order records could not be displayed.' : '',
        );
        this.customerOrdersLoading.set(false);
      },
      (error) => {
        this.customerOrdersError.set(`Could not load your orders: ${this.errorMessage(error)}`);
        this.customerOrdersLoading.set(false);
      },
    );
  }

  private listenToAdminOrders() {
    this.stopAdminOrders();
    this.adminOrdersLoading.set(true);
    this.adminOrdersError.set('');
    this.adminOrdersUnsubscribe = onSnapshot(
      collection(firestore, 'orders'),
      (snapshot) => {
        const parsed = snapshot.docs.map((orderDoc) => this.parseOrder(orderDoc.id, orderDoc.data()));
        this.adminOrders.set(
          parsed
            .filter((order): order is ShopOrder => order !== null)
            .sort((left, right) => (right.createdAt?.toMillis() ?? 0) - (left.createdAt?.toMillis() ?? 0)),
        );
        this.adminOrdersError.set(
          parsed.some((order) => order === null) ? 'Some order records could not be displayed.' : '',
        );
        this.adminOrdersLoading.set(false);
      },
      (error) => {
        this.adminOrdersError.set(`Could not load orders: ${this.errorMessage(error)}`);
        this.adminOrdersLoading.set(false);
      },
    );
  }

  private stopCustomerOrders() {
    this.customerOrdersUnsubscribe?.();
    this.customerOrdersUnsubscribe = null;
    this.customerOrders.set([]);
    this.customerOrdersLoading.set(false);
    this.customerOrdersError.set('');
  }

  private stopAdminOrders() {
    this.adminOrdersUnsubscribe?.();
    this.adminOrdersUnsubscribe = null;
    this.adminOrders.set([]);
    this.adminOrdersLoading.set(false);
    this.adminOrdersError.set('');
  }

  private parseOrder(id: string, data: Record<string, unknown>): ShopOrder | null {
    const contacts = data['contactNumbers'];
    if (typeof contacts !== 'object' || contacts === null || Array.isArray(contacts)) return null;
    const contactNumbers = contacts as Record<string, unknown>;
    const items = data['items'];
    if (
      typeof data['customerUid'] !== 'string'
      || typeof data['customerName'] !== 'string'
      || typeof data['fullAddress'] !== 'string'
      || typeof contactNumbers['primary'] !== 'string'
      || typeof contactNumbers['secondary'] !== 'string'
      || !Array.isArray(items)
      || !items.every(isOrderItem)
      || typeof data['total'] !== 'number'
      || !Number.isFinite(data['total'])
      || data['total'] < 0
      || !isOrderStatus(data['status'])
      || typeof data['estimatedDuration'] !== 'string'
    ) {
      return null;
    }
    const fulfillmentMethod: FulfillmentMethod =
      data['fulfillmentMethod'] === 'pickup' ? 'pickup' : 'delivery';

    return {
      id,
      customerUid: data['customerUid'],
      customerName: data['customerName'],
      fullAddress: data['fullAddress'],
      fulfillmentMethod,
      contactNumbers: {
        primary: contactNumbers['primary'],
        secondary: contactNumbers['secondary'],
      },
      items,
      total: data['total'],
      status: data['status'],
      estimatedDuration: data['estimatedDuration'],
      createdAt: data['createdAt'] instanceof Timestamp ? data['createdAt'] : null,
    };
  }

  private async ensureCatalogInFirestore() {
    try {
      const snapshot = await getDocs(collection(firestore, 'products'));
      const existing = new Map(snapshot.docs.map((productDoc) => [
        productDoc.id,
        productDoc,
      ]));
      const existingByImage = new Map<string, (typeof snapshot.docs)[number]>();
      for (const productDoc of snapshot.docs) {
        const image = productDoc.data()['image'];
        if (typeof image === 'string' && !existingByImage.has(image)) {
          existingByImage.set(image, productDoc);
        }
      }

      const productNames = new Set(PRODUCTS.map((product) => product.name));
      const obsolete = snapshot.docs.filter((productDoc) => !productNames.has(productDoc.id));
      const needsWrite = PRODUCTS.filter((product) => {
        const data = existing.get(product.name)?.data();
        return !data
          || data['name'] !== product.name
          || data['category'] !== product.category
          || data['image'] !== product.image
          || data['emoji'] !== product.emoji
          || data['id'] !== undefined
          || typeof data['price'] !== 'number'
          || !Number.isFinite(data['price'])
          || typeof data['stock'] !== 'number'
          || !Number.isInteger(data['stock'])
          || data['stock'] < 0
          || data['popular'] !== Boolean(product.popular)
          || data['recent'] !== Boolean(product.recent)
          || !data['updatedAt'];
      });
      if (!needsWrite.length && !obsolete.length) return;

      const batch = writeBatch(firestore);
      for (const product of needsWrite) {
        const previous = (existing.get(product.name) ?? existingByImage.get(product.image))?.data();
        batch.set(doc(firestore, 'products', product.name), {
          ...product,
          price: typeof previous?.['price'] === 'number' && Number.isFinite(previous['price'])
            ? previous['price']
            : product.price,
          stock: typeof previous?.['stock'] === 'number'
            && Number.isInteger(previous['stock'])
            && previous['stock'] >= 0
            ? previous['stock']
            : product.stock,
          popular: Boolean(product.popular),
          recent: Boolean(product.recent),
          updatedAt: serverTimestamp(),
        });
      }
      for (const productDoc of obsolete) {
        batch.delete(doc(firestore, 'products', productDoc.id));
      }
      await batch.commit();
      this.catalogError.set('');
    } catch (error) {
      this.catalogError.set(`Could not initialize the Firestore catalog: ${this.errorMessage(error)}`);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'An unexpected Firebase error occurred.';
  }

  private priceLimit(value: string | number | null, fallback: number): number {
    return value === '' || value === null ? fallback : Number(value);
  }
}
