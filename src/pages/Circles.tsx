import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Loader2, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CircleCard } from "@/components/circles/CircleCard";
import { CreateCircleModal } from "@/components/circles/CreateCircleModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Circle {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_private: boolean;
  member_count: number;
  created_by: string;
}

export default function Circles() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [userMemberships, setUserMemberships] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const fetchCircles = useCallback(async () => {
    const { data } = await supabase
      .from('circles')
      .select('*')
      .order('member_count', { ascending: false });

    if (!data) { setCircles([]); return; }

    // Fetch real member counts for all circles to fix drift/mismatch
    const circlesWithRealCounts = await Promise.all(
      data.map(async (circle) => {
        const { count } = await supabase
          .from('circle_members')
          .select('*', { count: 'exact', head: true })
          .eq('circle_id', circle.id);
        return { ...circle, member_count: Math.max(0, count || 0) };
      })
    );

    setCircles(circlesWithRealCounts);
  }, []);

  const fetchMemberships = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', user.id);

    setUserMemberships(new Set(data?.map(m => m.circle_id) || []));
  }, [user]);

  const fetchPendingRequests = useCallback(async () => {
    if (!user) return;
    // Check for pending circle join request notifications sent BY this user
    const { data } = await supabase
      .from('notifications')
      .select('data')
      .eq('type', 'circle_join_request')
      .eq('is_read', false)
      .contains('data', { requester_id: user.id });

    const pendingCircleIds = new Set(
      data?.map(n => n.data?.circle_id).filter(Boolean) || []
    );
    setPendingRequests(pendingCircleIds);
  }, [user]);

  const loadData = useCallback(async () => {
    await Promise.all([fetchCircles(), fetchMemberships(), fetchPendingRequests()]);
    setLoading(false);
  }, [fetchCircles, fetchMemberships, fetchPendingRequests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoin = async (circleId: string) => {
    if (!user) return;

    // Find the circle to check if it's private
    const targetCircle = circles.find(c => c.id === circleId);

    try {
      if (targetCircle?.is_private) {
        // PRIVATE CIRCLE: Send a join request notification to the circle admin
        const { error } = await supabase.from('notifications').insert({
          user_id: targetCircle.created_by, // Send to circle creator/admin
          type: 'circle_join_request',
          title: 'Circle Join Request',
          body: `wants to join ${targetCircle.name}`,
          data: {
            circle_id: circleId,
            circle_name: targetCircle.name,
            requester_id: user.id,
          },
          is_read: false,
        });

        if (error) throw error;

        setPendingRequests(prev => new Set([...prev, circleId]));
        toast.success('Join request sent! Waiting for admin approval.');
      } else {
        // PUBLIC CIRCLE: Join instantly
        const { error } = await supabase
          .from('circle_members')
          .insert({ circle_id: circleId, user_id: user.id });

        if (error) throw error;

        setUserMemberships(prev => new Set([...prev, circleId]));
        fetchCircles();
        toast.success('Joined circle!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to join circle');
    }
  };

  const handleLeave = async (circleId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', circleId)
        .eq('user_id', user.id);

      if (error) throw error;

      setUserMemberships(prev => {
        const next = new Set(prev);
        next.delete(circleId);
        return next;
      });
      fetchCircles();
      toast.success('Left circle');
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave circle');
    }
  };

  const filteredCircles = circles.filter(circle =>
    circle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    circle.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myCircles = filteredCircles.filter(c => userMemberships.has(c.id));
  const discoverCircles = filteredCircles.filter(c => !userMemberships.has(c.id));

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
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold gradient-text">Circles</h1>
            <p className="text-sm text-muted-foreground">Join communities that interest you</p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </motion.div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search circles..."
            className="pl-9 bg-secondary/30"
          />
        </div>

        {/* My Circles */}
        {myCircles.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8"
          >
            <h2 className="text-lg font-semibold mb-4">My Circles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {myCircles.map(circle => (
                <CircleCard
                  key={circle.id}
                  circle={circle}
                  isMember={true}
                  isPending={false}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onClick={(id) => navigate(`/circles/${id}`)}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* Discover Circles */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h2 className="text-lg font-semibold mb-4">Discover</h2>
          {discoverCircles.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-2xl">
              <div className="w-16 h-16 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-muted-foreground">No circles found. Create one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {discoverCircles.map(circle => (
                <CircleCard
                  key={circle.id}
                  circle={circle}
                  isMember={false}
                  isPending={pendingRequests.has(circle.id)}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onClick={(id) => navigate(`/circles/${id}`)}
                />
              ))}
            </div>
          )}
        </motion.section>
      </div>

      <CreateCircleModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreated={() => {
          fetchCircles();
          fetchMemberships();
          setShowCreateModal(false);
        }}
      />
    </AppLayout>
  );
}
