import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  MessageSquare,
  Sparkles,
  Store,
  Globe,
  LogOut,
  Tag,
  FileText,
  RotateCcw,
  Truck,
  Layers,
  Menu,
  Bot,
} from 'lucide-react';
import logoWhite from '@/assets/branding/logo-white.png';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@shared/api.interface';
import { Image } from '@/components/ui/image';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const SellerLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();

  const languageLabels: Record<Language, string> = {
    zh: '简体中文',
    en: 'English',
    es: 'Español',
    pt: 'Português',
  };

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  const navItems = [
    {
      to: '/seller/copilot',
      label: 'AI 运营副驾',
      icon: Bot,
    },
    {
      to: '/seller/dashboard',
      label: '数据看板',
      icon: LayoutDashboard,
    },
    {
      to: '/seller/products',
      label: '商品管理',
      icon: Package,
    },
    {
      to: '/seller/orders',
      label: '订单管理',
      icon: ShoppingCart,
    },
    {
      to: '/seller/inquiries',
      label: '咨询管理',
      icon: MessageSquare,
    },
    {
      to: '/seller/ai-center',
      label: 'AI 分析中心',
      icon: Sparkles,
    },
    {
      to: '/seller/coupons',
      label: '优惠券管理',
      icon: Tag,
    },
    {
      to: '/seller/refunds',
      label: '退款管理',
      icon: RotateCcw,
    },
    {
      to: '/seller/shipping-templates',
      label: '运费模板',
      icon: Truck,
    },
    {
      to: '/seller/collections',
      label: '集合管理',
      icon: Layers,
    },
    {
      to: '/seller/cms-pages',
      label: '页面管理',
      icon: FileText,
    },
    {
      to: '/seller/audit-logs',
      label: '操作审计',
      icon: FileText,
    },
  ];

  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const getPageTitle = (): string => {
    const item = navItems.find((nav) => location.pathname.startsWith(nav.to));
    return item?.label ?? '卖家中心';
  };

  return (
    <div className="flex h-screen w-full bg-slate-100">
      {/* 左侧侧边栏 */}
      <aside className="hidden w-60 flex-col bg-[#0B1F3A] text-slate-200 lg:flex">
        {/* Logo 区域 */}
        <div className="flex items-center gap-3 border-b border-[#1a3a5c] px-5 py-5">
          <Image
            src={logoWhite}
            alt="Flow"
            className="h-9 w-9 object-contain"
          />
          <div>
            <div className="text-base font-bold text-white">Flow</div>
            <div className="text-xs text-slate-400">卖家中心</div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#00C2B8] text-white shadow-sm'
                      : 'text-slate-300 hover:bg-[#1a3a5c] hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* 底部链接 */}
        <div className="border-t border-[#1a3a5c] p-4">
          <NavLink
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-[#1a3a5c] hover:text-white"
          >
            <Store className="h-4 w-4" />
            前往商城
          </NavLink>
        </div>
      </aside>

      {/* 右侧内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部栏 */}
        <header className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-0 bg-[#0B1F3A] p-0 text-slate-200">
                <SheetTitle className="flex items-center gap-3 border-b border-[#1a3a5c] px-5 py-4 text-left">
                  <Image src={logoWhite} alt="Flow" className="h-8 w-8 object-contain" />
                  <span className="text-base font-bold text-white">Flow</span>
                </SheetTitle>
                <nav className="space-y-1 px-3 py-4">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileNavOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-[#00C2B8] text-white shadow-sm'
                              : 'text-slate-300 hover:bg-[#1a3a5c] hover:text-white'
                          }`
                        }
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
            <h1 className="truncate text-base font-semibold text-slate-900 lg:text-lg">
              {getPageTitle()}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-slate-600"
                >
                  <Globe className="h-4 w-4" />
                  <span className="max-w-[90px] truncate text-sm">
                    {languageLabels[language]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {(['zh', 'en', 'es', 'pt'] as Language[]).map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={language === lang ? 'text-[#00C2B8] font-medium' : ''}
                  >
                    {languageLabels[lang]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-sm text-slate-700 font-medium">{user?.name || ''}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </header>

        {/* 面包屑 */}
        <div className="flex items-center gap-2 px-6 py-3 text-sm text-muted-foreground">
          <span>卖家中心</span>
          <span>/</span>
          <span className="text-slate-700">{getPageTitle()}</span>
        </div>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SellerLayout;
