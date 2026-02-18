import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Swords, Crown, Star, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { AdminThumbnailUpdate } from "@/components/admin/AdminThumbnailUpdate";
import { ImageIcon } from "lucide-react";

export function LeaderboardView() {
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [siteSettings, setSiteSettings] = useState<any>({});
    const [showThumbUpload, setShowThumbUpload] = useState(false);
    const { profile } = useAuth();
    const isAdmin = profile?.role === 'admin' || profile?.username === 'arun' || profile?.username === 'koki';

    const fetchSettings = async () => {
        const { data } = await supabase.from('site_settings').select('key, value');
        if (data) {
            const settings = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
            setSiteSettings(settings);
        }
    };

    const fetchLeaderboard = async () => {
        // Fetch top 100 users sorted by Aura
        const { data } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, total_aura, department')
            .neq('username', 'auconnect')
            .neq('username', 'AUCONNECT')
            .order('total_aura', { ascending: false, nullsFirst: false })
            .limit(100);

        if (data) setTopUsers(data);
    };

    useEffect(() => {
        fetchLeaderboard();
        fetchSettings();

        // REAL-TIME SUBSCRIPTION
        const channel = supabase
            .channel('leaderboard-updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles' },
                (payload) => {
                    fetchLeaderboard();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const podium = topUsers.slice(0, 3);
    const list = topUsers.slice(3);

    return (
        <div className="max-w-2xl mx-auto px-4 pb-24">
            {isAdmin && (
                <div className="flex justify-end mb-4 mt-2">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowThumbUpload(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl text-white/70 text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                    >
                        <ImageIcon className="h-4 w-4" />
                        Update Backdrop
                    </motion.button>
                </div>
            )}
            {/* Header Section with Background */}
            <div className="relative w-full h-48 rounded-[3rem] overflow-hidden mb-12 mt-6 border border-white/10 group shadow-2xl">
                <img
                    src={siteSettings.leaderboard_thumbnail || "https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop"}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-1000 group-hover:scale-110"
                    alt="Leaderboard Backdrop"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                    <div className="p-3 bg-yellow-500/20 backdrop-blur-xl rounded-full mb-3 border border-yellow-500/30 relative">
                        <Swords className="h-6 w-6 text-yellow-500" />
                        <div className="absolute -top-1 -right-1">
                            <span className="flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                        </div>
                    </div>
                    <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] leading-none">
                        Campus Clash
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-yellow-500 mt-3 drop-shadow-md brightness-150">
                        Season Reset: {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate()} Days
                    </p>
                </div>
            </div>

            {/* Podium Section */}
            <div className="flex justify-center items-end gap-3 mb-12 h-64">
                {/* Rank 2 */}
                {podium[1] && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-col items-center w-1/3">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-full border-4 border-slate-400 overflow-hidden shadow-xl">
                                <img src={podium[1].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${podium[1].username}`} alt="" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-slate-400 text-black text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center border-2 border-background">2</div>
                        </div>
                        <p className="text-[10px] font-bold mt-3 opacity-60 uppercase truncate w-full text-center">{podium[1].username}</p>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs font-black text-slate-400">{podium[1].total_aura || 0}</span>
                            <Star className="h-2 w-2 fill-slate-400 text-slate-400" />
                        </div>
                        <div className="h-24 w-full bg-gradient-to-t from-slate-400/20 to-transparent mt-2 rounded-t-xl border-x border-t border-white/5" />
                    </motion.div>
                )}

                {/* Rank 1 (Center) */}
                {podium[0] && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center w-1/3 z-10">
                        <Crown className="text-yellow-500 h-8 w-8 mb-2 animate-bounce" />
                        <div className="relative">
                            <div className="h-24 w-24 rounded-full border-4 border-yellow-500 overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.4)]">
                                <img src={podium[0].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${podium[0].username}`} alt="" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs font-black h-8 w-8 rounded-full flex items-center justify-center border-2 border-background">1</div>
                        </div>
                        <p className="text-sm font-black mt-3 uppercase tracking-tight truncate w-full text-center text-yellow-500">{podium[0].username}</p>
                        <div className="flex items-center gap-1 mt-1 px-3 py-1 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                            <span className="text-sm font-black text-yellow-500">{podium[0].total_aura || 0}</span>
                            <Flame className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                        </div>
                        <div className="h-32 w-full bg-gradient-to-t from-yellow-500/20 to-transparent mt-2 rounded-t-2xl border-x border-t border-yellow-500/20" />
                    </motion.div>
                )}

                {/* Rank 3 */}
                {podium[2] && (
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="flex flex-col items-center w-1/3">
                        <div className="relative">
                            <div className="h-16 w-16 rounded-full border-4 border-amber-700 overflow-hidden shadow-xl">
                                <img src={podium[2].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${podium[2].username}`} alt="" />
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-amber-700 text-white text-[10px] font-black h-6 w-6 rounded-full flex items-center justify-center border-2 border-background">3</div>
                        </div>
                        <p className="text-[10px] font-bold mt-3 opacity-60 uppercase truncate w-full text-center">{podium[2].username}</p>
                        <div className="flex items-center gap-1 mt-1">
                            <span className="text-xs font-black text-amber-700">{podium[2].total_aura || 0}</span>
                            <Star className="h-2 w-2 fill-amber-700 text-amber-700" />
                        </div>
                        <div className="h-16 w-full bg-gradient-to-t from-amber-700/20 to-transparent mt-2 rounded-t-xl border-x border-t border-white/5" />
                    </motion.div>
                )}
            </div>

            {/* List Section */}
            <div className="space-y-3">
                <AnimatePresence>
                    {list.map((user, idx) => (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            key={user.id}
                            className={`flex items-center justify-between p-4 rounded-[1.5rem] border border-white/5 ${user.id === profile?.id ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]' : 'bg-secondary/20'}`}
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black opacity-30 w-4 text-center">{idx + 4}</span>
                                <div className="h-10 w-10 rounded-full overflow-hidden border border-white/10">
                                    <img src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="" />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-tight text-white">{user.username}</p>
                                    <p className="text-[9px] font-black opacity-60 uppercase tracking-widest text-primary">{user.department || 'Elite Student'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pr-2">
                                <span className="text-sm font-black text-white">{user.total_aura || 0}</span>
                                <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            <AdminThumbnailUpdate
                isOpen={showThumbUpload}
                onClose={() => setShowThumbUpload(false)}
                onSuccess={fetchSettings}
                settingKey="leaderboard_thumbnail"
                title="Leaderboard"
            />
        </div>
    );
}
