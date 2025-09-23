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
  Home,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ChangePasswordModal } from "@/components/auth/change-password-modal";
import { cn } from "@/lib/utils";

// Navigation configuration
const navigationItems = [
  {
    href: "/documents",
    icon: FileText,
    label: "Διαβιβαστικά",
    roles: ["admin", "user", "manager"],
  },
  {
    href: "/projects",
    icon: FolderKanban,
    label: "Έργα",
    roles: ["admin", "user", "manager"],
  },
  {
    href: "/budget-history",
    icon: History,
    label: "Ιστορικό Προϋπ.",
    roles: ["admin", "manager"],
  },
  {
    href: "/employees",
    icon: Users,
    label: "Υπάλληλοι",
    roles: ["admin", "manager"],
  },
  { href: "/beneficiaries", icon: Users, label: "Δικαιούχοι", roles: ["user"] },
  { href: "/users", icon: Users, label: "Χρήστες", roles: ["admin"] },
  {
    href: "/notifications",
    icon: Bell,
    label: "Ειδοποιήσεις",
    roles: ["admin", "manager"],
  },
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
  const userRole = useMemo(
    () => ({
      isAdmin: user?.role === "admin",
      isManager: user?.role && user?.role !== "admin" && user?.role !== "user",
      isRegularUser: user?.role === "user",
    }),
    [user?.role],
  );

  // Memoized filtered navigation items
  const visibleNavItems = useMemo(() => {
    return navigationItems.filter((item) =>
      item.roles.includes(user?.role || "user"),
    );
  }, [user?.role]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <TooltipProvider>
      <header
        className={cn(
          "sticky top-0 z-50 w-full border-b transition-all duration-200",
          scrolled
            ? "bg-background/95 backdrop-blur-md shadow-sm border-border/80"
            : "bg-background/90 backdrop-blur-sm border-border/40",
        )}
      >
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center justify-between gap-4">
            {/* Left side - System Title */}
            <div className="flex-shrink-0">
              <Link href="/">
                <div className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-primary/30 to-primary/10 rounded-lg flex items-center justify-center border border-primary/20 md:hidden">
                    <span className="text-sm font-bold text-primary">ΣΔ</span>
                  </div>
                  <h1 className="hidden md:block text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent tracking-tight">
                    Σύστημα Διαχείρισης Εγγράφων
                  </h1>
                </div>
              </Link>
            </div>

            {/* Center - User Info with Dropdown */}
            <div className="flex-1 flex justify-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="px-3 py-2 h-auto hover:bg-accent/50 rounded-lg transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                        <span className="text-base font-semibold text-primary">
                          {user?.name
                            ?.split(" ")
                            .map((n) => n.charAt(0))
                            .join("")
                            .slice(0, 2) || "ΧΡ"}
                        </span>
                      </div>
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-sm font-medium text-foreground truncate max-w-[140px]">
                          {user?.name || "Χρήστης"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {user?.role === "admin"
                            ? "Διαχειριστής"
                            : user?.role === "manager"
                              ? "Εποπτεύων"
                              : "Χρήστης"}
                        </span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground ml-1 flex-shrink-0" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64 p-0 mt-2">
                  <div className="px-4 py-3 border-b bg-accent/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                        <span className="text-sm font-semibold text-primary">
                          {user?.name
                            ?.split(" ")
                            .map((n) => n.charAt(0))
                            .join("")
                            .slice(0, 2) || "ΧΡ"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {user?.name || "Χρήστης"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                        <p className="text-xs text-primary/80 font-medium mt-0.5">
                          {user?.role === "admin"
                            ? "Διαχειριστής"
                            : user?.role === "manager"
                              ? "Εποπτεύων"
                              : "Χρήστης"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="py-2">
                    <DropdownMenuItem
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="mx-2 hover:bg-accent/80 cursor-pointer rounded-md"
                    >
                      <Key className="h-4 w-4 mr-3" />
                      Αλλαγή Κωδικού
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="mx-2 text-destructive focus:text-destructive hover:bg-destructive/10 cursor-pointer rounded-md"
                      onClick={() => logoutMutation.mutate()}
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Αποσύνδεση
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right side - Navigation */}
            <div className="hidden lg:flex lg:items-center lg:gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "flex items-center gap-2 transition-all duration-200 px-3 py-1.5 rounded-md text-sm font-medium",
                        location === "/"
                          ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                          : "hover:bg-accent/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Home className="h-4 w-4" />
                      <span className="hidden xl:inline">Αρχική</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Αρχική Σελίδα</p>
                </TooltipContent>
              </Tooltip>

              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;

                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link href={item.href}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "flex items-center gap-2 transition-all duration-200 px-3 py-1.5 rounded-md text-sm font-medium relative",
                            isActive
                              ? "bg-primary/10 text-primary shadow-sm border border-primary/20"
                              : "hover:bg-accent/60 text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="hidden xl:inline whitespace-nowrap">
                            {item.label}
                          </span>
                          {item.href === "/notifications" &&
                            userRole.isAdmin && (
                              <motion.div
                                className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full shadow-sm"
                                animate={{
                                  scale: [1, 1.2, 1],
                                  opacity: [1, 0.8, 1],
                                }}
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              />
                            )}
                        </Button>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative hover:bg-accent/50 rounded-lg"
                      >
                        <Menu className="h-5 w-5" />
                        {userRole.isAdmin && (
                          <motion.div
                            className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full shadow-sm"
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [1, 0.8, 1],
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        )}
                      </Button>
                    </SheetTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Μενού Πλοήγησης</p>
                  </TooltipContent>
                </Tooltip>
                <SheetContent side="right" className="w-80 p-0">
                  <div className="px-6 py-4 border-b bg-accent/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                        <span className="text-sm font-semibold text-primary">
                          {user?.name
                            ?.split(" ")
                            .map((n) => n.charAt(0))
                            .join("")
                            .slice(0, 2) || "ΧΡ"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {user?.name || "Χρήστης"}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                          {user?.email}
                        </p>
                        <p className="text-xs text-primary/80 font-medium mt-0.5">
                          {user?.role === "admin"
                            ? "Διαχειριστής"
                            : user?.role === "manager"
                              ? "Εποπτεύων"
                              : "Χρήστης"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 flex flex-col gap-1">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Πλοήγηση
                    </h4>

                    <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start rounded-lg h-10 font-medium",
                          location === "/"
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-accent/60",
                        )}
                      >
                        <Home className="h-4 w-4 mr-3" />
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
                              "w-full justify-start rounded-lg h-10 font-medium relative",
                              isActive
                                ? "bg-primary/10 text-primary border border-primary/20"
                                : "hover:bg-accent/60",
                            )}
                          >
                            <Icon className="h-4 w-4 mr-3" />
                            {item.label}
                            {item.href === "/notifications" &&
                              userRole.isAdmin && (
                                <div className="ml-auto w-2 h-2 bg-red-500 rounded-full" />
                              )}
                          </Button>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Action buttons with separator */}
                  <div className="px-6 py-4 border-t bg-accent/10 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Λογαριασμός
                    </h4>
                    <Button
                      variant="ghost"
                      className="w-full justify-start hover:bg-accent/60 rounded-lg h-10 font-medium"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setTimeout(() => setIsPasswordModalOpen(true), 150);
                      }}
                    >
                      <Key className="h-4 w-4 mr-3" />
                      Αλλαγή Κωδικού
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive rounded-lg h-10 font-medium"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        logoutMutation.mutate();
                      }}
                    >
                      <LogOut className="h-4 w-4 mr-3" />
                      Αποσύνδεση
                    </Button>
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
    </TooltipProvider>
  );
}
