import { Link } from "wouter";
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
  ChevronDown
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
          {/* Left side - System Title */}
          <div className="hidden md:block">
            <Link href="/">
              <p className="text-sm bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent font-medium hover:cursor-pointer transition-all duration-200 hover:scale-105">
                Σύστημα Διαχείρισης Εγγράφων
              </p>
            </Link>
          </div>

          {/* Center - User Info with Dropdown */}
          <div className="flex-1 flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="p-0 h-auto hover:bg-transparent">
                  <div className="text-center">
                    <h1 className="text-xl font-semibold text-primary flex items-center gap-2">
                      {user?.username || user?.name || 'Χρήστης'}
                      <ChevronDown className="h-4 w-4" />
                    </h1>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48">
                <DropdownMenuItem onClick={() => setIsPasswordModalOpen(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Αλλαγή Κωδικού
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive" 
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Αποσύνδεση
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right side - Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-2">
            <Link href="/documents">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Διαβιβαστικά
              </Button>
            </Link>

            <Link href="/projects">
              <Button variant="ghost" size="sm" className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                Έργα
              </Button>
            </Link>

            {(isAdmin || isManager) && (
              <Link href="/budget-history">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Ιστορικό Προϋπ.
                </Button>
              </Link>
            )}

            {isAdmin && (
              <>
                <Link href="/users">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Χρήστες
                  </Button>
                </Link>
                <Link href="/notifications">
                  <Button variant="ghost" size="sm" className="flex items-center gap-2 relative">
                    <Bell className="h-4 w-4" />
                    Ειδοποιήσεις
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
                  </Button>
                </Link>
              </>
            )}
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
                  <Link href="/documents">
                    <Button variant="ghost" className="w-full justify-start">
                      <FileText className="h-4 w-4 mr-2" />
                      Διαβιβαστικά
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