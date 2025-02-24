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
import { motion, AnimatePresence } from "framer-motion";

export function Header() {
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.02 }}
      >
        <Link href="/">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 transition-all duration-300 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/5"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden lg:inline">Πίνακας Ελέγχου</span>
            <span className="lg:hidden">Αρχική</span>
          </Button>
        </Link>
      </motion.div>
      <Separator orientation="vertical" className="h-8 mx-2 bg-gradient-to-b from-primary/30 to-primary/10" />
      {isRegularUser && (
        <>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link href="/documents">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 transition-all duration-300 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/5"
              >
                <FileText className="h-4 w-4" />
                <span className="hidden lg:inline">Δημιουργία Εγγράφων</span>
                <span className="lg:hidden">Έγγραφα</span>
              </Button>
            </Link>
          </motion.div>
          <Separator orientation="vertical" className="h-8 mx-2 bg-gradient-to-b from-primary/30 to-primary/10" />
        </>
      )}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        whileHover={{ scale: 1.02 }}
      >
        <Link href="/projects">
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 transition-all duration-300 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/5"
          >
            <FolderKanban className="h-4 w-4" />
            <span className="hidden lg:inline">Έργα</span>
            <span className="lg:hidden">Έργα</span>
          </Button>
        </Link>
      </motion.div>
      {(isManager || isAdmin) && (
        <>
          <Separator orientation="vertical" className="h-8 mx-2 bg-gradient-to-b from-primary/30 to-primary/10" />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link href="/budget-history">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 transition-all duration-300 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/5"
              >
                <History className="h-4 w-4" />
                <span className="hidden lg:inline">Ιστορικό Προϋπολογισμού</span>
                <span className="lg:hidden">Ιστορικό</span>
              </Button>
            </Link>
          </motion.div>
        </>
      )}
      {isAdmin && (
        <>
          <Separator orientation="vertical" className="h-8 mx-2 bg-gradient-to-b from-primary/30 to-primary/10" />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link href="/users">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 transition-all duration-300 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/5"
              >
                <Users className="h-4 w-4" />
                <span className="hidden lg:inline">Χρήστες</span>
                <span className="lg:hidden">Χρήστες</span>
              </Button>
            </Link>
          </motion.div>
          <Separator orientation="vertical" className="h-8 mx-2 bg-gradient-to-b from-primary/30 to-primary/10" />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
          >
            <Link href="/notifications">
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 transition-all duration-300 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/5 relative"
              >
                <Bell className="h-4 w-4" />
                <span className="hidden lg:inline">Ειδοποιήσεις</span>
                <span className="lg:hidden">Ειδοπ.</span>
                <motion.span 
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
          </motion.div>
        </>
      )}
      <Separator orientation="vertical" className="h-8 mx-2 bg-gradient-to-b from-primary/30 to-primary/10" />
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        whileHover={{ scale: 1.02 }}
      >
        <Button 
          variant="ghost" 
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="flex items-center gap-2 transition-all duration-300 hover:bg-destructive/10 hover:text-destructive hover:shadow-lg hover:shadow-destructive/5"
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
      className={`sticky top-0 z-50 border-b backdrop-blur-sm transition-all duration-300 ${
        scrolled 
          ? 'bg-gradient-to-r from-background/95 via-background/98 to-background/95 shadow-lg shadow-primary/5' 
          : 'bg-gradient-to-r from-background/80 via-background/90 to-background/80'
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
            <motion.div 
              className="flex items-center rounded-lg p-1 shadow-lg shadow-primary/5 backdrop-blur-md bg-background/30"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <NavItems />
            </motion.div>
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
                <motion.div 
                  className="flex flex-col gap-4 mt-6"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <NavItems />
                </motion.div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </motion.header>
  );
}