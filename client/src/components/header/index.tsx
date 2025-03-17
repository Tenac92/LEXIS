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
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 w-full border-b ${
      scrolled 
        ? 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60' 
        : 'bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60'
    }`}>
      <div className="container mx-auto px-4 py-3">
        <nav className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex-shrink-0">
            <h1 className="text-xl font-semibold text-primary">
              {user?.username || user?.name || 'Χρήστης'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Σύστημα Διαχείρισης Εγγράφων
            </p>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            <NavigationMenu>
              <NavigationMenuList>
                {/* Dashboard */}
                <NavigationMenuItem>
                  <Link href="/">
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Πίνακας Ελέγχου
                    </Button>
                  </Link>
                </NavigationMenuItem>

                {/* Documents */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9">
                    <FileText className="h-4 w-4 mr-2" />
                    Διαβιβαστικά
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-48 p-2">
                      <Link href="/documents">
                        <Button variant="ghost" className="w-full justify-start mb-2">
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

                {/* Projects */}
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9">
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Έργα
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-48 p-2">
                      <Link href="/projects">
                        <Button variant="ghost" className="w-full justify-start mb-2">
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

                {/* Management */}
                {(isAdmin || isManager) && (
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="h-9">
                      <Settings className="h-4 w-4 mr-2" />
                      Διαχείριση
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <div className="w-48 p-2">
                        <Link href="/budget-history">
                          <Button variant="ghost" className="w-full justify-start mb-2">
                            <History className="h-4 w-4 mr-2" />
                            Ιστορικό Προϋπ.
                          </Button>
                        </Link>
                        {isAdmin && (
                          <>
                            <Link href="/users">
                              <Button variant="ghost" className="w-full justify-start mb-2">
                                <Users className="h-4 w-4 mr-2" />
                                Χρήστες
                              </Button>
                            </Link>
                            <Link href="/notifications">
                              <Button variant="ghost" className="w-full justify-start relative">
                                <Bell className="h-4 w-4 mr-2" />
                                Ειδοποιήσεις
                                <motion.div
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
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9">
                    <Settings className="h-4 w-4 mr-2" />
                    Ρυθμίσεις
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <div className="w-48 p-2">
                      <Button
                        variant="ghost"
                        className="w-full justify-start mb-2"
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
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Menu className="h-6 w-6" />
                  {isAdmin && (
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
                  <SheetTitle>Μενού</SheetTitle>
                </SheetHeader>
                <div className="mt-6 flex flex-col gap-2">
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
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
}