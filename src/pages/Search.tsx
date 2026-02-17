import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search as SearchIcon, Loader2, Users, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { sanitizeSearchQuery, searchLimiter } from "@/lib/security";

interface UserResult {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  total_aura: number | null;
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      // Rate limit: 30 searches per minute
      if (!searchLimiter.canProceed('search_page')) {
        return;
      }

      // SECURITY: Sanitize search input to prevent PostgREST filter injection
      const sanitized = sanitizeSearchQuery(debouncedQuery);
      if (!sanitized || sanitized.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, department, total_aura')
        .or(`username.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`)
        .limit(10);

      if (error) {
        console.error("Search error:", error);
      } else {
        setResults(data as UserResult[]);
      }
      setLoading(false);
    };

    search();
  }, [debouncedQuery]);

  const getInitials = (name: string | null) => {
    if (!name) return "AU";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search name or @username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 h-14 rounded-2xl bg-secondary/30 border-white/5 focus:border-primary/50 text-base"
          />
          {loading && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
          )}
        </motion.div>

        {/* Results */}
        <div className="mt-6 space-y-3">
          {results.length === 0 && debouncedQuery.length >= 2 && !loading && (
            <div className="text-center py-10 opacity-40">
              <Users className="h-12 w-12 mx-auto mb-3" />
              <p className="text-sm font-bold uppercase tracking-widest">No users found</p>
            </div>
          )}

          {results.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/profile/${user.username}`}
                className="flex items-center gap-4 p-4 rounded-[1.5rem] bg-secondary/20 border border-white/5 hover:bg-secondary/40 transition-all group"
              >
                <Avatar className="h-12 w-12 border border-white/10 group-hover:scale-105 transition-transform">
                  <AvatarImage src={user.avatar_url || ""} />
                  <AvatarFallback className="bg-primary/20 text-primary font-bold">
                    {getInitials(user.full_name || user.username)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate text-sm uppercase tracking-tight">
                    {user.full_name || user.username}
                  </p>
                  <p className="text-[10px] font-bold text-muted-foreground truncate uppercase tracking-widest opacity-60">
                    @{user.username} {user.department && `• ${user.department}`}
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-sm font-black text-primary">{user.total_aura || 0}</span>
                    <Star className="h-3 w-3 text-primary fill-primary" />
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-tighter opacity-30">Aura</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {query.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 rounded-3xl bg-primary/10 mx-auto mb-4 flex items-center justify-center border border-primary/20">
              <SearchIcon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest mb-1">Find your squad</h3>
            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-tighter opacity-40">
              Search by name, username or department
            </p>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}