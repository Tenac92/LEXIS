import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  FileText,
  FolderKanban,
  LogOut,
  Menu,
  LayoutDashboard,
  Users,
  History,
  Bell,
  Key,
  Settings,
  FileSpreadsheet,
  Library
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
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/new-navigation-menu";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChangePasswordModal } from "@/components/auth/change-password-modal";

export function NewHeader() {
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

  return (
    <>
      <motion.header 
        className={`sticky top-0 z-40 w-full border-b transition-all duration-300 ${
          scrolled 
            ? 'bg-background/95 shadow-lg shadow-primary/5 backdrop-blur-sm' 
            : 'bg-background/80 backdrop-blur-sm'
        }`}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-4 py-2">
          <div className="flex justify-between items-center">
            {/* Logo & Title */}
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
            <div className="hidden md:flex items-center space-x-4">
              <NavigationMenu>
                <NavigationMenuList>
                  {/* Dashboard */}
                  <NavigationMenuItem>
                    <Link href="/">
                      <Button variant="ghost" className="flex items-center gap-2 h-9">
                        <LayoutDashboard className="h-4 w-4" />
                        Πίνακας Ελέγχου
                      </Button>
                    </Link>
                  </NavigationMenuItem>

                  {/* Documents */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      <FileText className="h-4 w-4 mr-2" />
                      Διαβιβαστικά
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-48 p-2">
                        <Link href="/documents">
                          <Button variant="ghost" className="w-full justify-start">
                            <FileText className="h-4 w-4 mr-2" />
                            {isRegularUser ? 'Δημιουργία' : 'Προβολή'}
                          </Button>
                        </Link>
                        <Link href="/templates">
                          <Button variant="ghost" className="w-full justify-start mt-1">
                            <Library className="h-4 w-4 mr-2" />
                            Πρότυπα
                          </Button>
                        </Link>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* Projects */}
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      <FolderKanban className="h-4 w-4 mr-2" />
                      Έργα
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-48 p-2">
                        <Link href="/projects">
                          <Button variant="ghost" className="w-full justify-start">
                            <FolderKanban className="h-4 w-4 mr-2" />
                            Όλα τα Έργα
                          </Button>
                        </Link>
                        <Link href="/projects/active">
                          <Button variant="ghost" className="w-full justify-start mt-1">
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            Ενεργά
                          </Button>
                        </Link>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {/* Management */}
                  {(isAdmin || isManager) && (
                    <NavigationMenuItem>
                      <NavigationMenuTrigger>
                        <Settings className="h-4 w-4 mr-2" />
                        Διαχείριση
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <div className="w-48 p-2">
                          <Link href="/budget-history">
                            <Button variant="ghost" className="w-full justify-start">
                              <History className="h-4 w-4 mr-2" />
                              Ιστορικό Προϋπ.
                            </Button>
                          </Link>
                          {isAdmin && (
                            <>
                              <Link href="/users">
                                <Button variant="ghost" className="w-full justify-start mt-1">
                                  <Users className="h-4 w-4 mr-2" />
                                  Χρήστες
                                </Button>
                              </Link>
                              <Link href="/notifications">
                                <Button variant="ghost" className="w-full justify-start mt-1">
                                  <Bell className="h-4 w-4 mr-2" />
                                  Ειδοποιήσεις
                                  <motion.span 
                                    className="ml-auto h-2 w-2 bg-primary rounded-full"
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
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      <Settings className="h-4 w-4 mr-2" />
                      Ρυθμίσεις
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-48 p-2">
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => setIsPasswordModalOpen(true)}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Αλλαγή Κωδικού
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start mt-1 text-destructive hover:text-destructive-foreground"
                          onClick={() => logoutMutation.mutate()}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Αποσύνδεση
                        </Button>
                      </div>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
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
                  className="w-[300px] bg-background/95 backdrop-blur-lg border-l border-primary/10"
                >
                  <SheetHeader>
                    <SheetTitle className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                      Μενού
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <AnimatePresence>
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-2"
                      >
                        <Link href="/">
                          <Button variant="ghost" className="w-full justify-start">
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Πίνακας Ελέγχου
                          </Button>
                        </Link>
                        <Link href="/documents">
                          <Button variant="ghost" className="w-full justify-start">
                            <FileText className="h-4 w-4 mr-2" />
                            Διαβιβαστικά
                          </Button>
                        </Link>
                        <Link href="/templates">
                          <Button variant="ghost" className="w-full justify-start">
                            <Library className="h-4 w-4 mr-2" />
                            Πρότυπα
                          </Button>
                        </Link>
                        <Link href="/projects">
                          <Button variant="ghost" className="w-full justify-start">
                            <FolderKanban className="h-4 w-4 mr-2" />
                            Έργα
                          </Button>
                        </Link>
                        {(isAdmin || isManager) && (
                          <>
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
                                  <Button variant="ghost" className="w-full justify-start">
                                    <Bell className="h-4 w-4 mr-2" />
                                    Ειδοποιήσεις
                                  </Button>
                                </Link>
                              </>
                            )}
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start"
                          onClick={() => setIsPasswordModalOpen(true)}
                        >
                          <Key className="h-4 w-4 mr-2" />
                          Αλλαγή Κωδικού
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start text-destructive hover:text-destructive-foreground"
                          onClick={() => logoutMutation.mutate()}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Αποσύνδεση
                        </Button>
                      </motion.div>
                    </AnimatePresence>
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
