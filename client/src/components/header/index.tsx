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
    <NavigationMenu className="relative">
      <NavigationMenuList className="gap-2">
        {/* Dashboard */}
        <NavigationMenuItem>
          <Link href="/">
            <Button 
              variant="ghost" 
              className="flex items-center gap-2 transition-all duration-300 hover:bg-primary/10 py-6"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Πίνακας Ελέγχου</span>
            </Button>
          </Link>
        </NavigationMenuItem>

        {/* Documents Section - Renamed to Διαβιβαστικά */}
        <NavigationMenuItem className="relative">
          <NavigationMenuTrigger className="bg-transparent hover:bg-primary/10 py-6 px-4">
            <FileText className="h-4 w-4 mr-2" />
            Διαβιβαστικά
          </NavigationMenuTrigger>
          <NavigationMenuContent className="absolute top-full left-0 mt-1 w-[200px] rounded-md bg-white shadow-lg z-50">
            <div className="grid gap-2 p-4">
              <Link href="/documents">
                <Button variant="ghost" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  {isRegularUser ? 'Δημιουργία' : 'Προβολή'}
                </Button>
              </Link>
              <Link href="/templates">
                <Button variant="ghost" className="w-full justify-start">
                  <Library className="h-4 w-4 mr-2" />
                  Πρότυπα
                </Button>
              </Link>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Projects Section */}
        <NavigationMenuItem className="relative">
          <NavigationMenuTrigger className="bg-transparent hover:bg-primary/10 py-6 px-4">
            <FolderKanban className="h-4 w-4 mr-2" />
            Έργα
          </NavigationMenuTrigger>
          <NavigationMenuContent className="absolute top-full left-0 mt-1 w-[200px] rounded-md bg-white shadow-lg z-50">
            <div className="grid gap-2 p-4">
              <Link href="/projects">
                <Button variant="ghost" className="w-full justify-start">
                  <FolderKanban className="h-4 w-4 mr-2" />
                  Όλα τα Έργα
                </Button>
              </Link>
              <Link href="/projects/active">
                <Button variant="ghost" className="w-full justify-start">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Ενεργά
                </Button>
              </Link>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Management Section - Only for Admin/Manager */}
        {(isManager || isAdmin) && (
          <NavigationMenuItem className="relative">
            <NavigationMenuTrigger className="bg-transparent hover:bg-primary/10 py-6 px-4">
              <Settings className="h-4 w-4 mr-2" />
              Διαχείριση
            </NavigationMenuTrigger>
            <NavigationMenuContent className="absolute top-full left-0 mt-1 w-[200px] rounded-md bg-white shadow-lg z-50">
              <div className="grid gap-2 p-4">
                <Link href="/budget-history">
                  <Button variant="ghost" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    Ιστορικό Προϋπ.
                  </Button>
                </Link>
                {isAdmin && (
                  <>
                    <Link href="/users">
                      <Button variant="ghost" className="w-full justify-start">
                        <Users className="h-4 w-4 mr-2" />
                        Χρήστες
                      </Button>
                    </Link>
                    <Link href="/notifications">
                      <Button variant="ghost" className="w-full justify-start relative">
                        <Bell className="h-4 w-4 mr-2" />
                        Ειδοποιήσεις
                        <motion.span 
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-2 w-2 bg-primary rounded-full"
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
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        )}

        {/* User Settings */}
        <NavigationMenuItem className="relative">
          <NavigationMenuTrigger className="bg-transparent hover:bg-primary/10 py-6 px-4">
            <Settings className="h-4 w-4 mr-2" />
            Ρυθμίσεις
          </NavigationMenuTrigger>
          <NavigationMenuContent className="absolute top-full left-0 mt-1 w-[200px] rounded-md bg-white shadow-lg z-50">
            <div className="grid gap-2 p-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsPasswordModalOpen(true)}
                className="w-full justify-start"
              >
                <Key className="h-4 w-4 mr-2" />
                Αλλαγή Κωδικού
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isPending}
                className="w-full justify-start text-destructive hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Αποσύνδεση
              </Button>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );

  return (
    <>
      <motion.header 
        className={`sticky top-0 z-50 border-b backdrop-blur-sm transition-all duration-300 ${
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
            <div className="hidden md:flex items-center">
              <motion.nav
                className="flex items-center rounded-lg p-1 shadow-lg shadow-primary/5 backdrop-blur-md bg-background/30"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <NavItems />
              </motion.nav>
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
                  <div className="flex flex-col gap-4 mt-6">
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