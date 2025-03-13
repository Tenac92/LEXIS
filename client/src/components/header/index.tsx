import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, FolderKanban, LogOut, Menu, LayoutDashboard, Users, History, Bell, Key, Settings, FileSpreadsheet, Library } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChangePasswordModal } from "@/components/auth/change-password-modal";

export function Header() {
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isRegularUser = user?.role === 'user';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const NavItems = () => (
    <NavigationMenu>
      <NavigationMenuList className="flex items-center gap-2">
        {/* Dashboard */}
        <NavigationMenuItem>
          <Link href="/">
            <Button 
              variant="ghost" 
              className="flex items-center gap-2 transition-colors duration-200 hover:bg-primary/10 px-4 py-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Πίνακας Ελέγχου</span>
            </Button>
          </Link>
        </NavigationMenuItem>

        {/* Documents Section - Renamed to Διαβιβαστικά */}
        <NavigationMenuItem>
          <NavigationMenuTrigger 
            className="flex items-center gap-2 transition-colors duration-200 hover:bg-primary/10 px-4 py-2 data-[state=open]:bg-primary/10"
          >
            <FileText className="h-4 w-4" />
            Διαβιβαστικά
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-1 p-2 w-[220px]">
              <Link href="/documents">
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span>{isRegularUser ? 'Δημιουργία' : 'Προβολή'}</span>
                  </div>
                </NavigationMenuLink>
              </Link>
              <Link href="/templates">
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <div className="flex items-center gap-2">
                    <Library className="h-4 w-4" />
                    <span>Πρότυπα</span>
                  </div>
                </NavigationMenuLink>
              </Link>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Projects Section */}
        <NavigationMenuItem>
          <NavigationMenuTrigger 
            className="flex items-center gap-2 transition-colors duration-200 hover:bg-primary/10 px-4 py-2 data-[state=open]:bg-primary/10"
          >
            <FolderKanban className="h-4 w-4" />
            Έργα
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-1 p-2 w-[220px]">
              <Link href="/projects">
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    <span>Όλα τα Έργα</span>
                  </div>
                </NavigationMenuLink>
              </Link>
              <Link href="/projects/active">
                <NavigationMenuLink
                  className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Ενεργά</span>
                  </div>
                </NavigationMenuLink>
              </Link>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Management Section - Only for Admin/Manager */}
        {(isManager || isAdmin) && (
          <NavigationMenuItem>
            <NavigationMenuTrigger 
              className="flex items-center gap-2 transition-colors duration-200 hover:bg-primary/10 px-4 py-2 data-[state=open]:bg-primary/10"
            >
              <Settings className="h-4 w-4" />
              Διαχείριση
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <div className="grid gap-1 p-2 w-[220px]">
                <Link href="/budget-history">
                  <NavigationMenuLink
                    className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      <span>Ιστορικό Προϋπ.</span>
                    </div>
                  </NavigationMenuLink>
                </Link>
                {isAdmin && (
                  <>
                    <Link href="/users">
                      <NavigationMenuLink
                        className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>Χρήστες</span>
                        </div>
                      </NavigationMenuLink>
                    </Link>
                    <Link href="/notifications">
                      <NavigationMenuLink
                        className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground relative"
                      >
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          <span>Ειδοποιήσεις</span>
                          <motion.span 
                            className="absolute right-2 h-2 w-2 bg-primary rounded-full"
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
                        </div>
                      </NavigationMenuLink>
                    </Link>
                  </>
                )}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        )}

        {/* User Settings */}
        <NavigationMenuItem>
          <NavigationMenuTrigger 
            className="flex items-center gap-2 transition-colors duration-200 hover:bg-primary/10 px-4 py-2 data-[state=open]:bg-primary/10"
          >
            <Settings className="h-4 w-4" />
            Ρυθμίσεις
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="grid gap-1 p-2 w-[220px]">
              <NavigationMenuLink
                className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  <span>Αλλαγή Κωδικού</span>
                </div>
              </NavigationMenuLink>
              <NavigationMenuLink
                className="block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-destructive hover:text-destructive-foreground focus:bg-destructive focus:text-destructive-foreground"
                onClick={() => logoutMutation.mutate()}
              >
                <div className="flex items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  <span>Αποσύνδεση</span>
                </div>
              </NavigationMenuLink>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
      <NavigationMenuViewport className="origin-top-center absolute top-full mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]" />
    </NavigationMenu>
  );

  return (
    <>
      <motion.header 
        className={`sticky top-0 z-[100] w-full border-b backdrop-blur-sm transition-all duration-300 ${
          scrolled 
            ? 'bg-gradient-to-r from-background/95 via-background/98 to-background/95 shadow-lg shadow-primary/5' 
            : 'bg-gradient-to-r from-background/80 via-background/90 to-background/80'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-4 py-2">
          <div className="flex justify-between items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="group cursor-default"
            >
              <motion.h1 
                className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80"
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              >
                {user?.username || user?.name || 'Χρήστης'}
              </motion.h1>
              <p className="text-muted-foreground text-sm font-medium transition-colors duration-200 group-hover:text-primary/80">
                Σύστημα Διαχείρισης Εγγράφων
              </p>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <nav className="flex items-center rounded-lg py-1.5 px-2 shadow-lg shadow-primary/5 backdrop-blur-md bg-background/30">
                <NavItems />
              </nav>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden">
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Menu className="h-6 w-6" />
                    {isAdmin && (
                      <motion.span 
                        className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full"
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
                <SheetContent 
                  side="right" 
                  className="w-[300px] bg-gradient-to-b from-background/95 to-background/90 backdrop-blur-lg border-l border-primary/10"
                >
                  <SheetHeader>
                    <SheetTitle className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                      Μενού
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <NavItems />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </motion.header>

      <ChangePasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </>
  );
}