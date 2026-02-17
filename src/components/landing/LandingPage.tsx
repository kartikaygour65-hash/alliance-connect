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
                    rotateY: { duration: 10, repeat: Infinity, ease: "linear" },
                    rotateX: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
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
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-2xl bg-neutral-900 border border-white/10 p-8 md:p-12 rounded-[3rem] z-[10001] shadow-2xl"
                    >
                        <button onClick={onClose} className="absolute top-8 right-8 text-white/40 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-8">{title}</h2>
                        <div className="text-white/60 leading-relaxed max-h-[60vh] overflow-y-auto pr-4 scrollbar-hide">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

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
            className="fixed inset-0 bg-[#020202] text-white selection:bg-white selection:text-black font-sans overflow-x-hidden overflow-y-auto scroll-smooth scrollbar-hide z-[9999]"
        >
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]" />
                <div className="absolute top-0 left-0 right-0 h-screen bg-[radial-gradient(circle_at_50%_-10%,rgba(139,92,246,0.08),transparent_60%)]" />
            </div>

            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={`fixed top-0 left-0 right-0 z-[100] px-6 py-4 md:px-12 md:py-6 flex justify-between items-center transition-all duration-700 ${scrolled ? 'bg-black/40 backdrop-blur-2xl border-b border-white/5 py-3 md:py-4' : 'bg-transparent'}`}
            >
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}>
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-2 shadow-lg shadow-white/10 group-hover:scale-110 transition-transform">
                        <img src="/aulogo.png" alt="AU" className="invert object-contain" />
                    </div>
                    <span className="text-xl font-bold italic tracking-tighter uppercase whitespace-nowrap pr-4">AUConnect</span>
                </div>

                <div className="hidden lg:flex items-center gap-10">
                    {['Features', 'Circles', 'Events', 'Hub', 'About'].map((item) => (
                        <button
                            key={item}
                            onClick={() => scrollToSection(item.toLowerCase())}
                            className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white transition-all hover:scale-105"
                        >
                            {item}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white" onClick={handleLogin}>
                        Sign In
                    </Button>
                    <Button className="bg-white text-black hover:bg-white/90 rounded-full px-8 text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:shadow-white/20 transition-all" onClick={handleSignUp}>
                        Join Now
                    </Button>
                </div>
            </motion.nav>

            {/* HERO SECTION */}
            <ScrollSection containerRef={containerRef} range={1.8} id="home">
                {(progress: any) => {
                    const opacity = useTransform(progress, [0, 0.7, 1], [1, 1, 0]);
                    const scale = useTransform(progress, [0, 1], [1, 0.95]);
                    const y = useTransform(progress, [0, 1], [0, -100]);

                    return (
                        <motion.div style={{ opacity, scale, y }} className="relative h-full w-full flex flex-col items-center justify-center text-center px-6">
                            <ThreeDLogo className="absolute top-[20%] opacity-20 pointer-events-none blur-[2px]" />

                            <motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 1.2 }}
                                className="mb-10 z-10"
                            >
                                <span className="px-6 py-2.5 rounded-full border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.5em] text-violet-400 backdrop-blur-3xl">
                                    The Digital Heart-Rate of Alliance
                                </span>
                            </motion.div>

                            <h1 className="text-5xl md:text-8xl lg:text-[9.5rem] font-[1000] italic uppercase tracking-[-0.05em] leading-[0.8] mb-10 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 z-10 pr-6">
                                AUConnect
                            </h1>

                            <p className="text-xl md:text-3xl text-white/30 max-w-3xl font-medium leading-[1.4] mb-14 z-10 italic">
                                A high-fidelity social layer for the campus elite. <br className="hidden md:block" />
                                Synchronous, cinematic, and decentralized.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-8 z-10">
                                <Button onClick={handleSignUp} className="h-20 px-14 rounded-full bg-white text-black text-[12px] font-black uppercase tracking-[0.3em] hover:scale-105 transition-all shadow-2xl">
                                    Enter The Collective <ArrowRight className="ml-3 w-5 h-5" />
                                </Button>
                                <Button onClick={() => scrollToSection('features')} variant="outline" className="h-20 px-14 rounded-full border-white/10 bg-white/5 text-[12px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all backdrop-blur-sm">
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
                    const layer3Y = useTransform(progress, [0, 1], [300, -300]);

                    return (
                        <div className="relative h-full w-full flex flex-col items-center justify-center px-6 overflow-hidden">
                            <motion.div style={{ opacity }} className="relative z-10 text-center mb-32">
                                <span className="text-violet-500 font-black uppercase tracking-[0.8em] text-[10px] mb-6 block">Interface Paradigm</span>
                                <h2 className="text-5xl md:text-8xl font-black italic uppercase tracking-tighter leading-[0.8] mb-8">Architected <br /> for <span className="text-white/20">Action.</span></h2>
                            </motion.div>

                            <div className="relative w-full max-w-6xl aspect-[16/10] flex items-center justify-center">
                                <motion.div style={{ y: layer1Y, opacity }} className="absolute inset-0 bg-white/[0.02] border border-white/5 rounded-[4rem] backdrop-blur-[10px]" />
                                <motion.div style={{ y: layer2Y, opacity }} className="absolute w-[80%] h-[70%] bg-neutral-950 border border-white/10 rounded-[3rem] p-12 overflow-hidden flex flex-col shadow-2xl">
                                    <div className="flex items-center gap-6 mb-12">
                                        <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center"><Zap className="w-8 h-8 text-violet-500" /></div>
                                        <div className="space-y-3">
                                            <div className="h-4 w-48 bg-white/20 rounded-full" />
                                            <div className="h-2 w-32 bg-white/10 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-8 flex-grow">
                                        <div className="col-span-2 bg-white/5 rounded-[2rem] border border-white/5 p-8 relative">
                                            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent" />
                                        </div>
                                        <div className="bg-white/5 rounded-[2rem] border border-white/5" />
                                    </div>
                                </motion.div>
                                <motion.div style={{ y: layer3Y, opacity, x: 200 }} className="absolute top-0 right-0 w-80 h-48 bg-violet-600 rounded-[2rem] p-8 shadow-2xl flex flex-col justify-center">
                                    <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-4 opacity-60 text-white">Live Pulse</div>
                                    <div className="text-3xl font-black italic tracking-tight text-white mb-2">4,520+</div>
                                    <div className="text-[11px] font-bold text-white/50">Active Synchronized Users</div>
                                </motion.div>
                            </div>
                        </div>
                    );
                }}
            </ScrollSection>

            {/* CIRCLES SECTION */}
            <section className="relative py-60 px-6 max-w-7xl mx-auto" id="circles">
                <div className="text-center mb-40">
                    <h2 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-[0.8]">One Ecosystem. <br /><span className="text-white/20">Infinite Sync.</span></h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {[
                        { id: 'circles', icon: Users, color: 'text-violet-500', title: 'Community Circles', desc: 'Specialized guilds from FinTech to Fine Arts. Claim your tribe.' },
                        { id: 'messaging', icon: MessageSquare, color: 'text-blue-500', title: 'Hyper Messaging', desc: 'Secure, low-latency dialogue across the entire AU domain.' },
                        { id: 'feed', icon: Share2, color: 'text-emerald-500', title: 'Momentum Feed', desc: 'Real-time algorithmically sorted campus updates.' }
                    ].map((f, i) => (
                        <motion.div key={i} className="group relative p-12 rounded-[3rem] bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-700">
                            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-10 ${f.color}`}><f.icon className="w-8 h-8" /></div>
                            <h3 className="text-2xl font-[1000] uppercase italic tracking-tighter mb-5">{f.title}</h3>
                            <p className="text-white/30 text-lg leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* EVENTS SECTION */}
            <section className="relative py-40 px-6 max-w-7xl mx-auto" id="events">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    {[
                        { id: 'market', icon: ShoppingBag, color: 'text-amber-500', title: 'Student Economy', desc: 'The verified hub for textbooks, tech, and services.' },
                        { id: 'events', icon: Calendar, color: 'text-rose-500', title: 'Events Terminal', desc: 'Your gateway to LIT FEST and every major cultural shift.' },
                        { id: 'security', icon: ShieldCheck, color: 'text-slate-400', title: 'Identity Grid', desc: 'Biometric-level security for your campus credentials.' }
                    ].map((f, i) => (
                        <motion.div key={i} className="group relative p-12 rounded-[3rem] bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all duration-700">
                            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-10 ${f.color}`}><f.icon className="w-8 h-8" /></div>
                            <h3 className="text-2xl font-[1000] uppercase italic tracking-tighter mb-5">{f.title}</h3>
                            <p className="text-white/30 text-lg leading-relaxed">{f.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            <ScrollSection containerRef={containerRef} range={1.5} id="about">
                {(progress: any) => {
                    const opacity = useTransform(progress, [0, 0.4, 0.8, 1], [0, 1, 1, 0]);
                    return (
                        <div className="relative h-full w-full flex items-center justify-center px-8">
                            <motion.div style={{ opacity }} className="max-w-5xl text-center">
                                <h2 className="text-4xl md:text-7xl font-black italic leading-[1.1] text-white/90 uppercase tracking-tighter">
                                    "AUConnect isn't just <br /> an application. It is the <span className="text-white">Living Architecture</span> of Alliance University."
                                </h2>
                            </motion.div>
                        </div>
                    );
                }}
            </ScrollSection>

            <section className="relative py-60 bg-black overflow-hidden" id="hub">
                <div className="relative z-10 text-center px-6">
                    <h2 className="text-7xl md:text-[11rem] font-[1000] italic uppercase tracking-tighter mb-20 leading-[0.75]">Ready to <br /><span className="text-violet-500">Sync?</span></h2>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-10 mb-40">
                        <Button onClick={handleSignUp} className="h-24 px-20 rounded-full bg-white text-black text-[14px] font-[1000] italic uppercase tracking-[0.4em] hover:scale-105 transition-all shadow-2xl">
                            Inaugurate Profile <ArrowRight className="ml-4 w-6 h-6" />
                        </Button>
                        <Button onClick={handleLogin} variant="outline" className="h-24 px-20 rounded-full border-white/20 text-[14px] font-[1000] italic uppercase tracking-[0.4em] hover:bg-white/10 transition-all">
                            Terminal Login
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="relative py-32 px-12 md:px-24 border-t border-white/5 bg-black">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-32">
                    <div className="space-y-8">
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => scrollToSection('home')}>
                            <div className="w-10 h-10 rounded-xl bg-white/5 p-2"><img src="/aulogo.png" alt="AU" className="invert brightness-50" /></div>
                            <span className="font-black text-xl italic uppercase tracking-tighter text-white/40">AUConnect</span>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/80">Ecosystem</h4>
                        <ul className="space-y-4">
                            {['Features', 'Circles', 'Events', 'Hub'].map(l => (
                                <li key={l}><button onClick={() => scrollToSection(l.toLowerCase())} className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors">{l}</button></li>
                            ))}
                        </ul>
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/80">Support</h4>
                        <ul className="space-y-4">
                            <li><button onClick={() => setActiveModal('contact')} className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors">Contact Terminal</button></li>
                            <li><button onClick={() => setActiveModal('security')} className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors">Security Protocol</button></li>
                        </ul>
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-white/80">Governance</h4>
                        <ul className="space-y-4">
                            <li><button onClick={() => setActiveModal('privacy')} className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors">Privacy Identity</button></li>
                            <li><button onClick={() => setActiveModal('terms')} className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 hover:text-white transition-colors">Legal Framework</button></li>
                        </ul>
                    </div>
                </div>
            </footer>

            <Modal isOpen={activeModal === 'contact'} onClose={() => setActiveModal(null)} title="Contact Terminal">
                <div className="space-y-10">
                    <p>Initiate a direct uplink with our development collective.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center gap-4">
                            <Mail className="w-8 h-8 text-violet-500" /><span className="text-sm font-bold">connect@alliance.edu.in</span>
                        </div>
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center gap-4">
                            <MapPin className="w-8 h-8 text-violet-500" /><span className="text-sm font-bold">Alliance Main Campus</span>
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} title="Privacy Identity">
                <div className="space-y-8"><p>All communication within the AUConnect grid is encrypted end-to-end. We do not log personal session metadata beyond what is required for security.</p></div>
            </Modal>

            <Modal isOpen={activeModal === 'terms'} onClose={() => setActiveModal(null)} title="Legal Framework">
                <div className="space-y-8"><p>By entering AUConnect, you agree to represent the Alliance community with excellence. Malicious scripting will result in profile termination.</p></div>
            </Modal>

            <Modal isOpen={activeModal === 'security'} onClose={() => setActiveModal(null)} title="Security Protocol">
                <div className="space-y-10 text-center">
                    <ShieldCheck className="w-24 h-24 text-violet-500 mx-auto" />
                    <p className="text-lg">Security is our terminal priority. We utilize SOC-2 compliant infrastructure to ensure your campus data remains siloed.</p>
                </div>
            </Modal>
        </div>
    );
}
