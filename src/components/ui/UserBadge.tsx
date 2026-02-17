import { BadgeCheck, GraduationCap, Medal, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Roles for display logic
const DEV_ROLES = ['admin', 'developer', 'staff', 'mod', 'moderator'];

interface UserBadgeProps {
    userId?: string;
    username?: string;
    role?: string; // If role is passed directly
    isVerified?: boolean;
    verifiedTitle?: string;
    verificationExpiry?: string;
    className?: string;
}

export type BadgeType = "developer" | "professor" | "scholar" | "verified" | "none";

export function UserBadge({ userId, username, role, isVerified, verifiedTitle, verificationExpiry, className }: UserBadgeProps) {
    // Determine badge type
    let badgeType: BadgeType = "none";
    let badgeTitleStr = "";

    // Check verification validity date if provided
    const isVerificationValid = isVerified && (!verificationExpiry || new Date(verificationExpiry) > new Date());

    if (role && DEV_ROLES.includes(role.toLowerCase())) {
        badgeType = "developer";
    } else if (isVerificationValid) {
        badgeType = "verified";
        badgeTitleStr = verifiedTitle || "Verified";
    } else if (role === "professor") {
        badgeType = "professor";
    } else if (role === "special_student" || role === "scholar") {
        badgeType = "scholar";
    }

    if (badgeType === "none") return null;

    const content = {
        developer: {
            icon: <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/10" />,
            label: "Dev",
            bg: "bg-blue-500/10 border-blue-500/20 text-blue-500",
        },
        professor: {
            icon: <GraduationCap className="w-4 h-4 text-amber-500 fill-amber-500/10" />,
            label: "Prof",
            bg: "bg-amber-500/10 border-amber-500/20 text-amber-500",
        },
        scholar: {
            icon: <Star className="w-4 h-4 text-purple-500 fill-purple-500/10" />,
            label: "Scholar",
            bg: "bg-purple-500/10 border-purple-500/20 text-purple-500",
        },
        verified: {
            // Instagram-like: Solid blue tick or similar
            icon: <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500" />,
            label: "Verified",
            bg: "bg-transparent border-none p-0 shadow-none", // Make it just the icon
        },
    }[badgeType];

    if (!content) return null;

    if (badgeType === 'verified') {
        return (
            <div className={cn("ml-1 inline-flex items-center gap-0.5", className)}>
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">Verified</span>
                <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-100" />
            </div>
        );
    }

    return (
        <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wider select-none backdrop-blur-md",
            content.bg,
            className
        )}>
            {content.icon}
            <span>{content.label}</span>
        </div>
    );
}

