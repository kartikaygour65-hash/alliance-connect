import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  UtensilsCrossed,
  ArrowRight,
  Zap,
  Swords,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { AdminThumbnailUpdate } from "@/components/admin/AdminThumbnailUpdate";
import { ImageIcon } from "lucide-react";

export function CampusCarousel() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [menuData, setMenuData] = useState<any>(null);
  const [topUser, setTopUser] = useState<any>(null);
  const [latestEvent, setLatestEvent] = useState<any>(null);
  const [siteSettings, setSiteSettings] = useState<any>({});
  const [showThumbUpload, setShowThumbUpload] = useState<string | null>(null);
  const isAdmin = profile?.role === 'admin' || profile?.username === 'arun' || profile?.username === 'koki';

  const [width, setWidth] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const fetchSettings = async () => {
    const { data } = await supabase.from('site_settings').select('key, value');
    if (data) {
      const settings = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
      setSiteSettings(settings);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const [menuRes, rankRes, eventRes] = await Promise.all([
        supabase.from('mess_menu').select('lunch, breakfast, snacks, dinner').eq('day_name', 'Today').maybeSingle(),
        supabase.from('profiles').select('id, username, total_aura').order('total_aura', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('events').select('carousel_display_url, cover_url').order('event_date', { ascending: true }).gte('event_date', new Date().toISOString()).limit(1).maybeSingle()
      ]);
      if (menuRes.data) setMenuData(menuRes.data);
      if (rankRes.data) setTopUser(rankRes.data);
      if (eventRes.data) setLatestEvent(eventRes.data);
    };
    loadData();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (carouselRef.current) {
      setWidth(carouselRef.current.scrollWidth - carouselRef.current.offsetWidth);
    }
  }, [menuData, topUser, latestEvent]);

  const cards = [
    {
      id: 'events',
      title: "Events",
      subtitle: "Campus Life",
      icon: <Calendar className="h-5 w-5 text-white z-10 relative" />,
      color: "from-pink-500/30 via-pink-500/10 to-transparent",
      borderColor: "border-pink-500/30",
      glow: "shadow-[0_0_20px_rgba(236,72,153,0.15)]",
      path: "/events",
      bgImage: latestEvent?.carousel_display_url || latestEvent?.cover_url || "/events.png"
    },
    {
      id: 'mess',
      title: "Mess Menu",
      subtitle: "Alliance Food Court",
      icon: <UtensilsCrossed className="h-5 w-5 text-white z-10 relative" />,
      color: "from-orange-500/30 via-orange-500/10 to-transparent",
      borderColor: "border-orange-500/30",
      glow: "shadow-[0_0_20px_rgba(249,115,22,0.15)]",
      path: "/mess-menu",
      bgImage: siteSettings.mess_menu_thumbnail || "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800",
      settingKey: "mess_menu_thumbnail"
    },
    {
      id: 'duel',
      title: "Aura Rank",
      subtitle: "Campus Duel",
      icon: <Swords className="h-5 w-5 text-white z-10 relative" />,
      color: "from-yellow-500/30 via-yellow-500/10 to-transparent",
      borderColor: "border-yellow-500/30",
      glow: "shadow-[0_0_20px_rgba(234,179,8,0.15)]",
      path: "/leaderboard",
      bgImage: siteSettings.leaderboard_thumbnail || "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&q=80&w=800",
      settingKey: "leaderboard_thumbnail"
    }
  ];

  return (
    <div className="relative mb-8 w-full overflow-hidden" ref={carouselRef}>
      <motion.div
        drag="x"
        dragConstraints={{ right: 0, left: -width - 64 }}
        dragElastic={0.1}
        className="flex gap-4 px-4 w-max py-2 cursor-grab active:cursor-grabbing"
      >
        {cards.map((card) => (
          <motion.div
            key={card.id}
            whileTap={{ scale: 0.97 }}
            className={`min-w-[280px] md:min-w-[340px] glass-card p-6 rounded-[2rem] border ${card.borderColor} ${card.glow} relative overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${!card.bgImage && `bg-gradient-to-br ${card.color}`}`}
            style={card.bgImage ? {
              backgroundImage: `url(${card.bgImage})`,
              backgroundSize: card.id === 'events' ? '125% auto' : 'cover',
              backgroundPosition: card.id === 'events' ? 'center 20%' : 'center'
            } : {}}
            onClick={() => navigate(card.path)}
          >
            {card.bgImage && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/30 z-0" />
            )}
            <div className="flex justify-between items-start pointer-events-none relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-background/50">{card.icon}</div>
                  <h3 className={`text-xl font-bold uppercase tracking-tight ${card.bgImage ? "text-white [text-shadow:_0_1px_10px_rgb(0_0_0_/_60%)]" : ""}`}>
                    {card.title}
                  </h3>
                </div>
                <p className={`text-[9px] font-bold uppercase tracking-widest ${card.bgImage ? "opacity-90 text-white [text-shadow:_0_1px_5px_rgb(0_0_0_/_40%)]" : "opacity-40"}`}>
                  {card.subtitle}
                </p>
              </div>
              <div className="flex gap-2 relative z-20">
                {isAdmin && card.settingKey && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowThumbUpload(card.settingKey as string);
                    }}
                    className="bg-white/10 p-2.5 rounded-2xl shadow-lg backdrop-blur-md border border-white/10 hover:bg-white/20 transition-all"
                  >
                    <ImageIcon className="h-4 w-4 text-white" />
                  </button>
                )}
                <div className="bg-white/10 p-2.5 rounded-2xl shadow-lg backdrop-blur-md border border-white/10">
                  <ArrowRight className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>

            <div className="mt-4 pointer-events-none min-h-[40px] relative z-10">
              {card.id === 'mess' && (
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-widest opacity-30">Coming up next:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {menuData?.lunch?.length > 0 ? (
                      menuData.lunch.slice(0, 3).map((i: string) => (
                        <Badge key={i} variant="secondary" className="bg-white/5 border-none text-[8px] uppercase font-bold py-1 px-2 text-orange-200">
                          {i}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[9px] font-bold opacity-20 uppercase tracking-tighter">Menu not uploaded yet</span>
                    )}
                  </div>
                </div>
              )}

              {card.id === 'duel' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-bold uppercase relative z-10">
                    <span className={`${card.bgImage ? "text-white opacity-80" : "opacity-40"}`}>Gap to #1</span>
                    <span className="text-yellow-500 [text-shadow:_0_0_10px_rgba(234,179,8,0.5)]">
                      {Math.max(((topUser?.total_aura || 0) - (profile?.total_aura || 0)), 0)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden relative z-10 backdrop-blur-sm border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(((profile?.total_aura || 0) / (topUser?.total_aura || 1)) * 100, 100)}%` }}
                      className="h-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.6)]"
                    />
                  </div>
                </div>
              )}

              {card.id === 'events' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
                    <span className={`text-[9px] font-bold uppercase tracking-widest text-pink-500 ${card.bgImage ? "[text-shadow:_0_1px_4px_rgba(0,0,0,0.5)]" : ""}`}>
                      Don't Miss Out
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-6 w-6 rounded-full border-2 border-background bg-secondary flex items-center justify-center overflow-hidden">
                        <div className={`w-full h-full bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 opacity-${100 - (i * 20)}`} />
                      </div>
                    ))}
                    <div className="h-6 w-6 rounded-full border-2 border-background bg-secondary flex items-center justify-center text-[8px] font-bold">
                      +
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        <div className="min-w-[20px]" />
      </motion.div>

      {showThumbUpload && (
        <AdminThumbnailUpdate
          isOpen={!!showThumbUpload}
          onClose={() => setShowThumbUpload(null)}
          onSuccess={fetchSettings}
          settingKey={showThumbUpload as any}
          title={showThumbUpload.includes('mess') ? "Mess Menu" : "Aura Rank"}
        />
      )}
    </div>
  );
}