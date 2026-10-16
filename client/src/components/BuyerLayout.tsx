import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ShoppingCart, Store, Globe, Search, User, LogOut, Heart, ChevronDown, Menu, MapPin } from 'lucide-react';
import logoHorizontal from '@/assets/branding/logo-horizontal.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Language } from '@shared/api.interface';
import { Image } from '@/components/ui/image';

const BuyerLayout: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const handleLanguageSelect = (lang: Language): void => {
    setLanguage(lang);
  };

  const languageLabels: Record<Language, string> = {
    zh: '简体中文',
    en: 'English',
    es: 'Español',
    pt: 'Português',
  };

  const handleSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?keyword=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleLogout = (): void => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-3 md:gap-8">
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden" title={t.nav.home}>
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                  <SheetHeader className="border-b px-4 py-3">
                    <SheetTitle className="text-left">
                      <Image src={logoHorizontal} alt="Flow" className="h-7 w-auto object-contain" />
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 p-3">
                    <form onSubmit={(e) => { handleSearch(e); setMobileNavOpen(false); }} className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        type="text"
                        placeholder={t.nav.searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 pr-4 w-full bg-slate-50 border-slate-200"
                      />
                    </form>
                    <NavLink
                      to="/"
                      end
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2 text-sm font-medium ${
                          isActive ? 'bg-slate-100 text-[#0B1F3A]' : 'text-slate-600'
                        }`
                      }
                    >
                      {t.nav.home}
                    </NavLink>
                    <NavLink
                      to="/products"
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2 text-sm font-medium ${
                          isActive ? 'bg-slate-100 text-[#0B1F3A]' : 'text-slate-600'
                        }`
                      }
                    >
                      {t.nav.products}
                    </NavLink>
                    <NavLink
                      to="/favorites"
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2 text-sm font-medium ${
                          isActive ? 'bg-slate-100 text-[#0B1F3A]' : 'text-slate-600'
                        }`
                      }
                    >
                      {t.nav.favorites}
                    </NavLink>
                    <NavLink
                      to="/orders"
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2 text-sm font-medium ${
                          isActive ? 'bg-slate-100 text-[#0B1F3A]' : 'text-slate-600'
                        }`
                      }
                    >
                      {t.nav.orders}
                    </NavLink>
                    {user && (
                      <NavLink
                        to="/addresses"
                        onClick={() => setMobileNavOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                            isActive ? 'bg-slate-100 text-[#0B1F3A]' : 'text-slate-600'
                          }`
                        }
                      >
                        <MapPin className="w-4 h-4" />
                        {t.address?.title ?? 'Addresses'}
                      </NavLink>
                    )}
                    <Link
                      to="/seller/dashboard"
                      onClick={() => setMobileNavOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600"
                    >
                      <Store className="w-4 h-4" />
                      {t.nav.sellerCenter}
                    </Link>
                  </div>
                </SheetContent>
              </Sheet>
              <Link to="/" className="flex items-center gap-2">
                <Image
                  src={logoHorizontal}
                  alt="Flow"
                  className="h-9 w-auto object-contain"
                />
              </Link>
              <nav className="hidden md:flex items-center gap-6">
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive ? 'text-[#0B1F3A]' : 'text-slate-600 hover:text-[#0B1F3A]'
                    }`
                  }
                >
                  {t.nav.home}
                </NavLink>
                <NavLink
                  to="/products"
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive ? 'text-[#0B1F3A]' : 'text-slate-600 hover:text-[#0B1F3A]'
                    }`
                  }
                >
                  {t.nav.products}
                </NavLink>
              </nav>
            </div>

            <div className="flex-1 max-w-md hidden sm:block">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder={t.nav.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 w-full bg-slate-50 border-slate-200"
                />
              </form>
            </div>

              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Globe className="w-4 h-4" />
                      <span className="max-w-[80px] truncate">
                        {languageLabels[language]}
                      </span>
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {(['zh', 'en', 'es', 'pt'] as Language[]).map((lang) => (
                       <DropdownMenuItem
                        key={lang}
                        onClick={() => handleLanguageSelect(lang)}
                        className={language === lang ? 'text-[#00C2B8] font-medium' : ''}
                      >
                        {languageLabels[lang]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link to="/favorites">
                  <Button variant="ghost" size="sm" className="relative" title={t.nav.favorites}>
                    <Heart className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/cart">
                  <Button variant="ghost" size="sm" className="relative">
                    <ShoppingCart className="w-5 h-5" />
                  </Button>
                </Link>
                {user ? (
                  <div className="flex items-center gap-2">
                    <Link to="/addresses" className="hidden sm:block">
                      <Button variant="ghost" size="sm" title={t.address?.title ?? 'Addresses'}>
                        <MapPin className="w-5 h-5" />
                      </Button>
                    </Link>
                    <Link to="/orders">
                      <Button variant="ghost" size="sm" className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
                          {user.name}
                        </span>
                        {typeof user.points === 'number' && user.points > 0 && (
                          <span
                            className="hidden md:inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                            title={t.nav.points}
                          >
                            {user.points} {t.nav.points}
                          </span>
                        )}
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="text-slate-500 hover:text-red-600"
                      title={t.auth.logout}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <Link to="/login">
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm font-medium">
                        {t.auth.signIn}
                      </span>
                    </Button>
                  </Link>
                )}
                <Link to="/seller/dashboard">
                  <Button variant="outline" size="sm" className="hidden sm:flex">
                    <Store className="w-4 h-4 mr-1" />
                    {t.nav.sellerCenter}
                  </Button>
                </Link>
              </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-[#0B1F3A] text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image
                  src={logoHorizontal}
                  alt="Flow"
                  className="h-8 w-auto object-contain brightness-0 invert"
                />
              </div>
               <p className="text-sm">
                 {language === 'zh'
                   ? 'AI 让跨境生意更简单'
                   : language === 'es'
                     ? 'IA simplifica los negocios transfronterizos'
                     : language === 'pt'
                       ? 'IA torna o comércio transfronteiriço mais simples'
                       : 'AI makes cross-border business simpler'}
                </p>
            </div>
             <div>
               <h4 className="text-white font-semibold mb-4">
                  {language === 'zh' ? '购物指南' : language === 'es' ? 'Guía de Compra' : language === 'pt' ? 'Guia de Compras' : 'Shopping Guide'}
               </h4>
               <ul className="space-y-2 text-sm">
                 <li>{language === 'zh' ? '如何下单' : language === 'es' ? 'Cómo Pedir' : language === 'pt' ? 'Como Pedir' : 'How to Order'}</li>
                 <li>{language === 'zh' ? '支付方式' : language === 'es' ? 'Métodos de Pago' : language === 'pt' ? 'Formas de Pagamento' : 'Payment Methods'}</li>
                 <li>{language === 'zh' ? '配送说明' : language === 'es' ? 'Información de Envío' : language === 'pt' ? 'Informações de Entrega' : 'Shipping Info'}</li>
                 <li>{language === 'zh' ? '退换货政策' : language === 'es' ? 'Política de Devoluciones' : language === 'pt' ? 'Política de Devolução' : 'Return Policy'}</li>
               </ul>
             </div>
             <div>
               <h4 className="text-white font-semibold mb-4">
                  {language === 'zh' ? '客户服务' : language === 'es' ? 'Atención al Cliente' : language === 'pt' ? 'Atendimento ao Cliente' : 'Customer Service'}
               </h4>
               <ul className="space-y-2 text-sm">
                 <li>{language === 'zh' ? '帮助中心' : language === 'es' ? 'Centro de Ayuda' : language === 'pt' ? 'Central de Ajuda' : 'Help Center'}</li>
                 <li>{language === 'zh' ? '联系我们' : language === 'es' ? 'Contáctanos' : language === 'pt' ? 'Fale Conosco' : 'Contact Us'}</li>
                 <li>{language === 'zh' ? '常见问题' : language === 'es' ? 'Preguntas Frecuentes' : language === 'pt' ? 'Perguntas Frequentes' : 'FAQ'}</li>
               </ul>
             </div>
             <div>
               <h4 className="text-white font-semibold mb-4">
                  {language === 'zh' ? '关于我们' : language === 'es' ? 'Sobre Nosotros' : language === 'pt' ? 'Sobre Nós' : 'About Us'}
               </h4>
               <ul className="space-y-2 text-sm">
                 <li>{language === 'zh' ? '公司介绍' : language === 'es' ? 'About Flow' : language === 'pt' ? 'Sobre a Flow' : 'About Flow'}</li>
                 <li>{language === 'zh' ? '卖家入驻' : language === 'es' ? 'Sell on Flow' : language === 'pt' ? 'Sell on Flow' : 'Sell on Flow'}</li>
                 <li>{language === 'zh' ? '隐私政策' : language === 'es' ? 'Política de Privacidad' : language === 'pt' ? 'Política de Privacidade' : 'Privacy Policy'}</li>
                 <li>{language === 'zh' ? '服务条款' : language === 'es' ? 'Términos de Servicio' : language === 'pt' ? 'Termos de Serviço' : 'Terms of Service'}</li>
               </ul>
             </div>
          </div>
           <div className="border-t border-[#1a3a5c] mt-8 pt-8 text-center text-sm">
              © 2024 Flow. {language === 'zh' ? '保留所有权利。' : language === 'es' ? 'Todos los derechos reservados.' : language === 'pt' ? 'Todos os direitos reservados.' : 'All rights reserved.'}
            </div>
        </div>
      </footer>
    </div>
  );
};

export default BuyerLayout;
