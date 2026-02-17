import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, ShoppingBag, Loader2, MessageCircle, X, AlertCircle, IndianRupee, ImageIcon, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { uploadMultipleFiles } from "@/lib/storage";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getInitials } from "@/lib/utils";
import { validateMarketplaceListing, sanitizeField, marketplaceLimiter, messageLimiter, isRateLimited } from "@/lib/security";
import { FeaturedProductCarousel } from "@/components/marketplace/FeaturedProductCarousel";
import { MarketplaceSkeleton } from "@/components/marketplace/MarketplaceSkeleton";
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

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  images: string[] | null;
  status: string;
  seller_id: string;
  commission_rate: number;
  created_at: string;
  seller?: {
    username: string | null;
    avatar_url: string | null;
    full_name: string | null;
  };
}

const CATEGORIES = [
  { value: 'books', label: 'Books' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'services', label: 'Services' },
  { value: 'other', label: 'Other' },
];

const COMMISSION_RATE = 2;

export default function Marketplace() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isAdmin = profile?.role === 'admin' || profile?.username === 'arun' || user?.email === 'arunchoudhary@alliance.edu.in' || profile?.username === 'koki';
  const [deletingListingId, setDeletingListingId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LISTINGS_PER_PAGE = 10;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [images, setImages] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);

  const fetchListings = useCallback(async (pageNumber = 0) => {
    try {
      const from = pageNumber * LISTINGS_PER_PAGE;
      const to = from + LISTINGS_PER_PAGE - 1;

      const { data: listingsData, error } = await supabase
        .from('marketplace_listings')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (listingsData) {
        const sellerIds = [...new Set(listingsData.map(l => l.seller_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, full_name, avatar_url')
          .in('user_id', sellerIds);

        const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

        const withSellers = listingsData.map(l => ({
          ...l,
          commission_rate: l.commission_rate || COMMISSION_RATE,
          seller: profilesMap.get(l.seller_id)
        }));

        if (pageNumber === 0) setListings(withSellers);
        else setListings(prev => [...prev, ...withSellers]);

        setHasMore(listingsData.length === LISTINGS_PER_PAGE);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to load listings");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchListings(0); }, [fetchListings]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchListings(nextPage);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(files.slice(0, 5));
  };

  const handleCreate = async () => {
    if (!user || !title.trim() || !price) return;

    // SECURITY: Validate listing data
    const validation = validateMarketplaceListing({
      title: title.trim(),
      description: description.trim() || undefined,
      price,
      category
    });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    // SECURITY: Rate limit listing creation
    if (isRateLimited(marketplaceLimiter, 'create_listing')) return;

    setCreating(true);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        const { urls } = await uploadMultipleFiles('marketplace', images, user.id);
        imageUrls = urls;
      }

      const { error } = await supabase.from('marketplace_listings').insert({
        title: sanitizeField(title.trim(), 150),
        description: sanitizeField(description.trim(), 2000) || null,
        price: parseFloat(price),
        category,
        images: imageUrls.length > 0 ? imageUrls : null,
        seller_id: user.id,
        commission_rate: COMMISSION_RATE
      });

      if (error) throw error;
      toast.success('Listing created!');
      setTitle(''); setDescription(''); setPrice(''); setCategory('other'); setImages([]);
      setShowCreateDialog(false); fetchListings(0);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create listing');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteListing = async () => {
    if (!deletingListingId) return;

    try {
      // Use .select() to verify if the deletion actually happened
      const { data, error } = await supabase
        .from('marketplace_listings')
        .delete()
        .eq('id', deletingListingId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("Security Lock: Database blocked deletion. Run the SQL Panic Fix.");
      }

      toast.success("Listing obliterated from terminal");
      setShowDetailDialog(false);
      setDeletingListingId(null);
      fetchListings(0);
    } catch (error: any) {
      console.error("Delete Error:", error);
      toast.error(error.message || "Deletion Rejected: DB Policy mismatch.");
      fetchListings(0);
    }
  };

  const handleEnquiry = async (listing: Listing) => {
    if (!user) { navigate('/auth'); return; }
    if (listing.seller_id === user.id) { toast.error("Your own listing"); return; }

    const { data: existing } = await supabase.from('conversations')
      .select('id')
      .or(`and(participant_1.eq.${user.id},participant_2.eq.${listing.seller_id}),and(participant_1.eq.${listing.seller_id},participant_2.eq.${user.id})`)
      .single();

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data: newConvo } = await supabase.from('conversations')
        .insert({ participant_1: user.id, participant_2: listing.seller_id })
        .select('id').single();
      conversationId = newConvo?.id;
    }

    if (conversationId) {
      await supabase.from('direct_messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `Hi! I'm interested in "${listing.title}" (₹${listing.price.toLocaleString('en-IN')}).`,
      });
      navigate(`/messages?chat=${conversationId}`);
    }
  };

  const handleBuy = async (listing: Listing) => {
    if (!user) { navigate('/auth'); return; }
    const { error } = await supabase.from('marketplace_inquiries').insert({
      listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id, status: 'pending',
    });
    if (error) { toast.error('Request failed'); return; }
    await handleEnquiry(listing);
    toast.success('Request sent!');
  };

  const filteredListings = listings.filter(l => {
    const matchesCategory = selectedCategory === 'all' || l.category === selectedCategory;
    const matchesSearch = l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.description && l.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) return <AppLayout><div className="max-w-2xl mx-auto px-4 py-8"><MarketplaceSkeleton /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text uppercase tracking-tight">Marketplace</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Campus Buy & Sell</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary rounded-full px-6 shadow-lg shadow-primary/20">
                <Plus className="h-4 w-4 mr-2" /> Sell Item
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-white/10 max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="gradient-text font-black uppercase">Create Listing</DialogTitle>
                <DialogDescription className="text-xs">Post your item for sale.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Title *</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product Name" className="bg-secondary/30 h-12 rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Price (₹) *</Label>
                    <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="bg-secondary/30 h-12 rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-secondary/30 h-12 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Photos</Label>
                  <Input type="file" accept="image/*" multiple onChange={handleImageChange} className="bg-secondary/30 h-12 rounded-xl" />
                </div>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe condition, age, etc." className="bg-secondary/30 rounded-xl" />
                <Button onClick={handleCreate} disabled={creating || !title.trim() || !price} className="w-full bg-gradient-primary h-14 rounded-2xl font-black uppercase tracking-widest">
                  {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : "POST LISTING"}
                </Button>
              </div>

            </DialogContent>
          </Dialog>
        </motion.div>

        {/* FEATURED CAROUSEL */}
        <FeaturedProductCarousel listings={listings} onSelect={(item) => { setSelectedListing(item); setShowDetailDialog(true); }} />

        {/* SEARCH & FILTERS */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl pb-4 pt-2 -mx-4 px-4 transition-all">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search marketplace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-secondary/50 border-white/5 rounded-xl focus:bg-secondary transition-all"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button size="sm" variant={selectedCategory === 'all' ? 'default' : 'outline'} onClick={() => setSelectedCategory('all')} className="rounded-full px-5 h-8 text-xs font-bold uppercase tracking-wide shadow-sm">All</Button>
            {CATEGORIES.map(cat => (
              <Button key={cat.value} size="sm" variant={selectedCategory === cat.value ? 'default' : 'outline'} onClick={() => setSelectedCategory(cat.value)} className="rounded-full px-5 h-8 text-xs font-bold uppercase tracking-wide shrink-0 shadow-sm">{cat.label}</Button>
            ))}
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div className="text-center py-20 glass-card rounded-[2rem] border-dashed border-2">
            <ShoppingBag className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filteredListings.map((listing, index) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card rounded-[2rem] overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all"
                onClick={() => { setSelectedListing(listing); setShowDetailDialog(true); }}
              >
                <div className="aspect-[4/5] bg-secondary/20 relative">
                  {listing.images?.[0] ? (
                    <img src={listing.images[0]} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20"><ImageIcon className="h-10 w-10" /></div>
                  )}
                  <div className="absolute bottom-3 left-3">
                    <Badge className="bg-black/60 backdrop-blur-md border-none text-white font-black px-3 py-1 text-sm">₹{listing.price.toLocaleString('en-IN')}</Badge>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-sm line-clamp-1 uppercase tracking-tight">{listing.title}</h3>
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-4 w-4"><AvatarImage src={listing.seller?.avatar_url || undefined} /><AvatarFallback className="text-[6px]">{getInitials(listing.seller?.full_name)}</AvatarFallback></Avatar>
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">@{listing.seller?.username}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* --- FIXED IMAGE RENDER IN DETAIL DIALOG --- */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="glass-card border-none p-0 overflow-hidden sm:max-w-lg rounded-[2.5rem]">
            {selectedListing && (
              <div className="flex flex-col">
                <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
                  {/* BLURRED BACKGROUND FOR BETTER RENDER */}
                  {selectedListing.images?.[0] && (
                    <img src={selectedListing.images[0]} className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110" alt="" />
                  )}
                  {/* MAIN IMAGE - OBJECT CONTAIN ENSURES RATIO IS KEPT */}
                  <img
                    src={selectedListing.images?.[0] || ''}
                    className="relative z-10 max-w-full max-h-full object-contain"
                    alt={selectedListing.title}
                  />
                  <Button onClick={() => setShowDetailDialog(false)} variant="ghost" className="absolute top-4 right-4 z-20 bg-black/20 hover:bg-black/40 text-white rounded-full h-10 w-10 p-0"><X className="h-5 w-5" /></Button>
                </div>

                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tighter italic leading-none">{selectedListing.title}</h2>
                      <Badge variant="secondary" className="mt-2 rounded-full uppercase text-[10px] font-black tracking-widest">{selectedListing.category}</Badge>
                    </div>
                    <div className="text-3xl font-black text-primary italic">₹{selectedListing.price.toLocaleString('en-IN')}</div>
                  </div>

                  <p className="text-sm text-muted-foreground font-medium leading-relaxed">{selectedListing.description || "No description provided."}</p>

                  <div className="flex items-center gap-3 p-4 bg-secondary/20 rounded-2xl">
                    <Avatar className="h-10 w-10 border-2 border-primary/20"><AvatarImage src={selectedListing.seller?.avatar_url || undefined} /><AvatarFallback className="font-black">{getInitials(selectedListing.seller?.full_name)}</AvatarFallback></Avatar>
                    <div className="flex-1">
                      <p className="font-black text-sm uppercase tracking-tight">@{selectedListing.seller?.username}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verified Student Seller</p>
                    </div>
                  </div>

                  {(user?.id === selectedListing.seller_id || isAdmin) && (
                    <Button
                      onClick={() => setDeletingListingId(selectedListing.id)}
                      variant="destructive"
                      className="w-full h-14 rounded-2xl font-black uppercase tracking-widest bg-red-500/10 text-red-500 border-2 border-red-500/20 hover:bg-red-500 hover:text-white transition-all mb-3"
                    >
                      DELETE LISTING
                    </Button>
                  )}

                  {user?.id !== selectedListing.seller_id && (
                    <div className="grid grid-cols-2 gap-3">
                      <Button onClick={() => handleEnquiry(selectedListing)} variant="outline" className="h-14 rounded-2xl font-black uppercase tracking-widest border-2">CHAT</Button>
                      <Button onClick={() => handleBuy(selectedListing)} className="h-14 rounded-2xl font-black uppercase tracking-widest bg-gradient-primary">BUY NOW</Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* DELETE CONFIRMATION DIALOG */}
        <AlertDialog open={!!deletingListingId} onOpenChange={(open) => !open && setDeletingListingId(null)}>
          <AlertDialogContent className="glass-card border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black italic uppercase tracking-tighter text-red-500">
                Purge Listing?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action is permanent. The listing and all associated data will be wiped from the campus marketplace.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteListing}
                className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px]"
              >
                Permanently Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout >
  );
}