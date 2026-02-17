import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell, Lock, HelpCircle, LogOut, ChevronRight,
  ShieldAlert, ArrowLeft,
  Search, Code, AlertTriangle, ShieldCheck, Check
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { getInitials, cn } from "@/lib/utils";

// --- REUSABLE COMPONENTS ---

const SectionHeader = ({ title }: { title: string }) => (
  <h3 className="px-5 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mt-6 mb-1">
    {title}
  </h3>
);

const SettingRow = ({
  icon: Icon,
  label,
  value,
  onClick,
  destructive,
  description,
  hasArrow = true
}: {
  icon: any,
  label: string,
  value?: string,
  onClick?: () => void,
  destructive?: boolean,
  description?: string,
  hasArrow?: boolean
}) => (
  <div
    onClick={onClick}
    className={cn(
      "flex items-center justify-between px-5 py-4 active:bg-white/5 transition-colors cursor-pointer group",
      destructive && "text-red-500"
    )}
  >
    <div className="flex items-center gap-4">
      <div className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
        destructive ? "bg-red-500/10 text-red-500" : "bg-white/5 text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
      )}>
        <Icon className="w-4 h-4" strokeWidth={2} />
      </div>
      <div className="flex flex-col">
        <span className={cn("text-sm font-bold tracking-tight", destructive ? "text-red-500" : "text-foreground")}>{label}</span>
        {description && <span className="text-[10px] text-muted-foreground font-medium">{description}</span>}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {value && <span className="text-xs font-bold text-muted-foreground bg-white/5 px-2 py-1 rounded-md">{value}</span>}
      {hasArrow && <ChevronRight className="w-4 h-4 text-muted-foreground/30" />}
    </div>
  </div>
);

