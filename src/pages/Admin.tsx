import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X, ShieldAlert, Loader2, FileText, UserCheck } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VerificationRequest {
  user_id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  verification_status: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  message: string;
  type: string;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string;
    username: string;
    avatar_url?: string;
  };
}

export default function Admin() {
  const { user, profile: currentProfile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [reports, setReports] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Security Check: Only Admin can access
  useEffect(() => {
    if (currentProfile && !isAdmin) {
      navigate("/");
      toast.error("Unauthorized Access");
    }
  }, [currentProfile, isAdmin, navigate]);

  const fetchRequests = async () => {
    setLoading(true);
    // Fetch ONLY pending requests
    const { data: reqData, error: reqError } = await supabase
      .from('profiles')
      .select('*')
      .eq('verification_status', 'pending');

    if (reqError) {
      toast.error("Failed to fetch requests");
      setRequests([]);
    } else {
      setRequests(reqData || []);
    }

    setLoading(false);
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    const { data: repData, error: repError } = await supabase
      .from('support_tickets')
      .select('*, profiles:user_id(full_name, username, avatar_url)')
      .order('created_at', { ascending: false });

    if (repError) toast.error("Failed to fetch reports");
    else setReports(repData || []);

    setLoadingReports(false);
  };

  const handleResolveReport = async (id: string) => {
    const { error } = await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', id);
    if (error) toast.error("Failed to resolve");
    else {
      toast.success("Resolved");
      setReports(prev => prev.map(p => p.id === id ? { ...p, status: 'resolved' } : p));
    }
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
      fetchReports();
    }
  }, [user]);

  const handleApprove = async (targetProfile: any) => {
    setProcessingId(targetProfile.user_id);
    try {
      // 1. Update Profile directly
      const { error } = await supabase
        .from('profiles')
        .update({ verification_status: 'verified' })
        .eq('user_id', targetProfile.user_id);

      if (error) throw error;

      // 2. Send Notification
      await supabase.from('notifications').insert({
        user_id: targetProfile.user_id,
        type: 'system',
        title: 'Verification Approved!',
        body: 'Welcome to the elite circle. Your badge is active.',
        data: { type: 'verification_approved' },
        is_read: false
      });

      toast.success(`Verified @${targetProfile.username}`);
      setRequests(prev => prev.filter(p => p.user_id !== targetProfile.user_id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to approve");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (targetProfile: any) => {
    setProcessingId(targetProfile.user_id);
    try {
      // 1. Update Profile
      const { error } = await supabase.from('profiles').update({
        verification_status: 'rejected'
      }).eq('user_id', targetProfile.user_id);

      if (error) throw error;

      // 2. Send Notification
      await supabase.from('notifications').insert({
        user_id: targetProfile.user_id,
        type: 'system',
        title: 'Verification Update',
        body: 'Your verification request could not be approved at this time. Please contact support.',
        data: { type: 'verification_rejected' },
        is_read: false
      });

      toast.error(`Rejected @${targetProfile.username}`);
      setRequests(prev => prev.filter(p => p.user_id !== targetProfile.user_id));
    } catch (err) {
      toast.error("Failed to reject");
    } finally {
      setProcessingId(null);
    }
  };

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter">Command Center</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Admin Dashboard</p>
          </div>
        </div>

        <Tabs defaultValue="verification">
          <TabsList className="mb-8 bg-secondary/30">
            <TabsTrigger value="verification" className="gap-2"><UserCheck className="w-4 h-4" /> Verifications</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><FileText className="w-4 h-4" /> Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="verification" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Verification Requests</h2>
              <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{requests.length} Pending</span>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : requests.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-muted-foreground text-sm font-medium">All clear, Commander.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {requests.map((req: VerificationRequest) => (
                  <div key={req.user_id} className="p-4 rounded-2xl bg-secondary/20 border border-white/5 flex items-center justify-between group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12 ring-2 ring-white/10">
                        <AvatarImage src={req.avatar_url} />
                        <AvatarFallback>{getInitials(req.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-sm">{req.full_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">@{req.username}</p>
                        <p className="text-[10px] text-emerald-500 mt-1 uppercase tracking-wider font-bold">Paid Request</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(req)}
                        disabled={processingId === req.user_id}
                        className="bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20"
                      >
                        {processingId === req.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReject(req)}
                        disabled={processingId === req.user_id}
                        className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>


          <TabsContent value="reports">
            {loadingReports ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
            ) : reports.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-white/5">
                <p className="text-muted-foreground text-sm font-medium">No active reports.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {reports.map((ticket: SupportTicket) => (
                  <div key={ticket.id} className="p-4 rounded-2xl bg-secondary/20 border border-white/5 group hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8 ring-1 ring-white/10">
                          <AvatarImage src={ticket.profiles?.avatar_url} />
                          <AvatarFallback>{getInitials(ticket.profiles?.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold">{ticket.profiles?.full_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">@{ticket.profiles?.username}</p>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">{new Date(ticket.created_at).toLocaleDateString()}</span>
                    </div>

                    <div className="bg-black/20 p-3 rounded-xl mb-3 text-sm text-foreground/90 font-medium">
                      {ticket.message}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${ticket.type === 'bug' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {ticket.type}
                      </span>
                      {ticket.status !== 'resolved' && (
                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => handleResolveReport(ticket.id)}>
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
