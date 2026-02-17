import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Shield, ShieldCheck, User, MoreVertical, UserMinus, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  joined_at: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
    full_name: string | null;
  };
}

interface CircleMembersProps {
  circleId: string;
  isAdmin: boolean;
  currentUserRole: string | null;
}

export function CircleMembers({ circleId, isAdmin, currentUserRole }: CircleMembersProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    const { data: membersData } = await supabase
      .from('circle_members')
      .select('*')
      .eq('circle_id', circleId)
      .order('role', { ascending: true });

    if (!membersData) {
      setLoading(false);
      return;
    }

    const userIds = membersData.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, full_name')
      .in('user_id', userIds);

    const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    const membersWithProfiles = membersData.map(m => ({
      ...m,
      profile: profilesMap.get(m.user_id)
    }));

    // Sort: admin first, then moderators, then members
    const roleOrder = { admin: 0, moderator: 1, member: 2 };
    membersWithProfiles.sort((a, b) => roleOrder[a.role] - roleOrder[b.role]);

    setMembers(membersWithProfiles);
    setLoading(false);
  }, [circleId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handlePromote = async (memberId: string, newRole: 'moderator' | 'admin') => {
    try {
      const { error } = await supabase
        .from('circle_members')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
      toast.success(`Member promoted to ${newRole}`);
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to promote');
    }
  };

  const handleDemote = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('circle_members')
        .update({ role: 'member' })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member demoted');
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to demote');
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('circle_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member removed');
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 gap-1">
            <Crown className="h-3 w-3" /> Admin
          </Badge>
        );
      case 'moderator':
        return (
          <Badge className="bg-blue-500/20 text-blue-500 gap-1">
            <ShieldCheck className="h-3 w-3" /> Mod
          </Badge>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">
        {members.length} member{members.length !== 1 ? 's' : ''}
      </p>

      {members.map((member, index) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.03 }}
          className="glass-card p-3 rounded-xl flex items-center justify-between"
        >
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={() => member.profile?.username && navigate(`/profile/${member.profile.username}`)}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={member.profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {member.profile?.username?.slice(0, 2).toUpperCase() || '??'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">
                  {member.profile?.full_name || member.profile?.username || 'Unknown'}
                </p>
                {getRoleBadge(member.role)}
              </div>
              <p className="text-xs text-muted-foreground">
                @{member.profile?.username || 'unknown'}
              </p>
            </div>
          </div>

          {/* Admin actions */}
          {isAdmin && member.user_id !== user?.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {member.role === 'member' && (
                  <DropdownMenuItem onClick={() => handlePromote(member.id, 'moderator')}>
                    <Shield className="h-4 w-4 mr-2" />
                    Make Moderator
                  </DropdownMenuItem>
                )}
                {member.role === 'moderator' && (
                  <>
                    <DropdownMenuItem onClick={() => handlePromote(member.id, 'admin')}>
                      <Crown className="h-4 w-4 mr-2" />
                      Make Admin
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDemote(member.id)}>
                      <User className="h-4 w-4 mr-2" />
                      Demote to Member
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleRemove(member.id)}
                  className="text-destructive"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove from Circle
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </motion.div>
      ))}
    </div>
  );
}
