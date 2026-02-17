import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Star, Medal, ArrowUpRight, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { searchUsers } from "@/lib/supabase";
import { getInitials } from "@/lib/utils";

interface Post {
  id: string;
  images: string[] | null;
  video_url: string | null;
  aura_count: number | null;
  comments_count: number | null;
}

interface LeaderboardUser {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  total_aura: number;
  department: string;
  aura_growth: number;
  campus_rank: number;
}

export default function Explore() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Post[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const debouncedQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    fetchExplorePosts();
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      const { data, error } = await searchUsers(debouncedQuery);
      if (!error && data) setSearchResults(data);
      setIsSearching(false);
    };
    performSearch();
  }, [debouncedQuery]);

  const fetchLeaderboard = async () => {
    const { data } = await supabase.from("aura_leaderboard").select("*");
    if (data) setLeaderboard(data as LeaderboardUser[]);
  };

  const fetchExplorePosts = async () => {
    setLoading(true);
    const [pRes, rRes] = await Promise.all([
      supabase.from("posts").select("id, images, video_url, aura_count, comments_count").not("images", "is", null).order("aura_count", { ascending: false }).limit(21),
      supabase.from("posts").select("id, images, video_url, aura_count, comments_count").not("video_url", "is", null).order("aura_count", { ascending: false }).limit(10)
    ]);
    if (pRes.data) setPosts(pRes.data.filter(p => p.images && p.images.length > 0));
    if (rRes.data) setReels(rRes.data);
    setLoading(false);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Medal className="h-6 w-6 text-yellow-400 fill-yellow-400" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400 fill-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600 fill-amber-600" />;
    return <span className="text-xs font-black opacity-30 italic">#{rank}</span>;
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-24 relative">
        <div className="relative mb-6 z-50">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 opacity-30" />
          <Input placeholder="Search campus..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-14 rounded-2xl bg-white/5 border-none font-bold placeholder:opacity-30 focus-visible:ring-1 ring-primary/40 backdrop-blur-xl" />
          <AnimatePresence>
            {searchQuery.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-16 left-0 right-0 p-2 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-2xl space-y-1 max-h-[400px] overflow-y-auto scrollbar-hide">
                {isSearching ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin theme-text" /></div> : searchResults.length > 0 ? searchResults.map((user) => (
                  <Link key={user.user_id} to={`/profile/${user.username}`} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all group">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-white/10"><AvatarImage src={user.avatar_url} /><AvatarFallback>{getInitials(user.full_name)}</AvatarFallback></Avatar>
                      <div className="flex flex-col"><span className="text-sm font-black italic uppercase tracking-tighter leading-none">{user.full_name}</span><span className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">@{user.username}</span></div>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 theme-text transition-all" />
                  </Link>
                )) : <div className="p-8 text-center"><p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 italic">No signals found</p></div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-white/5 h-12 p-1 rounded-2xl mb-6 backdrop-blur-md">
            <TabsTrigger value="posts" className="rounded-xl font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-white/10">Feed</TabsTrigger>
            <TabsTrigger value="reels" className="rounded-xl font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-white/10">Reels</TabsTrigger>
            <TabsTrigger value="stars" className="rounded-xl font-black uppercase text-[10px] tracking-widest transition-all data-[state=active]:bg-white/10">Stars</TabsTrigger>
          </TabsList>

          <TabsContent value="posts">
            {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin theme-text" /></div> : (
              <div className="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden">
                {posts.map(p => (
                  <Link key={p.id} to={`/post/${p.id}`} className="aspect-square relative group">
                    <img src={p.images?.[0]} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-black uppercase">View Post</div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reels" className="mt-0">
            {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin theme-text" /></div> : (
              <div className="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden">
                {reels.map(r => (
                  <Link key={r.id} to={`/reels?start=${r.id}`} className="aspect-[2/3] sm:aspect-[9/16] relative bg-white/5 active:scale-95 transition-transform group overflow-hidden">
                    <video
                      src={r.video_url || ""}
                      className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-center gap-1 text-white font-black italic text-[9px] drop-shadow-lg">
                      <Star className="h-2.5 w-2.5 fill-primary text-primary" />
                      {r.aura_count}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stars" className="space-y-3">
            {leaderboard.map((u, i) => (
              <Link key={u.user_id || i} to={`/profile/${u.username}`} className="block">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`p-4 rounded-[2rem] flex items-center gap-4 border border-white/5 shadow-xl transition-colors backdrop-blur-sm ${u.campus_rank <= 3 ? 'bg-primary/5' : 'bg-white/5'} hover:bg-white/10`}>
                  <div className="w-10 flex justify-center">{getRankIcon(u.campus_rank)}</div>
                  <Avatar className="h-12 w-12 border-2 border-background shadow-lg"><AvatarImage src={u.avatar_url} /><AvatarFallback className="font-black bg-white/10 uppercase">{u.username?.[0]}</AvatarFallback></Avatar>
                  <div className="flex-1"><h4 className="font-black uppercase italic tracking-tighter text-sm text-foreground">{u.full_name}</h4><p className="text-[9px] font-black uppercase theme-text tracking-widest mt-1">{u.department || ''}</p></div>
                  <div className="text-right"><div className="flex items-center gap-1 justify-end font-black italic text-lg leading-none text-foreground"><Star className="h-4 w-4 theme-text fill-current" /> {u.total_aura}</div></div>
                </motion.div>
              </Link>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}