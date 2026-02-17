import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

// 1. IMPORT SIGNOUT FROM SUPABASE LIB, NOT USEAUTH
import { signOut } from "@/lib/supabase"; 

export function Navbar() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    // 2. CALL IT DIRECTLY
    await signOut(); 
    navigate("/auth");
  };

  return (
    // ... your navbar code ...
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleLogout}
      className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
    >
      <LogOut className="h-5 w-5" />
    </Button>
    // ...
  );
}