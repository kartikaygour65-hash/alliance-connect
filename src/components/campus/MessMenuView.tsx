import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Coffee, Sun, Moon, Pizza, Upload, Maximize2, X, AlertTriangle, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AdminMenuUpload } from "@/components/admin/AdminMenuUpload";
import { AdminThumbnailUpdate } from "@/components/admin/AdminThumbnailUpdate";
import { useAuth } from "@/hooks/useAuth";

export function MessMenuView() {
    const [menu, setMenu] = useState<any>(null);
    const [siteSettings, setSiteSettings] = useState<any>({});
    const [showUpload, setShowUpload] = useState(false);
    const [showThumbUpload, setShowThumbUpload] = useState(false);
    const [showFullMenu, setShowFullMenu] = useState(false);
    const { profile, isAdmin } = useAuth();

    const fetchSettings = async () => {
        const { data } = await supabase.from('site_settings').select('key, value');
        if (data) {
            const settings = data.reduce((acc: any, curr: any) => ({ ...acc, [curr.key]: curr.value }), {});
            setSiteSettings(settings);
        }
    };

    const fetchMenu = async () => {
        const { data } = await supabase
            .from('mess_menu')
            .select('*')
            .eq('day_name', 'Today')
            .maybeSingle();
        setMenu(data);
    };

    useEffect(() => {
        fetchMenu();
        fetchSettings();
    }, []);

    const mealSections = [
        { label: "Breakfast", icon: <Coffee className="text-orange-400" />, items: menu?.breakfast || [] },
        { label: "Lunch", icon: <Sun className="text-yellow-500" />, items: menu?.lunch || [] },
        { label: "Snacks", icon: <Pizza className="text-red-400" />, items: menu?.snacks || [] },
        { label: "Dinner", icon: <Moon className="text-indigo-400" />, items: menu?.dinner || [] },
    ];

    return (
        <div className="max-w-3xl mx-auto px-4 pb-24 h-full">
            <div className="flex justify-between items-center mb-6 mt-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black uppercase tracking-tighter gradient-text leading-none">Mess Compass</h1>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 italic">
                        Today&apos;s fuel for {profile?.username || "campus"}
                    </p>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowThumbUpload(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl text-white/70 text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10 transition-all"
                        >
                            <ImageIcon className="h-4 w-4" />
                            Thumbnail
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowUpload(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-2xl text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary/20 transition-all"
                        >
                            <Upload className="h-4 w-4" />
                            Update Menu
                        </motion.button>
                    </div>
                )}
            </div>

            {/* TODAY SUMMARY + IMAGE PREVIEW */}
            <div className="grid gap-4 mb-8">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => menu?.image_url && setShowFullMenu(true)}
                    className={`relative w-full h-48 rounded-[2.5rem] overflow-hidden group border border-white/10 ${menu?.image_url ? 'cursor-pointer' : ''}`}
                >
                    <img
                        src={siteSettings.mess_menu_thumbnail || "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=2029&auto=format&fit=crop"}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        alt="Menu Backdrop"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                    <div className="absolute bottom-6 left-8 right-8 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 mb-1 drop-shadow-md">Campus Canteen</p>
                            <h3 className="text-xl font-black uppercase tracking-tighter text-white drop-shadow-lg leading-none italic">
                                {menu?.image_url ? "Click here to view full menu" : "No Menu Signal Detected"}
                            </h3>
                        </div>
                        {menu?.image_url && (
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-white animate-pulse">
                                <Maximize2 className="h-5 w-5" />
                            </div>
                        )}
                    </div>

                    {!menu?.image_url && (
                        <div className="absolute top-6 right-8 flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 backdrop-blur-md rounded-full border border-yellow-500/30">
                            <AlertTriangle className="h-3 w-3 text-yellow-500" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-yellow-500">Awaiting Upload</span>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* MEAL SECTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mealSections.map((section) => (
                    <motion.div
                        key={section.label}
                        className="glass-card p-6 rounded-[2rem] border-none shadow-lg flex flex-col bg-white/5"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 bg-background/50 rounded-xl border border-white/5">{section.icon}</div>
                            <h3 className="font-bold uppercase tracking-widest text-[10px]">{section.label}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 content-start flex-1">
                            {section.items && section.items.length > 0 ? (
                                section.items.map((item: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="bg-white/5 uppercase text-[9px] font-bold py-1.5 px-3 border-none text-muted-foreground whitespace-normal text-left">
                                        {item}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-[9px] opacity-40 uppercase font-bold italic">
                                    {menu?.image_url ? "Tap Image for Details" : "Not updated"}
                                </span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* FULL SCREEN IMAGE OVERLAY */}
            <AnimatePresence>
                {showFullMenu && menu?.image_url && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[3000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md"
                        onClick={() => setShowFullMenu(false)}
                    >
                        <button className="absolute top-8 right-8 p-3 bg-white/10 rounded-full text-white"><X className="h-6 w-6" /></button>
                        <img
                            src={menu.image_url}
                            className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AdminMenuUpload isOpen={showUpload} onClose={() => setShowUpload(false)} onSuccess={fetchMenu} />
            <AdminThumbnailUpdate
                isOpen={showThumbUpload}
                onClose={() => setShowThumbUpload(false)}
                onSuccess={fetchSettings}
                settingKey="mess_menu_thumbnail"
                title="Mess Menu"
            />
        </div>
    );
}
