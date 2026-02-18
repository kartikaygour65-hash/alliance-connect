import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Users, MessageSquare, Share2, Compass,
    ArrowRight, Sparkles, Globe, Heart, Zap,
    ShieldCheck, CircleUser, Layout, Command,
    ShoppingBag, Calendar, Layers, Activity,
    ChevronRight, ExternalLink, Mail, Phone, MapPin, X
} from "lucide-react";
import { Button } from "@/components/ui/button";

// --- COMPONENTS ---

const ScrollSection = ({ children, containerRef, range = 2, id = "" }: any) => {
    const sectionRef = useRef(null);
    const { scrollYProgress } = useScroll({
        container: containerRef,
        target: sectionRef,
        offset: ["start start", "end end"]
    });

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 120,
        damping: 35,
        restDelta: 0.001
    });

    return (
        <div id={id} ref={sectionRef} className="relative z-10" style={{ height: `${range * 100}vh` }}>
            <div className="sticky top-0 h-screen w-full overflow-hidden">
                {children(smoothProgress)}
            </div>
        </div>
    );
};

const ThreeDLogo = ({ className = "" }: any) => {
    return (
        <div className={`relative ${className}`} style={{ perspective: '1000px' }}>
            <motion.div
                animate={{
                    rotateY: [0, 360],
                    rotateX: [10, -10, 10],
                    y: [-10, 10, -10]
                }}
                transition={{
                    rotateY: { duration: 15, repeat: Infinity, ease: "linear" },
                    rotateX: { duration: 8, repeat: Infinity, ease: "easeInOut" },
                    y: { duration: 6, repeat: Infinity, ease: "easeInOut" }
                }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative w-32 h-32 md:w-48 md:h-48 flex items-center justify-center"
            >
                <div className="absolute inset-0 bg-violet-500/30 blur-[60px] rounded-full scale-150" />

                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ transform: `translateZ(${i * 4}px)` }}
                    >
                        <div className={`w-full h-full bg-white rounded-[2rem] p-4 flex items-center justify-center shadow-2xl ${i < 4 ? 'opacity-20' : 'opacity-100'}`}>
                            <img src="/aulogo.png" alt="AU" className="w-full h-full object-contain invert" />
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

const Modal = ({ isOpen, onClose, title, children }: any) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-neutral-900/95 border border-white/10 p-8 md:p-12 rounded-[2rem] shadow-2xl overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent pointer-events-none" />
                        <button onClick={onClose} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10 z-10">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter mb-8 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 relative z-10">{title}</h2>
                        <div className="text-white/80 leading-relaxed text-base md:text-lg max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide font-medium relative z-10">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const GridCard = ({ icon: Icon, color, title, desc, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, delay }}
        whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.05)" }}
        className="group relative p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/5 transition-all duration-500 cursor-default"
    >
        <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-8 ${color} group-hover:scale-110 transition-transform duration-500`}>
            <Icon className="w-7 h-7" />
        </div>
        <h3 className="text-2xl font-[900] uppercase italic tracking-tighter mb-4 text-white group-hover:text-violet-200 transition-colors">{title}</h3>
        <p className="text-white/40 text-base leading-relaxed font-medium group-hover:text-white/60 transition-colors">{desc}</p>
    </motion.div>
);

export default function LandingPage() {
    const navigate = useNavigate();
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrolled, setScrolled] = useState(false);
    const [activeModal, setActiveModal] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        document.documentElement.setAttribute('data-theme', 'midnight-obsidian');

        const handleScroll = () => {
            if (containerRef.current && containerRef.current.scrollTop > 50) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        const container = containerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        return () => container?.removeEventListener('scroll', handleScroll);
    }, []);

    if (!mounted) return null;

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element && containerRef.current) {
            containerRef.current.scrollTo({
                top: element.offsetTop,
                behavior: 'smooth'
            });
        }
    };

    const handleLogin = () => navigate("/auth?mode=login");
    const handleSignUp = () => navigate("/auth?mode=signup");

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 bg-[#020202] text-white selection:bg-violet-500/30 selection:text-white font-sans overflow-x-hidden overflow-y-auto scroll-smooth scrollbar-hide z-[9999]"
        >
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
                <div className="absolute top-0 left-0 right-0 h-screen bg-[radial-gradient(circle_at_50%_-20%,rgba(124,58,237,0.15),transparent_70%)]" />
                <div className="absolute bottom-0 left-0 right-0 h-[50vh] bg-gradient-to-t from-black via-black/80 to-transparent" />
            </div>

            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className={`fixed top-0 left-0 right-0 z-[100] px-6 py-4 md:px-12 md:py-6 flex justify-between items-center transition-all duration-500 ${scrolled ? 'bg-black/60 backdrop-blur-2xl border-b border-white/5 py-3 md:py-4' : 'bg-transparent'}`}
            >
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-2 shadow-lg shadow-white/10 group-hover:scale-110 transition-transform duration-300">
                        <img src="/aulogo.png" alt="AU" className="invert object-contain" />
                    </div>
                    <span className="text-xl font-black italic tracking-tighter uppercase whitespace-nowrap pr-4 hidden md:block">AUConnect</span>
                </div>

                <div className="hidden lg:flex items-center gap-8 bg-white/5 px-8 py-3 rounded-full border border-white/5 backdrop-blur-md">
                    {['Features', 'Circles', 'Events', 'Hub', 'About'].map((item) => (
                        <button
                            key={item}
                            onClick={() => scrollToSection(item.toLowerCase())}
                            className="text-xs font-bold uppercase tracking-[0.2em] text-white/60 hover:text-white transition-all hover:scale-105"
                        >
                            {item}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="text-xs font-black uppercase tracking-[0.2em] text-white/70 hover:text-white hover:bg-white/5 transition-all" onClick={handleLogin}>
                        Sign In
                    </Button>
                    <Button className="bg-white text-black hover:bg-white/90 rounded-full px-6 md:px-8 text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:shadow-white/20 hover:scale-105 transition-all duration-300" onClick={handleSignUp}>
                        Join Now
                    </Button>
                </div>
            </motion.nav>

            {/* HERO SECTION */}
            <ScrollSection containerRef={containerRef} range={1.8} id="home">
                {(progress: any) => {
                    const opacity = useTransform(progress, [0, 0.7, 1], [1, 1, 0]);
                    const scale = useTransform(progress, [0, 1], [1, 0.9]);
                    const y = useTransform(progress, [0, 1], [0, -50]);

                    return (
                        <motion.div style={{ opacity, scale, y }} className="relative h-full w-full flex flex-col items-center justify-center text-center px-4 md:px-6">
                            <ThreeDLogo className="absolute top-[15%] md:top-[20%] opacity-30 pointer-events-none blur-[2px]" />

                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 1, delay: 0.2 }}
                                className="mb-8 z-10"
                            >
                                <span className="px-5 py-2 rounded-full border border-white/10 bg-white/5 text-xs md:text-sm font-bold uppercase tracking-[0.3em] text-violet-300 backdrop-blur-3xl shadow-lg shadow-violet-500/10">
                                    The Digital Heart-Rate of Alliance
                                </span>
                            </motion.div>

                            <div className="relative z-10 px-4">
                                <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-[9rem] font-[1000] italic uppercase tracking-tighter leading-[0.9] mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/40 max-w-[95vw] break-words py-2 pr-4 md:pr-8">
                                    AUConnect
                                </h1>
                            </div>

                            <p className="text-lg md:text-2xl text-white/50 max-w-2xl font-medium leading-relaxed mb-12 z-10 italic">
                                A high-fidelity social layer for the campus elite. <br className="hidden md:block" />
                                Synchronous, cinematic, and decentralized.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-6 z-10 w-full sm:w-auto px-6 sm:px-0">
                                <Button onClick={handleSignUp} className="h-14 md:h-16 px-8 md:px-12 rounded-full bg-white text-black text-xs md:text-sm font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl hover:shadow-white/30 w-full sm:w-auto">
                                    Enter The Collective <ArrowRight className="ml-3 w-5 h-5" />
                                </Button>
                                <Button onClick={() => scrollToSection('features')} variant="outline" className="h-14 md:h-16 px-8 md:px-12 rounded-full border-white/10 bg-white/5 text-xs md:text-sm font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all backdrop-blur-sm w-full sm:w-auto">
                                    View Blueprint
                                </Button>
                            </div>
                        </motion.div>
                    );
                }}
            </ScrollSection>

            <ScrollSection containerRef={containerRef} range={2.5} id="features">
                {(progress: any) => {
                    const opacity = useTransform(progress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
                    const layer1Y = useTransform(progress, [0, 1], [100, -100]);
                    const layer2Y = useTransform(progress, [0, 1], [200, -200]);
                    const layerScale = useTransform(progress, [0, 0.5, 1], [0.9, 1, 0.9]);

                    return (
                        <div className="relative h-full w-full flex flex-col items-center justify-center px-6 overflow-hidden">
                            <motion.div style={{ opacity }} className="relative z-10 text-center mb-16 md:mb-24">
                                <span className="text-violet-400 font-black uppercase tracking-[0.6em] text-xs mb-4 block">Interface Paradigm</span>
                                <h2 className="text-4xl md:text-7xl lg:text-8xl font-black italic uppercase tracking-tighter leading-[0.9]">Architected <br /> for <span className="text-white/20">Action.</span></h2>
                            </motion.div>

                            <motion.div style={{ scale: layerScale }} className="relative w-full max-w-6xl aspect-[16/10] md:aspect-[21/9] flex items-center justify-center">
                                <motion.div style={{ y: layer1Y, opacity }} className="absolute inset-0 bg-gradient-to-br from-white/[0.05] to-transparent border border-white/5 rounded-[3rem] backdrop-blur-[20px]" />

                                <motion.div style={{ y: layer2Y, opacity }} className="absolute w-[90%] md:w-[80%] h-[80%] md:h-[70%] bg-[#0A0A0A] border border-white/10 rounded-[2rem] p-6 md:p-12 overflow-hidden flex flex-col shadow-2xl">
                                    <div className="flex items-center gap-6 mb-8 md:mb-12">
                                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                                            <Zap className="w-6 h-6 md:w-8 md:h-8 text-violet-400" />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="h-3 md:h-4 w-32 md:w-48 bg-white/10 rounded-full animate-pulse" />
                                            <div className="h-2 w-20 md:w-32 bg-white/5 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 md:gap-8 flex-grow">
                                        <div className="col-span-2 bg-white/5 rounded-[1.5rem] border border-white/5 p-8 relative overflow-hidden group">
                                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                            <div className="absolute bottom-6 left-6 right-6 h-2 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full w-2/3 bg-violet-500 rounded-full" />
                                            </div>
                                        </div>
                                        <div className="bg-white/5 rounded-[1.5rem] border border-white/5 relative overflow-hidden group">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full border-2 border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div
                                    style={{ y: layer1Y, opacity, x: 50 }}
                                    className="hidden md:flex absolute top-10 right-10 w-72 h-40 bg-violet-600 rounded-[2rem] p-6 shadow-2xl flex-col justify-center border border-white/10 backdrop-blur-xl bg-opacity-90"
                                >
                                    <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-2 opacity-60 text-white">Live Pulse</div>
                                    <div className="text-4xl font-black italic tracking-tight text-white mb-1">4,520+</div>
                                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Active Users</div>
                                </motion.div>
                            </motion.div>
                        </div>
                    );
                }}
            </ScrollSection>

            {/* CIRCLES SECTION */}
            <section className="relative py-32 md:py-40 px-6 max-w-7xl mx-auto" id="circles">
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-20 md:mb-32"
                >
                    <h2 className="text-5xl md:text-8xl font-[1000] italic uppercase tracking-tighter leading-[0.9]">One Ecosystem. <br /><span className="text-white/20">Infinite Sync.</span></h2>
                </motion.div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {[
                        { id: 'circles', icon: Users, color: 'text-violet-400', title: 'Community Circles', desc: 'Specialized guilds from FinTech to Fine Arts. Claim your tribe.' },
                        { id: 'messaging', icon: MessageSquare, color: 'text-blue-400', title: 'Hyper Messaging', desc: 'Secure, low-latency dialogue across the entire AU domain.' },
                        { id: 'feed', icon: Share2, color: 'text-emerald-400', title: 'Momentum Feed', desc: 'Real-time algorithmically sorted campus updates.' }
                    ].map((f, i) => (
                        <GridCard key={i} {...f} delay={i * 0.1} />
                    ))}
                </div>
            </section>

            {/* EVENTS SECTION */}
            <section className="relative py-20 md:py-32 px-6 max-w-7xl mx-auto" id="events">
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="flex items-center justify-center gap-4 mb-20"
                >
                    <div className="h-[1px] w-20 bg-white/10" />
                    <span className="text-xs font-black uppercase tracking-[0.4em] text-white/40">Campus Utilities</span>
                    <div className="h-[1px] w-20 bg-white/10" />
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                    {[
                        { id: 'market', icon: ShoppingBag, color: 'text-amber-400', title: 'Student Economy', desc: 'The verified hub for textbooks, tech, and services.' },
                        { id: 'events', icon: Calendar, color: 'text-rose-400', title: 'Events Terminal', desc: 'Your gateway to LIT FEST and every major cultural shift.' },
                        { id: 'security', icon: ShieldCheck, color: 'text-slate-300', title: 'Identity Grid', desc: 'Biometric-level security for your campus credentials.' }
                    ].map((f, i) => (
                        <GridCard key={i} {...f} delay={i * 0.1} />
                    ))}
                </div>
            </section>

            <ScrollSection containerRef={containerRef} range={1.5} id="about">
                {(progress: any) => {
                    const opacity = useTransform(progress, [0, 0.4, 0.8, 1], [0, 1, 1, 0]);
                    const scale = useTransform(progress, [0, 0.5, 1], [0.95, 1, 0.95]);
                    return (
                        <div className="relative h-full w-full flex items-center justify-center px-8">
                            <motion.div style={{ opacity, scale }} className="max-w-6xl text-center">
                                <h2 className="text-3xl md:text-6xl lg:text-[5rem] font-black italic leading-[1.1] text-white/80 uppercase tracking-tighter">
                                    "AUConnect isn't just <br /> an application."
                                </h2>
                                <p className="mt-10 text-xl md:text-3xl font-medium text-white/40 max-w-3xl mx-auto leading-relaxed">
                                    It is the <span className="text-white border-b border-white/20 pb-1">Living Architecture</span> of Alliance University.
                                </p>
                            </motion.div>
                        </div>
                    );
                }}
            </ScrollSection>

            <section className="relative py-40 md:py-60 bg-black overflow-hidden" id="hub">
                <div className="relative z-10 text-center px-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8 }}
                        viewport={{ once: true }}
                    >
                        <h2 className="text-6xl md:text-[10rem] font-[1000] italic uppercase tracking-tighter mb-16 leading-[0.8]">Ready to <br /><span className="text-violet-500">Sync?</span></h2>
                    </motion.div>

                    <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 mb-40">
                        <Button onClick={handleSignUp} className="h-20 md:h-24 px-12 md:px-20 rounded-full bg-white text-black text-xs md:text-sm font-[1000] italic uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-2xl hover:shadow-violet-500/50 w-full md:w-auto">
                            Inaugurate Profile <ArrowRight className="ml-4 w-6 h-6" />
                        </Button>
                        <Button onClick={handleLogin} variant="outline" className="h-20 md:h-24 px-12 md:px-20 rounded-full border-white/20 text-xs md:text-sm font-[1000] italic uppercase tracking-[0.3em] hover:bg-white/10 transition-all w-full md:w-auto">
                            Terminal Login
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="relative py-20 px-6 md:px-24 border-t border-white/5 bg-black">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-20 mb-20">
                    <div className="space-y-8">
                        <div className="flex items-center gap-4 cursor-pointer group" onClick={() => scrollToSection('home')}>
                            <div className="w-10 h-10 rounded-xl bg-white/5 p-2 border border-white/5 group-hover:bg-white/10 transition-colors">
                                <img src="/aulogo.png" alt="AU" className="invert brightness-50 object-contain" />
                            </div>
                            <span className="font-black text-xl italic uppercase tracking-tighter text-white/40 group-hover:text-white/60 transition-colors">AUConnect</span>
                        </div>
                        <p className="text-xs text-white/30 leading-relaxed max-w-xs">
                            The decentralized social layer for Alliance University. Built for the elite.
                        </p>
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.4em] text-white/80">Ecosystem</h4>
                        <ul className="space-y-4">
                            {['Features', 'Circles', 'Events', 'Hub'].map(l => (
                                <li key={l}><button onClick={() => scrollToSection(l.toLowerCase())} className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors text-left">{l}</button></li>
                            ))}
                        </ul>
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.4em] text-white/80">Support</h4>
                        <ul className="space-y-4">
                            <li><button onClick={() => setActiveModal('contact')} className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors text-left">Contact Terminal</button></li>
                            <li><button onClick={() => setActiveModal('security')} className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors text-left">Security Protocol</button></li>
                        </ul>
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-xs font-black uppercase tracking-[0.4em] text-white/80">Governance</h4>
                        <ul className="space-y-4">
                            <li><button onClick={() => setActiveModal('privacy')} className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors text-left">Privacy Identity</button></li>
                            <li><button onClick={() => setActiveModal('terms')} className="text-xs font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors text-left">Legal Framework</button></li>
                        </ul>
                    </div>
                </div>
                <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/20">© 2024 Alliance University Connect.</p>
                    <div className="flex gap-6">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-500/50">System Operational</span>
                    </div>
                </div>
            </footer>

            <Modal isOpen={activeModal === 'contact'} onClose={() => setActiveModal(null)} title="Contact Terminal">
                <div className="space-y-10">
                    <p className="text-white/60">Initiate a direct uplink with our development collective. We respond to all high-priority signals within 24 cycles.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex flex-col items-center gap-4 text-center cursor-pointer group">
                            <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform"><Mail className="w-6 h-6 text-violet-400" /></div>
                            <span className="text-sm font-bold tracking-wide">connect@alliance.edu.in</span>
                        </div>
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors flex flex-col items-center gap-4 text-center cursor-pointer group">
                            <div className="w-12 h-12 rounded-full bg-violet-500/10 flex items-center justify-center group-hover:scale-110 transition-transform"><MapPin className="w-6 h-6 text-violet-400" /></div>
                            <span className="text-sm font-bold tracking-wide">Alliance Main Campus</span>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} title="Privacy Identity">
                <div className="space-y-8">
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                        <h4 className="text-white font-bold mb-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> End-to-End Encryption</h4>
                        <p className="text-sm text-white/50">All communication within the AUConnect grid is encrypted. We do not log personal session metadata beyond what is required for security.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                        <h4 className="text-white font-bold mb-2 flex items-center gap-2"><CircleUser className="w-4 h-4 text-blue-400" /> Data Sovereignty</h4>
                        <p className="text-sm text-white/50">You own your data. Profiles can be fully scrubbed from the mainframes upon request.</p>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'terms'} onClose={() => setActiveModal(null)} title="Legal Framework">
                <div className="space-y-6">
                    <p className="text-sm text-white/50">By entering AUConnect, you agree to represent the Alliance community with excellence.</p>
                    <ul className="space-y-4 text-sm text-white/50 list-disc pl-4">
                        <li><b>Zero Tolerance:</b> Malicious scripting, harassment, or unauthorized data scraping will result in immediate profile termination.</li>
                        <li><b>Identity Verification:</b> All users must be verified students or alumni of Alliance University.</li>
                    </ul>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'security'} onClose={() => setActiveModal(null)} title="Security Protocol">
                <div className="space-y-10 text-center py-8">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full" />
                        <ShieldCheck className="relative w-24 h-24 text-violet-400 mx-auto" />
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-white">Citadel-Grade Protection</h3>
                        <p className="text-white/50 max-w-md mx-auto">Security is our terminal priority. We utilize SOC-2 compliant infrastructure to ensure your campus data remains siloed and impenetrable.</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
