import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreateConfession } from "@/components/secretroom/CreateConfession";
import { ConfessionCard } from "@/components/secretroom/ConfessionCard"; // Ensure this component is updated to handle null user_id if needed
import { ConfessionComments } from "@/components/secretroom/ConfessionComments";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Confession {
  id: string;
  content: string;
  aura_count: number;
  comments_count: number;
  is_highlighted: boolean;
  created_at: string;
  user_id: string | null; // Updated to allow null for anonymous users
}

export default function SecretRoom() {
  const { user, profile } = useAuth();
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [userAuras, setUserAuras] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConfessionId, setSelectedConfessionId] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin =
    profile?.role === 'admin' ||
    profile?.role === 'developer' ||
    profile?.username === 'arun' ||
    profile?.username === 'koki' ||
    [
      'carunbtech23@ced.alliance.edu.in',
      'gkartikaybtech23@ced.alliance.edu.in',
      'aateefbtech23@ced.alliance.edu.in',
      'sshlokbtech23@ced.alliance.edu.in',
      'aateef@ced.alliance.edu.in',
      'sshlok@ced.alliance.edu.in'
    ].includes(user?.email || '');

  const fetchConfessions = useCallback(async () => {
    // SECURITY FIX: Fetch from 'secure_confessions' view instead of raw table
    // This ensures user_id is NULL for anonymous posts at the database level
    const { data, error } = await supabase
      .from('secure_confessions')
      .select('id, content, aura_count, comments_count, is_highlighted, created_at, user_id')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching confessions:", error);
      toast.error("Failed to load confessions");
      return;
    }

    setConfessions(data || []);
  }, []);

  const fetchUserAuras = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('confession_auras')
      .select('confession_id')
      .eq('user_id', user.id);

    setUserAuras(new Set(data?.map(a => a.confession_id) || []));
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchConfessions(), fetchUserAuras()]);
    setLoading(false);
  }, [fetchConfessions, fetchUserAuras]);

  useEffect(() => {
    loadData();

    // Listen to changes on the underlying table, but re-fetch from the view
    const channel = supabase
      .channel('confessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confessions' }, () => {
        fetchConfessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData, fetchConfessions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConfessions(); // Just re-fetch confessions, no need to full reload
    setRefreshing(false);
  };

  const handleToggleAura = async (confessionId: string) => {
    if (!user) return;

    const hasAura = userAuras.has(confessionId);

    // Optimistic update
    setUserAuras(prev => {
      const next = new Set(prev);
      if (hasAura) {
        next.delete(confessionId);
      } else {
        next.add(confessionId);
      }
      return next;
    });

    // Update UI count optimistically
    setConfessions(prev => prev.map(c => {
      if (c.id === confessionId) {
        return {
          ...c,
          aura_count: hasAura ? c.aura_count - 1 : c.aura_count + 1
        };
      }
      return c;
    }));

    try {
      if (hasAura) {
        const { error } = await supabase
          .from('confession_auras')
          .delete()
          .eq('confession_id', confessionId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('confession_auras')
          .insert({ confession_id: confessionId, user_id: user.id });
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error toggling aura:", error);
      // Revert optimistic update on error
      setUserAuras(prev => {
        const next = new Set(prev);
        if (hasAura) next.add(confessionId);
        else next.delete(confessionId);
        return next;
      });
      toast.error("Failed to update aura");
    }
  };

  const handleReport = async () => {
    if (!user || !reportingId) return;

    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        content_type: 'confession',
        content_id: reportingId,
        reason: 'Inappropriate content'
      });

      if (error) throw error;
      toast.success('Report submitted. We will review this confession.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit report');
    } finally {
      setReportingId(null);
    }
  };

  const handleConfessionCreated = () => {
    fetchConfessions();
    toast.success("Confession posted anonymously!");
  };

  const handleDeleteConfession = async () => {
    if (!isAdmin || !deletingId) return;

    try {
      // Use .select() to verify if the deletion actually happened
      const { data, error } = await supabase
        .from('confessions')
        .delete()
        .eq('id', deletingId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Security Lock: Database blocked deletion. Row still exists. Run the SQL Panic Fix.");
      }

      setConfessions(prev => prev.filter(c => c.id !== deletingId));
      toast.success("Signal permanently purged from database");
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(error.message || "Failed to delete confession. Check DB permissions.");
      fetchConfessions(); // Re-fetch to restore UI state
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 mx-auto mb-3 flex items-center justify-center">
            <span className="text-3xl">🎭</span>
          </div>
          <h1 className="text-2xl font-bold gradient-text mb-2">Secret Room</h1>
          <p className="text-sm text-muted-foreground">
            Share your thoughts anonymously. No one will know who you are.
          </p>
        </motion.div>

        {/* Refresh button */}
        <div className="flex justify-center mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="rounded-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Create confession */}
        <CreateConfession onCreated={handleConfessionCreated} />

        {/* Confessions list */}
        <div className="space-y-4">
          {confessions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No confessions yet. Be the first!</p>
            </div>
          ) : (
            confessions.map((confession, index) => (
              <motion.div
                key={confession.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ConfessionCard
                  confession={confession}
                  hasAura={userAuras.has(confession.id)}
                  onToggleAura={() => handleToggleAura(confession.id)}
                  onComment={() => setSelectedConfessionId(confession.id)}
                  onReport={() => setReportingId(confession.id)}
                  onDelete={() => setDeletingId(confession.id)}
                  isAdmin={isAdmin}
                />
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Comments sheet */}
      {selectedConfessionId && (
        <ConfessionComments
          confessionId={selectedConfessionId}
          onClose={() => setSelectedConfessionId(null)}
          isAdmin={isAdmin}
        />
      )}

      {/* Report dialog */}
      <AlertDialog open={!!reportingId} onOpenChange={(open) => !open && setReportingId(null)}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Report Confession
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to report this confession? Our moderators will review it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReport} className="bg-destructive text-destructive-foreground">
              Report
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-5 w-5" />
              Delete Confession
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this confession? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfession} className="bg-red-500 text-white hover:bg-red-600">
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}