export default function Settings() {
  const { user, profile, refreshProfile, isAdmin } = useAuth();
  const { settings, updateSetting } = useSettings();
  const navigate = useNavigate();
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [isPrivateAccount, setIsPrivateAccount] = useState(profile?.is_private || false);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [verificationTitle, setVerificationTitle] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (profile) setIsPrivateAccount(profile.is_private || false);
  }, [profile]);

  // Load blocked users when sheet opens
  useEffect(() => {
    if (activeSheet === 'blocked' && user) {
      const fetchBlocked = async () => {
        const { data } = await supabase
          .from('blocks')
          .select('id, blocked_id, created_at')
          .eq('blocker_id', user.id);

        if (data && data.length > 0) {
          const userIds = data.map(b => b.blocked_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, full_name, avatar_url')
            .in('user_id', userIds);

          const merged = data.map(b => ({
            ...b,
            profile: profiles?.find(p => p.user_id === b.blocked_id) || null
          }));
          setBlockedUsers(merged);
        } else {
          setBlockedUsers([]);
        }
      };
      fetchBlocked();
    }
  }, [activeSheet, user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handlePrivacyToggle = async (value: boolean) => {
    setIsPrivateAccount(value);
    const { error } = await supabase.from('profiles').update({ is_private: value }).eq('user_id', user?.id);
    if (!error) {
      toast.success(value ? 'Account Private' : 'Account Public');
      refreshProfile();
    } else {
      toast.error("Sync failed");
      setIsPrivateAccount(!value);
    }
  };

  const updateActivityStatus = async (value: boolean) => {
    const { error } = await supabase.from('profiles').update({ show_activity: value }).eq('user_id', user?.id);
    if (!error) {
      refreshProfile();
      toast.success("Activity status updated");
    }
  };

  const developers = [
    "Ateef Ameer Shaikh",
    "Kartikay Gour",
    "Shlok SB",
    "Arun Choudhary"
  ];

  const [reportText, setReportText] = useState("");

  const handleSendReport = async () => {
    if (!reportText.trim()) return;

    // Instead of Mailto, send to Database
    const { error } = await supabase.from('support_tickets').insert({
      user_id: user?.id,
      type: 'bug', // or 'feedback' based on user selection if we had one
      message: reportText,
      status: 'open'
    });

    if (error) {
      console.error("Report Error:", error);
      toast.error(`Failed to submit: ${error.message}`);
    } else {
      toast.success("Report submitted to our architects. We will look into it shortly.");
      setReportText("");
      setTimeout(() => setActiveSheet(null), 1500); // Close after a short delay so they can read toast
    }
  };

  const handleVerificationPayment = async () => {
    try {
      setIsVerifying(true);

      // Calculate expiry date (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const { error } = await supabase.from('profiles').update({
        // Do NOT verify immediately. Set status to pending.
        verification_status: 'pending',
        verified_title: null, // No custom titles for students
        // We can save the intended expiry, but the admin will likely set the final date.
        // verification_expiry: expiryDate.toISOString(), 
        verification_date: new Date().toISOString()
      }).eq('user_id', user?.id);

      if (error) throw error;

      // Notify Admin (Arun)
      const { data: adminUser } = await supabase.from('profiles').select('user_id').eq('username', 'arun').single();
      if (adminUser) {
        await supabase.from('notifications').insert({
          user_id: adminUser.user_id,
          type: 'system',
          title: 'Verification Request',
          body: `@${profile?.username} requested verification. Check payment.`,
          data: { requester_id: user?.id, type: 'verification_request' },
          is_read: false
        });
      }

      await refreshProfile();
      toast.success("Verification Request Sent!");
      setActiveSheet(null);
    } catch (error) {
      console.error('Verification error:', error);
      toast.error("Request failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto min-h-screen bg-background/50 backdrop-blur-3xl pb-24 transition-colors duration-500">

        {/* HEADER */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-2 hover:bg-transparent">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-sm font-black uppercase tracking-widest opacity-80">Settings</span>
          <div className="w-8" />
        </div>



        {/* ACCOUNT CENTER BANNER */}
        <div className="px-4 mt-4">
          <div
            className="glass-card p-0 rounded-3xl overflow-hidden border border-white/5 cursor-pointer relative group"
            onClick={() => navigate('/profile?edit=true')}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="p-4 flex items-center justify-between relative z-10">
              <div className="flex gap-4 items-center">
                <Avatar className="w-14 h-14 ring-2 ring-white/10 shadow-xl">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback>{getInitials(profile?.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-black text-lg tracking-tight">Accounts Center</span>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Manage your connected experiences</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50" />
            </div>
          </div>
        </div>

        {/* SETTINGS LIST */}
        <div className="mt-2 divide-y divide-white/5">
          <SectionHeader title="Account" />
          <SettingRow
            icon={ShieldCheck}
            label={profile?.is_verified ? "Verified Status" : (profile?.verification_status === 'pending' ? "Verification Pending" : "Get Verified")}
            value={profile?.is_verified ? "Active" : (profile?.verification_status === 'pending' ? "Pending" : undefined)}
            description={profile?.is_verified ? "You are verified" : (profile?.verification_status === 'pending' ? "Request under review" : "Get your blue tick")}
            onClick={() => setActiveSheet('verification')}
          />

          <SectionHeader title="Security & Privacy" />
          <SettingRow
            icon={Lock}
            label="Privacy & Security"
            value={isPrivateAccount ? "Private" : "Public"}
            description="Manage account visibility & activity"
            onClick={() => setActiveSheet('privacy')}
          />
          <SettingRow icon={Bell} label="Notifications" description="Push & Email alerts" onClick={() => setActiveSheet('notifications')} />
          <SettingRow icon={ShieldAlert} label="Blocked Users" onClick={() => setActiveSheet('blocked')} />

          <SectionHeader title="Support" />
          <SettingRow icon={AlertTriangle} label="Report a Problem" onClick={() => setActiveSheet('report')} />
          <SettingRow icon={HelpCircle} label="Help Center" onClick={() => setActiveSheet('help')} />

          <SectionHeader title="Developers" />
          <SettingRow icon={Code} label="About Alliance Connect" onClick={() => setActiveSheet('about')} />

          <SectionHeader title="Login" />
          <div className="px-5 py-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="flex items-center gap-3 py-3 cursor-pointer group">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <LogOut className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-red-500">Log Out</span>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-card border-white/10 rounded-[2rem] p-8">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-center font-black italic text-2xl">LOG OUT?</AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Are you sure you want to disconnect from the network?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-3 mt-6">
                  <AlertDialogAction onClick={handleLogout} className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-wider h-12 rounded-xl border-none">Yes, Log Out</AlertDialogAction>
                  <AlertDialogCancel className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold h-12 rounded-xl mt-0">Cancel</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="py-12 flex flex-col items-center justify-center opacity-30 pointer-events-none grayscale">
            <img src="/aulogo.png" className="w-12 h-12 mb-2 rounded-full object-cover border border-white/10" onError={(e) => e.currentTarget.style.display = 'none'} alt="AUConnect" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Alliance Connect</p>
            <p className="text-[9px] font-medium tracking-widest mt-1">v1.2.0 Beta</p>
          </div>
        </div>

        {/* --- SHEETS --- */}

        {/* PRIVACY & SECURITY SHEET */}
        <Sheet open={activeSheet === 'privacy'} onOpenChange={() => setActiveSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-[32px] glass-card border-white/10 pb-8 h-[60vh]">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 mt-2" />
            <h2 className="px-6 text-xl font-black italic uppercase tracking-tighter mb-8">Privacy Control</h2>

            <div className="space-y-2 px-4">
              <div className="p-5 rounded-3xl bg-secondary/30 border border-white/5 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <Lock className="w-6 h-6 text-primary mt-1" />
                  <div>
                    <p className="font-bold text-sm">Private Account</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug w-48">Only followers can see your posts and stories.</p>
                  </div>
                </div>
                <Switch checked={isPrivateAccount} onCheckedChange={handlePrivacyToggle} />
              </div>

              <div className="p-5 rounded-3xl bg-secondary/30 border border-white/5 flex items-center justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 text-green-500 relative flex items-center justify-center mt-1">
                    <span className="absolute w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_#22c55e]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Activity Status</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug w-48">Allow others to see when you're active.</p>
                  </div>
                </div>
                <Switch checked={profile?.show_activity} onCheckedChange={updateActivityStatus} />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* NOTIFICATIONS SHEET */}
        <Sheet open={activeSheet === 'notifications'} onOpenChange={() => setActiveSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-[32px] glass-card border-white/10 pb-8 h-[60vh]">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 mt-2" />
            <h2 className="px-6 text-xl font-black italic uppercase tracking-tighter mb-8">Alerts</h2>
            <div className="space-y-4 px-4">
              {['likes', 'comments', 'follows', 'messages'].map((key) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-2xl bg-white/5">
                  <span className="text-sm font-bold uppercase tracking-wider">{key}</span>
                  <Switch checked={settings[key as keyof typeof settings]} onCheckedChange={(v) => updateSetting(key, v)} />
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>

        {/* BLOCKED USERS SHEET */}
        <Sheet open={activeSheet === 'blocked'} onOpenChange={() => setActiveSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-[32px] glass-card border-white/10 pb-8 h-[60vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 mt-2" />
            <h2 className="px-6 text-xl font-black italic uppercase tracking-tighter mb-4">Blocked Accounts</h2>
            <div className="px-6">
              {blockedUsers.length === 0 ? (
                <div className="text-center py-10 opacity-30">
                  <ShieldAlert className="w-12 h-12 mx-auto mb-3" />
                  <p className="font-bold uppercase text-xs tracking-widest">No blocked users</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {blockedUsers.map((block: any) => (
                    <div key={block.id} className="flex items-center justify-between p-3 bg-secondary/20 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={block.profile?.avatar_url || ''} />
                          <AvatarFallback className="bg-white/5 text-xs font-bold">{block.profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold">{block.profile?.full_name || 'Unknown User'}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">@{block.profile?.username || 'unknown'}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl h-8 text-[10px] font-black uppercase tracking-widest border-red-500/20 text-red-400 hover:bg-red-500/10"
                        onClick={async () => {
                          await supabase.from('blocks').delete().eq('id', block.id);
                          setBlockedUsers(prev => prev.filter((b: any) => b.id !== block.id));
                          toast.success(`Unblocked @${block.profile?.username}`);
                        }}
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* REPORT PROBLEM SHEET */}
        <Sheet open={activeSheet === 'report'} onOpenChange={() => setActiveSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-[32px] glass-card border-white/10 pb-8 min-h-[60vh]">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 mt-2" />
            <h2 className="px-6 text-xl font-black italic uppercase tracking-tighter mb-2">Report Issue</h2>
            <p className="px-6 text-[11px] text-muted-foreground font-medium mb-6 uppercase tracking-widest">
              Found a bug? Let the architects know.
            </p>
            <div className="px-6 space-y-4">
              <Textarea
                value={reportText}
                onChange={(e: any) => setReportText(e.target.value)}
                placeholder="Type your problem here..."
                className="bg-secondary/30 border-white/5 rounded-2xl min-h-[150px] resize-none focus:ring-1 focus:ring-primary/50"
              />
              <Button onClick={handleSendReport} className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-primary text-black hover:bg-primary/90 mt-2">
                Send Report
              </Button>

              <div className="pt-4 mt-2 border-t border-white/5 text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold">
                  Urgent Issue?
                </p>
                <p className="text-xs font-medium">
                  Alternatively, you can mail us at <a href="mailto:auconnecx@gmail.com" className="text-primary hover:underline">auconnecx@gmail.com</a>
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* HELP CENTER SHEET */}
        <Sheet open={activeSheet === 'help'} onOpenChange={() => setActiveSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-[32px] glass-card border-white/10 pb-8 h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 mt-2" />
            <h2 className="px-6 text-xl font-black italic uppercase tracking-tighter mb-6">Help Center</h2>
            <div className="px-6">
              <Accordion type="single" collapsible className="w-full space-y-2">
                {[
                  { q: "How do I verify my student ID?", a: "Go to Profile > Edit > Verify Student Status. Upload your ID card." },
                  { q: "Who can see my posts?", a: "If your account is Public, everyone. If Private, only followers." },
                  { q: "How does Aura work?", a: "Aura is earned by engagement on your posts and reels. More likes = more Aura." },
                  { q: "Can I delete messages?", a: "Yes, long press a message to delete it." },
                  { q: "Is the detailed map working?", a: "It is currently in Beta. Some blocks may be missing." },
                  { q: "How do I create a Circle?", a: "Go to the Circles tab and tap the '+' button to start your own community." },
                  { q: "How to leave a Circle?", a: "Inside a Circle, tap the header/settings and select 'Leave Circle'." },
                  { q: "Can I change the app theme?", a: "Yes, go to Profile > Edit Profile > Theme to customize your look." },
                  { q: "How to invite friends to a Circle?", a: "If you are an admin, open the Circle settings and use the 'Invite Squad' panel." }
                ].map((item, i) => (
                  <AccordionItem key={i} value={`item-${i}`} className="border-b border-white/5">
                    <AccordionTrigger className="text-sm font-bold text-left hover:no-underline hover:text-primary transition-colors">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </SheetContent>
        </Sheet>

        {/* ABOUT / DEVELOPERS SHEET */}
        <Sheet open={activeSheet === 'about'} onOpenChange={() => setActiveSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-[32px] glass-card border-white/10 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 mt-2" />

            <div className="flex flex-col items-center text-center mb-10">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-purple-600 shadow-[0_0_30px_rgba(124,58,237,0.3)] flex items-center justify-center mb-6 overflow-hidden border-2 border-white/10">
                <img src="/aulogo.png" className="w-full h-full object-cover" alt="AU Logo" />
              </div>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter leading-none mb-2">Alliance Connect</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50">Campus Neural Network</p>
            </div>

            <p className="px-8 text-center text-xs text-muted-foreground/80 leading-relaxed font-medium mb-10">
              Alliance Connect is the digital nervous system of our campus.
              Designed to bridge the gap between students, ideas, and opportunities.
              A platform where moments become memories and connections turn into collaborations.
            </p>

            <div className="px-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary mb-6 text-center">Developers</h3>
              <div className="space-y-3">
                {developers.map((dev, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center font-black text-sm">
                      {dev[0]}
                    </div>
                    <span className="font-bold text-sm tracking-wide">{dev}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10 p-6 rounded-3xl bg-secondary/20 border border-white/5 text-center">
                <h4 className="font-black text-sm uppercase mb-2">Developed at</h4>
                <p className="text-xs font-medium opacity-60">College of Engineering & Design</p>
                <p className="text-xs font-bold mt-1">Alliance University</p>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* VERIFICATION SHEET */}
        <Sheet open={activeSheet === 'verification'} onOpenChange={() => setActiveSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-[32px] glass-card border-white/10 pb-8 max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-6 mt-2" />
            <SheetTitle className="hidden">Verification</SheetTitle>

            <div className="px-6 flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-500 shadow-[0_0_30px_rgba(52,211,153,0.4)] flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10 text-white" />
              </div>

              <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2">
                {profile?.is_verified ? "You are Verified" : (profile?.verification_status === 'pending' ? "Request Pending" : "Get Verified")}
              </h2>


              {profile?.is_verified ? (
                <div className="text-center w-full">
                  <p className="text-sm text-muted-foreground font-medium mb-8">
                    Your verification is active and valid until <br />
                    <span className="text-white font-bold">{profile?.verification_expiry ? new Date(profile.verification_expiry).toLocaleDateString() : 'Indefinite'}</span>
                  </p>

                  <Button className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10" disabled>
                    Verification Active
                  </Button>
                </div>
              ) : profile?.verification_status === 'pending' ? (
                <div className="text-center w-full">
                  <div className="p-6 rounded-3xl bg-secondary/20 border border-white/5 mb-8">
                    <p className="text-sm font-bold text-muted-foreground mb-2">Wait Pending...</p>
                    <p className="text-xs opacity-50 mb-4">You have submitted a request. Our admins will verify your payment and approve your badge shortly.</p>

                    {/* If user is admin (Arun), allow him to see the payment UI even if pending, for testing purposes */}
                    {isAdmin ? (
                      <div className="p-4 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-center">
                        <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest leading-relaxed">Admin View: You have a pending request, but can still see the payment portal for testing.</p>
                      </div>
                    ) : (
                      <>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-[10px] font-black uppercase tracking-widest border border-yellow-500/20">
                          Pending Approval
                        </div>
                        <div className="height-4" />
                      </>
                    )}
                  </div>

                  {/* ONLY SHOW MAIL BUTTONS IF NOT ADMIN OR IF ADMIN WANTS TO SEE THEM */}
                  {!isAdmin && (
                    <div className="space-y-3">
                      <p className="text-[10px] text-muted-foreground/60 max-w-xs mx-auto mb-2">
                        If you have already paid and are not verified yet:
                      </p>
                      <Button
                        onClick={() => {
                          window.location.href = `mailto:auconnecx@gmail.com?subject=Verification Payment Issue: @${profile?.username}&body=I have paid for verification but my status is still pending. My User ID: ${profile?.user_id}`;
                        }}
                        variant="outline"
                        className="w-full h-10 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border-white/10"
                      >
                        Mail us at auconnecx@gmail.com
                      </Button>
                      <Button onClick={() => setActiveSheet(null)} className="w-full h-12 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10">
                        Close
                      </Button>
                    </div>
                  )}

                  {/* ADMIN FALLTHROUGH: Display Payment UI below for testing */}
                  {isAdmin && (
                    <div className="w-full mt-8 border-t border-white/10 pt-8">
                      {/* REPEAT PAYMENT UI FOR ADMIN */}
                      <div className="p-6 rounded-3xl bg-secondary/20 border border-white/5 flex flex-col items-center text-center">
                        <p className="text-xs font-black uppercase tracking-widest text-primary mb-4">Scan to Pay</p>
                        <div className="w-48 h-48 bg-white p-2 rounded-2xl mb-4 relative overflow-hidden group">
                          <div className="w-full h-full bg-white flex items-center justify-center relative z-10">
                            <img
                              src="/payment-qr.png"
                              alt="Payment QR"
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="absolute top-0 left-0 w-full h-1 bg-primary/50 shadow-[0_0_15px_#22c55e] z-20 animate-[scan_2s_ease-in-out_infinite]" />
                        </div>
                        <p className="font-black text-2xl italic tracking-tight">₹49.00</p>
                        <div className="mt-4">
                          <Button
                            onClick={async () => {
                              setIsVerifying(true);
                              await handleVerificationPayment();
                              setTimeout(() => {
                                window.location.href = `mailto:auconnecx@gmail.com?subject=New Verification Request: @${profile?.username}&body=I have paid Rs 49 for verification. My User ID: ${profile?.user_id}. Please verify my badge.`;
                                setIsVerifying(false);
                              }, 1000);
                            }}
                            disabled={isVerifying}
                            className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                          >
                            {isVerifying ? "Sending..." : "Test Payment Button"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full">
                  <p className="text-center text-xs text-muted-foreground/80 font-medium mb-8 max-w-xs mx-auto">
                    Stand out with a verified badge next to your name. Scan the QR code below to pay and submit your request.
                  </p>

                  <div className="space-y-6">

                    <div className="p-6 rounded-3xl bg-secondary/20 border border-white/5 flex flex-col items-center text-center">
                      <p className="text-xs font-black uppercase tracking-widest text-primary mb-4">Scan to Pay</p>

                      <div className="w-48 h-48 bg-white p-2 rounded-2xl mb-4 relative overflow-hidden group">
                        <div className="w-full h-full bg-white flex items-center justify-center relative z-10">
                          <img
                            src="/payment-qr.png"
                            alt="Payment QR"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        {/* Scan line effect */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary/50 shadow-[0_0_15px_#22c55e] z-20 animate-[scan_2s_ease-in-out_infinite]" />
                      </div>

                      <p className="font-black text-2xl italic tracking-tight">₹49.00</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mt-1">
                        Valid for 30 Days
                      </p>
                    </div>

                    <Button
                      onClick={async () => {
                        await handleVerificationPayment();
                        // Open mail client immediately after marking as pending
                        setTimeout(() => {
                          window.location.href = `mailto:auconnecx@gmail.com?subject=New Verification Request: @${profile?.username}&body=I have paid Rs 49 for verification. My User ID: ${profile?.user_id}. Please verify my badge.`;
                        }, 1000);
                      }}
                      disabled={isVerifying}
                      className="w-full h-12 rounded-xl font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {isVerifying ? "Sending Request..." : "I have Paid ₹49"}
                    </Button>

                    <p className="text-center text-[10px] text-muted-foreground/50 max-w-xs mx-auto leading-relaxed">
                      By clicking above, you confirm that you have completed the payment. Abuse of this system may lead to account suspension.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}