import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import {
  Menu, X, Users, Calendar, Briefcase, BookOpen,
  MapPin, ShoppingBag, Ghost, BarChart3, Home,
  Compass, PlusSquare, User, MessageCircle, Bell, Settings,
  Film, Bookmark, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const baseMenuSections = [
  {
    title: "Main",
    items: [
      { icon: Home, label: "Home", path: "/" },
      { icon: Compass, label: "Explore", path: "/explore" },
      { icon: PlusSquare, label: "Create", path: "/create" },
      { icon: Film, label: "Reels", path: "/reels" },
      { icon: User, label: "Profile", path: "/profile" },
    ]
  },
  {
    title: "Community",
    items: [
      { icon: Users, label: "Circles", path: "/circles" },
      { icon: Ghost, label: "Secret Room", path: "/secret-room" },
      { icon: MessageCircle, label: "Messages", path: "/messages" },
    ]
  },
  {
    title: "Campus",
    items: [
      { icon: Calendar, label: "Events", path: "/events" },
      { icon: Briefcase, label: "Internships", path: "/internships" },
      { icon: BookOpen, label: "Study Groups", path: "/study-groups" },
      { icon: MapPin, label: "Lost & Found", path: "/lost-found" },
      { icon: ShoppingBag, label: "Marketplace", path: "/marketplace" },
      { icon: BarChart3, label: "Polls", path: "/polls" },
    ]
  },
  {
    title: "More",
    items: [
      { icon: Bell, label: "Activity", path: "/activity" },
      { icon: Bookmark, label: "Saved", path: "/saved" },
      { icon: Settings, label: "Settings", path: "/settings" },
    ]
  }
];

export function MenuDrawer() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const menuSections = [
    ...baseMenuSections,
    // Add Admin Section if user is authorized
    ...(profile?.role === 'admin' ||
      profile?.role === 'developer' ||
      profile?.username === 'arun' ||
      [
        'carunbtech23@ced.alliance.edu.in',
        'gkartikaybtech23@ced.alliance.edu.in',
        'aateefbtech23@ced.alliance.edu.in',
        'sshlokbtech23@ced.alliance.edu.in',
        'aateef@ced.alliance.edu.in',
        'sshlok@ced.alliance.edu.in'
      ].includes(profile?.email || '') ? [{
        title: "Command Center",
        items: [
          { icon: ShieldCheck, label: "Admin Dashboard", path: "/admin" }
        ]
      }] : [])
  ];

  // Close on ESC key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const menuContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0" style={{ zIndex: 99999 }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            id="menu-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-background border-r border-border overflow-y-auto shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50 sticky top-0 bg-background">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border border-white/10 overflow-hidden bg-white/5 p-1.5 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
                  <img src="/aulogo.png" className="w-full h-full object-contain" alt="Logo" />
                </div>
                <span className="text-xl font-bold gradient-text italic">AUConnect</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="rounded-xl hover:bg-secondary/50"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Menu sections */}
            <div className="p-4 space-y-6">
              {menuSections.map((section) => (
                <div key={section.title}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    {section.title}
                  </h3>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                            isActive
                              ? "bg-primary/20 text-primary"
                              : "text-foreground hover:bg-secondary/50"
                          )}
                        >
                          <item.icon className={cn(
                            "h-5 w-5",
                            isActive && "drop-shadow-[0_0_8px_hsl(var(--primary))]"
                          )} />
                          <span className="font-medium">{item.label}</span>
                          {isActive && (
                            <motion.div
                              layoutId="menu-active-indicator"
                              className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 mt-auto border-t border-border/50 sticky bottom-0 bg-background">
              <p className="text-xs text-muted-foreground text-center">
                AUConnect © 2024
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="rounded-xl hover:bg-secondary/50"
        aria-label="Open menu"
        aria-expanded={isOpen}
        aria-controls="menu-drawer"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Portal to document.body ensures menu renders on top of everything */}
      {typeof document !== 'undefined' && createPortal(menuContent, document.body)}
    </>
  );
}