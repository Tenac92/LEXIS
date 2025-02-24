import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, FolderKanban, LogOut, Menu, LayoutDashboard, Users, History, Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export function Header() {
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const NavItems = () => (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link href="/">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:scale-105"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden lg:inline">Πίνακας Ελέγχου</span>
            <span className="lg:hidden">Αρχική</span>
          </Button>
        </Link>
      </motion.div>
      <Separator orientation="vertical" className="h-8 mx-2 bg-primary/20" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Link href="/documents">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:scale-105"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden lg:inline">Δημιουργημένα Έγγραφα</span>
            <span className="lg:hidden">Έγγραφα</span>
          </Button>
        </Link>
      </motion.div>
      <Separator orientation="vertical" className="h-8 mx-2 bg-primary/20" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Link href="/projects">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:scale-105"
          >
            <FolderKanban className="h-4 w-4" />
            <span className="hidden lg:inline">Έργα</span>
            <span className="lg:hidden">Έργα</span>
          </Button>
        </Link>
      </motion.div>
      <Separator orientation="vertical" className="h-8 mx-2 bg-primary/20" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <Link href="/budget-history">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:scale-105"
          >
            <History className="h-4 w-4" />
            <span className="hidden lg:inline">Ιστορικό Προϋπολογισμού</span>
            <span className="lg:hidden">Ιστορικό</span>
          </Button>
        </Link>
      </motion.div>
      {isAdmin && (
        <>
          <Separator orientation="vertical" className="h-8 mx-2 bg-primary/20" />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Link href="/users">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:scale-105"
              >
                <Users className="h-4 w-4" />
                <span className="hidden lg:inline">Χρήστες</span>
                <span className="lg:hidden">Χρήστες</span>
              </Button>
            </Link>
          </motion.div>
          <Separator orientation="vertical" className="h-8 mx-2 bg-primary/20" />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <Link href="/notifications">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 transition-all duration-200 hover:bg-primary/10 hover:scale-105"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden lg:inline">Ειδοποιήσεις</span>
                <span className="lg:hidden">Ειδοπ.</span>
              </Button>
            </Link>
          </motion.div>
        </>
      )}
      <Separator orientation="vertical" className="h-8 mx-2 bg-primary/20" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
      >
        <Button 
          variant="ghost" 
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="flex items-center gap-2 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive hover:scale-105"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden lg:inline">Αποσύνδεση</span>
          <span className="lg:hidden">Έξοδος</span>
        </Button>
      </motion.div>
    </>
  );

  return (
    <motion.header 
      className={`sticky top-0 z-50 border-b bg-gradient-to-r from-card to-card/95 backdrop-blur-sm transition-all duration-300 ${
        scrolled ? 'shadow-md' : ''
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
              {user?.username || user?.name || 'Χρήστης'}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              Σύστημα Διαχείρισης Εγγράφων
            </p>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center">
            <div className="flex items-center bg-background/50 rounded-lg p-1 shadow-sm backdrop-blur-sm">
              <NavItems />
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Menu className="h-6 w-6" />
                  {isAdmin && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent 
                side="right" 
                className="w-[300px] bg-gradient-to-b from-background to-background/95 backdrop-blur-lg"
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
  );
}