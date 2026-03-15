import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Minus, X, CheckCircle2, Pill, Search, ArrowLeft, CreditCard, Banknote, Wallet, User, LogOut, MapPin, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { products, categories } from './data/products';
import { Product, CartItem, Branch, BranchInventory } from './types';

type ViewState = 'home' | 'shop' | 'checkout' | 'success' | 'login' | 'register' | 'order-status';

const partnerBrands = [
  "Pfizer", "Johnson & Johnson", "Bayer", "GSK", "Novartis", 
  "Sanofi", "AstraZeneca", "Unilab", "Bioten", "Centrum"
];

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return !!localStorage.getItem('token');
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Auth state
  const [authForm, setAuthForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Branch state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(() => {
    const saved = localStorage.getItem('selectedBranch');
    return saved ? JSON.parse(saved) : null;
  });
  const [branchInventory, setBranchInventory] = useState<BranchInventory[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  useEffect(() => {
    fetch('/api/branches')
      .then(res => res.json())
      .then(data => setBranches(data))
      .catch(err => console.error('Failed to fetch branches:', err));
  }, []);

  useEffect(() => {
    if (selectedBranch) {
      localStorage.setItem('selectedBranch', JSON.stringify(selectedBranch));
      fetch(`/api/branches/${selectedBranch.id}/inventory`)
        .then(res => res.json())
        .then(data => setBranchInventory(data))
        .catch(err => console.error('Failed to fetch inventory:', err));
    } else {
      setBranchInventory([]);
    }
  }, [selectedBranch]);

  const isBranchOpen = (branch: Branch) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;

    const [openHour, openMinute] = branch.opening_time.split(':').map(Number);
    const [closeHour, closeMinute] = branch.closing_time.split(':').map(Number);
    
    const openTime = openHour + openMinute / 60;
    let closeTime = closeHour + closeMinute / 60;

    // Handle overnight hours (e.g., 14:00 to 02:00)
    if (closeTime < openTime) {
      return currentTime >= openTime || currentTime <= closeTime;
    }

    return currentTime >= openTime && currentTime <= closeTime;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      localStorage.setItem('token', data.token);
      setIsLoggedIn(true);
      setView('home');
      if (!selectedBranch) {
        setIsBranchModalOpen(true);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authForm.email, password: authForm.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      localStorage.setItem('token', data.token);
      setIsLoggedIn(true);
      setView('home');
      if (!selectedBranch) {
        setIsBranchModalOpen(true);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    let hasStock = true;
    if (selectedBranch) {
      const inventoryItem = branchInventory.find(inv => inv.product_id === p.id);
      hasStock = inventoryItem ? inventoryItem.stock > 0 : false;
    }

    return matchesCategory && matchesSearch && hasStock;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const addToCart = (product: Product) => {
    if (!selectedBranch) {
      setIsBranchModalOpen(true);
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryFee = 49.00;
  const finalTotal = cartTotal + deliveryFee;

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setView('checkout');
    window.scrollTo(0, 0);
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setView('success');
    setCart([]);
    setTimeout(() => {
      setView('shop');
    }, 4000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div 
              className="flex items-center gap-2 text-emerald-600 cursor-pointer"
              onClick={() => setView('home')}
            >
              <Pill className="w-8 h-8" />
              <span className="text-xl font-bold tracking-tight">PharmaQuick</span>
            </div>
            
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setView('home')} className={`font-medium transition-colors ${view === 'home' ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-500'}`}>Home</button>
              <button onClick={() => setView('shop')} className={`font-medium transition-colors ${view === 'shop' ? 'text-emerald-600' : 'text-slate-600 hover:text-emerald-500'}`}>Shop</button>
              <button 
                onClick={() => setIsBranchModalOpen(true)} 
                className="flex items-center gap-1 font-medium text-slate-600 hover:text-emerald-500 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span className="max-w-[120px] truncate">
                  {selectedBranch ? selectedBranch.name : 'Select Branch'}
                </span>
              </button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {view === 'shop' && (
              <div className="flex-1 max-w-md mx-4 hidden sm:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search medicines, vitamins..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                  />
                </div>
              </div>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-slate-600 hover:text-emerald-600 transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {cartItemCount > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-emerald-500 rounded-full border-2 border-white">
                  {cartItemCount}
                </span>
              )}
            </button>

            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setView('order-status')}
                  className="p-2 text-slate-600 hover:text-emerald-600 transition-colors"
                  title="Order Status"
                >
                  <User className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => {
                    localStorage.removeItem('token');
                    setIsLoggedIn(false);
                    setView('home');
                  }}
                  className="p-2 text-slate-600 hover:text-red-600 transition-colors"
                  title="Log Out"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')} 
                className="text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-full transition-colors"
              >
                Log In
              </button>
            )}
          </div>
        </div>
        
        {/* Mobile Search & Branch */}
        {view === 'shop' && (
          <div className="sm:hidden px-4 pb-3 space-y-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />
              </div>
              <button 
                onClick={() => setIsBranchModalOpen(true)} 
                className="w-full flex items-center justify-center gap-2 font-medium text-slate-600 bg-slate-100 py-2 rounded-full hover:bg-slate-200 transition-colors"
              >
                <MapPin className="w-4 h-4" />
                <span className="truncate">
                  {selectedBranch ? selectedBranch.name : 'Select Branch'}
                </span>
              </button>
          </div>
        )}
      </header>

      {/* Login Page */}
      {view === 'login' && (
        <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full space-y-8 bg-white p-10 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 mb-6">
                <Pill className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm text-slate-500">
                Please sign in to your account
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{authError}</div>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                  <input 
                    type="email" 
                    required 
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="you@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input 
                    type="password" 
                    required 
                    value={authForm.password}
                    onChange={e => setAuthForm({...authForm, password: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="••••••••" 
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded" />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600">Remember me</label>
                </div>
                <div className="text-sm">
                  <a href="#" className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors">Forgot your password?</a>
                </div>
              </div>
              <div>
                <button type="submit" disabled={authLoading} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50">
                  {authLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </div>
            </form>
            <div className="text-center mt-6">
              <p className="text-sm text-slate-600">
                Don't have an account? <button onClick={() => { setAuthError(''); setView('register'); }} className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors">Sign up</button>
              </p>
            </div>
          </motion.div>
        </main>
      )}

      {/* Register Page */}
      {view === 'register' && (
        <main className="flex-1 flex items-center justify-center py-20 px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl w-full space-y-8 bg-white p-10 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-50 mb-6">
                <Pill className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create an account</h2>
              <p className="mt-2 text-sm text-slate-500">
                Join PharmaQuick today
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleRegister}>
              {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{authError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={authForm.fullName}
                    onChange={e => setAuthForm({...authForm, fullName: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="Juan Dela Cruz" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                  <input 
                    type="email" 
                    required 
                    value={authForm.email}
                    onChange={e => setAuthForm({...authForm, email: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="you@example.com" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    required 
                    pattern="^\+63\d{10}$"
                    title="Format: +63XXXXXXXXXX"
                    value={authForm.phone}
                    onChange={e => setAuthForm({...authForm, phone: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="+639123456789" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input 
                    type="password" 
                    required 
                    minLength={8}
                    value={authForm.password}
                    onChange={e => setAuthForm({...authForm, password: e.target.value})}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow" 
                    placeholder="Min. 8 characters" 
                  />
                </div>
              </div>
              <div className="flex justify-center mt-8">
                <button type="submit" disabled={authLoading} className="w-full sm:w-64 flex justify-center py-3 px-4 border border-transparent rounded-full shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50">
                  {authLoading ? 'Creating account...' : 'Create account'}
                </button>
              </div>
            </form>
            <div className="text-center mt-6">
              <p className="text-sm text-slate-600">
                Already have an account? <button onClick={() => { setAuthError(''); setView('login'); }} className="font-medium text-emerald-600 hover:text-emerald-500 transition-colors">Sign in</button>
              </p>
            </div>
          </motion.div>
        </main>
      )}

      {/* Home Page */}
      {view === 'home' && (
        <main className="flex flex-col min-h-screen">
          {/* Hero Section */}
          <section className="bg-emerald-50 py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
            {!selectedBranch && isLoggedIn && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-7xl mx-auto mb-8"
              >
                <div className="bg-white border-l-4 border-amber-400 p-4 rounded-r-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 rounded-full">
                      <MapPin className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Delivery Location Required</p>
                      <p className="text-sm text-slate-500">Please select a branch to see accurate product availability and delivery times.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsBranchModalOpen(true)}
                    className="whitespace-nowrap bg-amber-500 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-amber-600 transition-colors shadow-sm"
                  >
                    Select Branch Now
                  </button>
                </div>
              </motion.div>
            )}
            <div className="max-w-7xl mx-auto text-center relative z-10">
              <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
                Your Health, <span className="text-emerald-600">Delivered Fast</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
                Get your medicines, vitamins, and daily essentials delivered right to your doorstep with PharmaQuick. Safe, reliable, and fast.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button 
                  onClick={() => setView('shop')} 
                  className="w-full sm:w-auto bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                >
                  Shop Now
                </button>
                <button 
                  onClick={() => setIsBranchModalOpen(true)} 
                  className="w-full sm:w-auto bg-white text-emerald-600 border-2 border-emerald-600 px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-50 transition-all shadow-md hover:shadow-lg hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Choose Branch
                </button>
              </div>
            </div>
          </section>

          {/* Partner Brands Marquee */}
          <section className="py-10 bg-white border-y border-slate-100 overflow-hidden flex flex-col justify-center">
            <div className="max-w-7xl mx-auto px-4 mb-6 text-center w-full">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Trusted by Top Brands</h2>
            </div>
            <div className="relative w-full overflow-hidden flex bg-white">
              <div className="flex w-max animate-marquee">
                {[...partnerBrands, ...partnerBrands, ...partnerBrands].map((brand, i) => (
                  <div key={i} className="flex items-center justify-center px-12">
                    <span className="text-2xl font-bold text-slate-300 whitespace-nowrap">{brand}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Featured Products */}
          <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Featured Products</h2>
                <p className="text-slate-500">Handpicked essentials for your daily needs.</p>
              </div>
              <button onClick={() => setView('shop')} className="hidden sm:flex items-center gap-1 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                View All <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.slice(0, 4).map(product => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  key={product.id} 
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="aspect-square relative overflow-hidden bg-slate-100">
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-semibold text-slate-700">
                      {product.category}
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-semibold text-lg text-slate-900 mb-1">{product.name}</h3>
                    <p className="text-sm text-slate-500 mb-4 flex-1 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xl font-bold text-emerald-700">₱{product.price.toFixed(2)}</span>
                      <button 
                        onClick={() => isLoggedIn ? addToCart(product) : setView('login')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-600 hover:text-white transition-colors font-semibold text-sm"
                        aria-label="Add to cart"
                      >
                        <Plus className="w-4 h-4" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="mt-8 text-center sm:hidden">
              <button onClick={() => setView('shop')} className="inline-flex items-center gap-1 text-emerald-600 font-semibold hover:text-emerald-700 transition-colors">
                View All Products <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </section>
        </main>
      )}

      {/* Main Content Area */}
      {view === 'shop' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Categories */}
          <div className="flex overflow-x-auto pb-4 mb-6 hide-scrollbar gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === category 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedProducts.map(product => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                key={product.id} 
                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="aspect-square relative overflow-hidden bg-slate-100">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-semibold text-slate-700">
                    {product.category}
                  </div>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-semibold text-lg text-slate-900 mb-1">{product.name}</h3>
                  <p className="text-sm text-slate-500 mb-4 flex-1 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-xl font-bold text-emerald-700">₱{product.price.toFixed(2)}</span>
                    <button 
                      onClick={() => isLoggedIn ? addToCart(product) : setView('login')}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-600 hover:text-white transition-colors font-semibold text-sm"
                      aria-label="Add to cart"
                    >
                      <Plus className="w-4 h-4" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-slate-500 text-lg">No products found matching your criteria.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-10">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </main>
      )}

      {/* Checkout Page */}
      {view === 'checkout' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button 
            onClick={() => setView('shop')}
            className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Shop
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Forms */}
            <div className="lg:col-span-2 space-y-6">
              <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-6">
                
                {/* Delivery Details */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 mb-4">Delivery Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="Juan Dela Cruz" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Phone Number</label>
                      <input 
                        type="tel" 
                        required 
                        placeholder="09XX XXX XXXX" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-sm font-medium text-slate-700">Complete Delivery Address</label>
                      <textarea 
                        required 
                        rows={3}
                        placeholder="House/Unit No., Street, Barangay, City/Municipality, Province, Zip Code" 
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Wallet className="w-6 h-6 text-blue-600" />
                    Payment Method
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Card */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'card' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="card" 
                        checked={paymentMethod === 'card'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">Credit / Debit Card</p>
                          <p className="text-sm text-slate-500">Pay securely with card</p>
                        </div>
                      </div>
                    </label>

                    {/* COD */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'cod' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="cod" 
                        checked={paymentMethod === 'cod'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">Cash on Delivery</p>
                          <p className="text-sm text-slate-500">Pay when you receive</p>
                        </div>
                      </div>
                    </label>

                    {/* GCash */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'gcash' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="gcash" 
                        checked={paymentMethod === 'gcash'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">GCash</p>
                          <p className="text-sm text-slate-500">Pay via GCash</p>
                        </div>
                      </div>
                    </label>

                    {/* Maya */}
                    <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${paymentMethod === 'maya' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        name="payment" 
                        value="maya" 
                        checked={paymentMethod === 'maya'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <div className="ml-3 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-900">Maya</p>
                          <p className="text-sm text-slate-500">Pay via Maya</p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Card Instructions */}
                  {paymentMethod === 'card' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Card Number *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="0000 0000 0000 0000" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">Expiry Date *</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="MM/YY" 
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-semibold text-slate-700">CVV *</label>
                            <input 
                              type="text" 
                              required 
                              placeholder="123" 
                              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GCash Instructions */}
                  {paymentMethod === 'gcash' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 text-blue-900">
                        <h3 className="font-semibold mb-3 text-blue-900">GCash Payment Instructions:</h3>
                        <ol className="space-y-2 text-sm text-blue-800">
                          <li>1. Send ₱{finalTotal.toFixed(2)} to GCash number: <span className="font-bold">0917-123-4567</span></li>
                          <li>2. Account Name: <span className="font-bold">HealthPlus Pharmacy</span></li>
                          <li>3. Enter your GCash number and reference number below</li>
                        </ol>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Your GCash Number *</label>
                          <input 
                            type="tel" 
                            required 
                            placeholder="09XX-XXX-XXXX" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">GCash Reference Number *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Enter reference number" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Maya Instructions */}
                  {paymentMethod === 'maya' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 text-blue-900">
                        <h3 className="font-semibold mb-3 text-blue-900">Maya Payment Instructions:</h3>
                        <ol className="space-y-2 text-sm text-blue-800">
                          <li>1. Send ₱{finalTotal.toFixed(2)} to Maya number: <span className="font-bold">0918-123-4567</span></li>
                          <li>2. Account Name: <span className="font-bold">HealthPlus Pharmacy</span></li>
                          <li>3. Enter your Maya number and reference number below</li>
                        </ol>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Your Maya Number *</label>
                          <input 
                            type="tel" 
                            required 
                            placeholder="09XX-XXX-XXXX" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-slate-700">Maya Reference Number *</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="Enter reference number" 
                            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              </form>
            </div>

            {/* Right Column: Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-24">
                <h2 className="text-xl font-bold text-slate-900 mb-4">Order Summary</h2>
                
                <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto pr-2 hide-scrollbar">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg bg-slate-100" />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-slate-900 line-clamp-2">{item.name}</h4>
                        <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                        <p className="text-sm font-semibold text-emerald-600">₱{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({cartItemCount} items)</span>
                    <span>₱{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Fee</span>
                    <span>₱{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900 pt-3 border-t border-slate-200">
                    <span>Total</span>
                    <span>₱{finalTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button 
                  type="submit"
                  form="checkout-form"
                  className="w-full mt-6 py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  Confirm & Pay ₱{finalTotal.toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Success Page */}
      {view === 'success' && (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="flex justify-center mb-6"
          >
            <CheckCircle2 className="w-24 h-24 text-emerald-500" />
          </motion.div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Order Placed Successfully!</h1>
          <p className="text-lg text-slate-600 mb-8">
            Thank you for ordering with PharmaQuick. Your items are being prepared for delivery.
          </p>
          <div className="inline-block bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-left mb-8">
            <p className="text-slate-500 mb-2">Order Reference: <span className="font-mono font-bold text-slate-900">#PQ-{Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}</span></p>
            <p className="text-slate-500">Payment Method: <span className="font-bold text-slate-900 uppercase">{paymentMethod}</span></p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => setView('order-status')}
              className="px-8 py-3 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-700 transition-colors shadow-md"
            >
              Track Order
            </button>
            <button 
              onClick={() => setView('shop')}
              className="px-8 py-3 bg-white text-emerald-600 border border-emerald-200 rounded-full font-bold hover:bg-emerald-50 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </main>
      )}

      {/* Order Status Page */}
      {view === 'order-status' && (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button 
            onClick={() => setView('shop')}
            className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-medium mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Shop
          </button>
          <h1 className="text-3xl font-bold text-slate-900 mb-8">Order Status</h1>
          
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
              <div>
                <p className="text-sm text-slate-500">Order Reference</p>
                <p className="font-mono font-bold text-lg text-slate-900">#PQ-847291</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Estimated Delivery</p>
                <p className="font-bold text-emerald-600">Today, 2:00 PM - 4:00 PM</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="relative border-l-2 border-slate-200 ml-3 md:ml-4 space-y-8">
              <div className="relative pl-6 md:pl-8">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                <h3 className="font-bold text-slate-900">Order Placed</h3>
                <p className="text-sm text-slate-500">We have received your order.</p>
                <p className="text-xs text-slate-400 mt-1">10:30 AM</p>
              </div>
              <div className="relative pl-6 md:pl-8">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white"></div>
                <h3 className="font-bold text-slate-900">Processing</h3>
                <p className="text-sm text-slate-500">Your items are being prepared and packed.</p>
                <p className="text-xs text-slate-400 mt-1">10:45 AM</p>
              </div>
              <div className="relative pl-6 md:pl-8">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-white animate-pulse"></div>
                <h3 className="font-bold text-emerald-600">Out for Delivery</h3>
                <p className="text-sm text-slate-500">Your rider is on the way.</p>
                <p className="text-xs text-slate-400 mt-1">11:15 AM</p>
              </div>
              <div className="relative pl-6 md:pl-8">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-200 ring-4 ring-white"></div>
                <h3 className="font-bold text-slate-400">Delivered</h3>
                <p className="text-sm text-slate-400">Order has been received.</p>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* Cart Drawer (Only visible in 'shop' view) */}
      <AnimatePresence>
        {isCartOpen && view === 'shop' && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  Your Cart
                </h2>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button 
                      onClick={() => setCart([])}
                      className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors px-2 py-1"
                    >
                      Clear
                    </button>
                  )}
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <ShoppingCart className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-1">Your cart is empty</h3>
                  <p className="text-slate-500 mb-6">Looks like you haven't added anything yet.</p>
                  <button 
                    onClick={() => setIsCartOpen(false)}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-full font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {cart.map(item => (
                      <div key={item.id} className="flex gap-4 bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-20 h-20 object-cover rounded-lg bg-slate-100"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="font-medium text-slate-900 line-clamp-1">{item.name}</h4>
                            <p className="text-emerald-600 font-semibold">₱{item.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-between">
                          <button 
                            onClick={() => updateQuantity(item.id, -item.quantity)}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <span className="font-medium text-slate-900">
                            ₱{(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span>₱{cartTotal.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleProceedToCheckout}
                      className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      Proceed to Checkout
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {/* Branch Selection Modal */}
      <AnimatePresence>
        {isBranchModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBranchModalOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-3xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Select a Branch</h2>
                  <p className="text-slate-500 text-sm mt-1">Choose an open branch to see available products</p>
                </div>
                <button 
                  onClick={() => setIsBranchModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="grid gap-4">
                  {branches.map(branch => {
                    const isOpen = isBranchOpen(branch);
                    const isSelected = selectedBranch?.id === branch.id;
                    
                    return (
                      <div 
                        key={branch.id}
                        onClick={() => {
                          if (!isOpen) return;
                          if (selectedBranch?.id !== branch.id) {
                            setCart([]);
                          }
                          setSelectedBranch(branch);
                          setIsBranchModalOpen(false);
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all ${
                          !isOpen 
                            ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed' 
                            : isSelected 
                              ? 'border-emerald-500 bg-emerald-50 cursor-pointer' 
                              : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-lg text-slate-900">{branch.name}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {isOpen ? 'Open Now' : 'Closed'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm text-slate-600">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                            <span>{branch.address}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>{branch.opening_time} - {branch.closing_time}</span>
                          </div>
                        </div>

                        {!isOpen && (
                          <div className="mt-3 pt-3 border-t border-red-100">
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <X className="w-3 h-3" />
                              This branch is currently closed and cannot be selected.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center gap-2 text-emerald-500 mb-6">
              <Pill className="w-8 h-8" />
              <span className="text-2xl font-bold text-white tracking-tight">PharmaQuick</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Your trusted online pharmacy for medicines, vitamins, and daily essentials. Fast, secure, and reliable delivery to your doorstep.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Quick Links</h4>
            <ul className="space-y-4">
              <li><button onClick={() => setView('home')} className="hover:text-emerald-400 transition-colors">Home</button></li>
              <li><button onClick={() => setView('shop')} className="hover:text-emerald-400 transition-colors">Shop Products</button></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Contact Support</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Customer Service</h4>
            <ul className="space-y-4">
              <li><a href="#" className="hover:text-emerald-400 transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Shipping Policy</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Returns & Refunds</a></li>
              <li><a href="#" className="hover:text-emerald-400 transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white font-bold text-lg mb-6">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <span className="text-emerald-500 font-bold">E:</span>
                <a href="mailto:support@pharmaquick.com" className="hover:text-emerald-400 transition-colors">support@pharmaquick.com</a>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-500 font-bold">P:</span>
                <span>(02) 8123-4567</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-emerald-500 font-bold">A:</span>
                <span>123 Health Avenue, Medical District, Manila, Philippines</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} PharmaQuick. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
