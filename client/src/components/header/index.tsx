import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FolderKanban,
  LogOut,
  Menu,
  Users,
  History,
  Bell,
  Key,
  ChevronDown,
  Home
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ChangePasswordModal } from "@/components/auth/change-password-modal";
import { cn } from "@/lib/utils";

// Navigation configuration
const navigationItems = [
  { href: "/documents", icon: FileText, label: "Διαβιβαστικά", roles: ["admin", "user"] },
  { href: "/projects", icon: FolderKanban, label: "Έργα", roles: ["admin", "user"] },
  { href: "/budget-history", icon: History, label: "Ιστορικό Προϋπ.", roles: ["admin"] },
  { href: "/employees", icon: Users, label: "Υπάλληλοι", roles: ["admin"] },
  { href: "/beneficiaries", icon: Users, label: "Δικαιούχοι", roles: ["user"] },
  { href: "/users", icon: Users, label: "Χρήστες", roles: ["admin"] },
  { href: "/notifications", icon: Bell, label: "Ειδοποιήσεις", roles: ["admin"] }
];

/**
 * Enhanced Header component with improved navigation and responsive design
 */
export function Header() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Memoized role checks for better performance
  const userRole = useMemo(() => ({
    isAdmin: user?.role === 'admin',
    isManager: user?.role && user?.role !== 'admin' && user?.role !== 'user',
    isRegularUser: user?.role === 'user'
  }), [user?.role]);

  // Memoized filtered navigation items
  const visibleNavItems = useMemo(() => {
    return navigationItems.filter(item => 
      item.roles.includes(user?.role || 'user')
    );
  }, [user?.role]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 w-full border-b ${
      scrolled 
        ? 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60' 
        : 'bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'
    }`}>
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          {/* Left side - System Title */}
          <div className="hidden md:block">
            <Link href="/">
              <h1 className="text-lg font-semibold bg-gradient-to-r from-primary/90 to-primary bg-clip-text text-transparent hover:cursor-pointer transition-all duration-200 hover:scale-105 tracking-tight">
                Σύστημα Διαχείρισης Εγγράφων
              </h1>
            </Link>
          </div>

          {/* Center - User Info with Dropdown */}
          <div className="flex-1 flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="px-4 py-2 h-auto hover:bg-accent/50 rounded-lg transition-all duration-200"
                >
                  <div className="text-center">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user?.name?.charAt(0) || 'Χ'}
                        </span>
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium text-foreground">
                          {user?.name || 'Χρήστης'}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {user?.role === 'admin' ? 'Διαχειριστής' : 'Χρήστης'}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 p-2">
                <div className="px-2 py-2 border-b mb-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuItem 
                  onClick={() => setIsPasswordModalOpen(true)}
                  className="hover:bg-accent/80 cursor-pointer"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Αλλαγή Κωδικού
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive hover:bg-destructive/10 cursor-pointer" 
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Αποσύνδεση
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side - Navigation */}
          <div className="hidden md:flex md:items-center md:gap-2">
            <Link href="/">
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "flex items-center gap-2 transition-all duration-200 px-3 py-2 rounded-lg",
                  location === "/" 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "hover:bg-accent/50"
                )}
              >
                <Home className="h-4 w-4" />
                Αρχική
              </Button>
            </Link>
            
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                      "flex items-center gap-2 transition-all duration-200 px-3 py-2 rounded-lg relative",
                      isActive 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "hover:bg-accent/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {item.href === "/notifications" && userRole.isAdmin && (
                      <motion.div
                        className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [1, 0.8, 1]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      />
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Menu className="h-6 w-6" />
                  {userRole.isAdmin && (
                    <motion.div
                      className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [1, 0.8, 1]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle className="text-left">
                    {user?.name || 'Χρήστης'}
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-2">
                  <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button 
                      variant="ghost" 
                      className={cn(
                        "w-full justify-start",
                        location === "/" && "bg-primary/10 text-primary"
                      )}
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Αρχική
                    </Button>
                  </Link>
                  
                  {visibleNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    
                    return (
                      <Link 
                        key={item.href} 
                        href={item.href} 
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <Button 
                          variant="ghost" 
                          className={cn(
                            "w-full justify-start",
                            isActive && "bg-primary/10 text-primary"
                          )}
                        >
                          <Icon className="h-4 w-4 mr-2" />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                  
                  {/* Action buttons with separator */}
                  <div className="border-t pt-4 mt-4 space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start hover:bg-accent/50"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setTimeout(() => setIsPasswordModalOpen(true), 150);
                      }}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Αλλαγή Κωδικού
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        logoutMutation.mutate();
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Αποσύνδεση
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>

      {/* Use completely decoupled change password modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
}