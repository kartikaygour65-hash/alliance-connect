import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home, Search, PlusSquare, User, Menu,
  MessageCircle, Heart, Ghost, ShoppingBag, PackageSearch, Settings, LogOut, Palette,
  Users2, ChevronRight, ShieldAlert, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { signOut, supabase } from "@/lib/supabase";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { PulseBeacon } from "./PulseBeacon";

export function AppLayout({ children, showNav = true, disableScroll = false }: { children: React.ReactNode; showNav?: boolean; disableScroll?: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('feed-atmosphere') || 'aurora-violet');

  const atmospheres = [
    { id: 'aurora-emerald', name: 'Emerald', color: '#10b981' },
    { id: 'aurora-violet', name: 'Violet', color: '#8b5cf6' },
    { id: 'aurora-blue', name: 'Abyss', color: '#06b6d4' },
    { id: 'aurora-orange', name: 'Solar', color: '#f97316' },
    { id: 'aurora-rose', name: 'Crimson', color: '#f43f5e' },
    { id: 'midnight-obsidian', name: 'Midnight', color: '#000000' },
    { id: 'clean-minimal', name: 'Titanium', color: '#e4e4e7' },
  ];

  const updateAtmosphere = (id: string) => {
    setCurrentTheme(id);
    localStorage.setItem('feed-atmosphere', id);
    document.documentElement.setAttribute('data-theme', id);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    if (!user) return;
    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .neq('sender_id', user.id);
      setUnreadCount(count || 0);
    };

    fetchUnreadCount();

    const channel = supabase.channel('global-unread-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, fetchUnreadCount)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fetch unread notification count for the Activity dot
  useEffect(() => {
    if (!user) return;
    const fetchUnreadNotifs = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadNotifCount(count || 0);
    };

    fetchUnreadNotifs();

    const notifChannel = supabase.channel('global-notif-dot')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, fetchUnreadNotifs)
      .subscribe();

    return () => { supabase.removeChannel(notifChannel); };
  }, [user]);

  const desktopNavItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Explore", path: "/explore" },
    { icon: Heart, label: "Activity", path: "/activity" },
    { icon: Ghost, label: "Secret Room", path: "/secret-room" },
    { icon: ShoppingBag, label: "Marketplace", path: "/marketplace" },
    // Circles: replaces old "Squads" entry
    { icon: Users2, label: "Circles", path: "/circles" },
    { icon: PackageSearch, label: "Lost & Found", path: "/lost-found" },
    { icon: User, label: "Profile", path: profile?.username ? `/profile/${profile.username}` : "/profile" },
    { icon: Settings, label: "Settings", path: "/settings" },
    ...(isAdmin ? [{ icon: ShieldAlert, label: "Admin Panel", path: "/admin" }] : []),
  ];

  const isLight = currentTheme === 'clean-minimal';

  // Scroll to top on route change
  useEffect(() => {
    const mainEl = document.getElementById('main-scroll-area');
    if (mainEl) mainEl.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className={`h-full flex flex-col md:flex-row overflow-hidden transition-colors duration-1000 feed-atmosphere-container ${isLight ? 'text-zinc-900' : 'text-white'}`} data-theme={currentTheme}>

      {/* MOBILE HEADER */}
      {showNav && (
        <header className={`md:hidden fixed top-0 left-0 right-0 z-40 backdrop-blur-3xl border-b px-4 h-16 flex items-center justify-between transition-all ${isLight ? 'bg-white/70 border-black/5' : 'bg-black/40 border-white/10'}`}>
          <div className="flex-none">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild><Button variant="ghost" size="icon" className="rounded-2xl bg-current/5"><Menu className="h-5 w-5" /></Button></SheetTrigger>
              <SheetContent side="left" className={`w-[85%] p-6 border-none rounded-r-[3rem] backdrop-blur-3xl ${isLight ? 'bg-white/95 text-black' : 'bg-black/90 text-white'}`}>
                <SheetHeader className="text-left mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl border border-white/10 overflow-hidden bg-white/5 p-1.5 shadow-[0_0_20px_rgba(255,255,255,0.05)]">
                      <img src="/aulogo.png" className="w-full h-full object-contain" alt="Logo" />
                    </div>
                    <SheetTitle className="text-2xl font-black italic uppercase theme-text tracking-tighter">AUConnect</SheetTitle>
                  </div>
                </SheetHeader>
                <nav className="flex flex-col gap-2 overflow-y-auto max-h-[70vh] no-scrollbar">
                  {desktopNavItems.map((item, idx) => (
                    <Link key={idx} to={item.path!} onClick={() => setIsMenuOpen(false)} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-current/5 transition-all">
                      <item.icon className="h-5 w-5 opacity-70" /><span className="font-bold uppercase text-xs tracking-widest">{item.label}</span>
                    </Link>
                  ))}
                </nav>
                <Button variant="ghost" className="justify-start gap-4 h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest text-red-500 mt-auto" onClick={async () => { await signOut(); navigate("/auth"); }}>
                  <LogOut className="h-5 w-5" /> Logout
                </Button>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-hidden"><PulseBeacon /></div>

          <div className="flex-none flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="rounded-full opacity-70"><Palette className="h-5 w-5" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl p-2 w-48 shadow-2xl bg-black/90 border-white/10 text-white">
                {atmospheres.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => updateAtmosphere(t.id)} className="flex items-center gap-2 rounded-xl py-3 focus:bg-white/10">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-xs font-bold">{t.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="rounded-full relative" onClick={() => navigate('/messages')}>
              <MessageCircle className="h-5 w-5 opacity-70" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center border border-black">
                  {unreadCount}
                </span>
              )}
            </Button>
          </div>
        </header>
      )}

      {/* DESKTOP SIDEBAR */}
      {showNav && (
        <aside className={`hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r backdrop-blur-3xl p-4 z-50 bg-black/40 border-white/10`}>
          <div className="flex items-center gap-4 mb-10 px-4">
            <div className="w-14 h-14 rounded-xl border border-white/10 overflow-hidden bg-white/5 p-2 shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)]">
              <img src="/aulogo.png" className="w-full h-full object-contain" alt="Logo" />
            </div>
            <div className="text-2xl font-black italic uppercase theme-text tracking-tighter">AUConnect</div>
          </div>

          <div className="flex items-center gap-2 mb-8 px-2">
            <PulseBeacon />
            <div className="flex-1 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest opacity-40 italic">System Online</div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-2">
            {desktopNavItems.map((item, idx) => (
              <Link key={idx} to={item.path!} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all group ${location.pathname === item.path ? "bg-white/10 font-bold" : "opacity-60 hover:opacity-100 hover:bg-white/5"}`}>
                <item.icon className="h-5 w-5" /><span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* ENHANCED: DESKTOP ATMOSPHERE SELECTOR */}
          <div className="mt-4 px-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-between h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all group">
                  <div className="flex items-center gap-3">
                    <Palette className="h-4 w-4 opacity-70 group-hover:text-primary transition-colors" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-70">Atmosphere</span>
                  </div>
                  <ChevronRight className="h-3 w-3 opacity-30" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="rounded-2xl p-2 w-48 shadow-2xl bg-black/95 border-white/10 text-white backdrop-blur-xl">
                <div className="px-3 py-2 mb-1 border-b border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Select Visuals</span>
                </div>
                {atmospheres.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => updateAtmosphere(t.id)} className="flex items-center gap-3 rounded-xl py-3 focus:bg-white/10 cursor-pointer">
                    <div className="h-2.5 w-2.5 rounded-full shadow-[0_0_8px_currentcolor]" style={{ backgroundColor: t.color, color: t.color }} />
                    <span className="text-xs font-bold tracking-tight">{t.name}</span>
                    {currentTheme === t.id && <div className="ml-auto h-1 w-1 rounded-full bg-white animate-pulse" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button onClick={() => setShowCreateModal(true)} className="mt-4 w-full h-12 rounded-2xl font-black bg-white text-black hover:opacity-90 uppercase text-[10px] tracking-widest shadow-[0_4px_20px_rgba(255,255,255,0.1)]">Create Post</Button>
        </aside>
      )}

      <main id="main-scroll-area" className={`flex-1 ${showNav ? 'md:pl-64 pt-16 md:pt-0 pb-20 md:pb-0' : ''} ${disableScroll ? 'h-full overflow-hidden' : 'overflow-y-auto'} scroll-smooth scrollbar-hide`}>
        <div className={`${disableScroll ? 'h-full p-0' : 'px-2 pt-4 pb-8'} relative z-10 max-w-screen-2xl mx-auto flex flex-col items-center`}>
          {children}
        </div>
      </main>

      {/* MOBILE NAV BAR */}
      {showNav && (
        <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-3xl border-t h-20 px-6 flex items-center justify-around ${isLight ? 'bg-white/90 border-black/5' : 'bg-black/80 border-white/10'}`}>
          <button onClick={() => navigate('/')}><Home className={`h-6 w-6 ${location.pathname === '/' ? 'theme-text' : 'opacity-40'}`} /></button>
          <button onClick={() => navigate('/explore')}><Search className={`h-6 w-6 ${location.pathname === '/explore' ? 'theme-text' : 'opacity-40'}`} /></button>
          <button onClick={() => setShowCreateModal(true)}><PlusSquare className="h-8 w-8 theme-text" /></button>
          <button onClick={() => navigate('/activity')} className="relative">
            <Heart className={`h-6 w-6 ${location.pathname === '/activity' ? 'theme-text' : 'opacity-40'}`} />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-black animate-pulse" />
            )}
          </button>
          <button onClick={() => navigate(profile?.username ? `/profile/${profile.username}` : "/profile")}><User className={`h-6 w-6 ${location.pathname.includes('/profile') ? 'theme-text' : 'opacity-40'}`} /></button>
        </nav>
      )}

      <CreatePostModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}