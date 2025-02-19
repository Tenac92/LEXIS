import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FileText, FolderKanban, LogOut, Menu, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

export function Header() {
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavItems = () => (
    <>
      <Link href="/">
        <Button variant="ghost" className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Button>
      </Link>
      <Separator orientation="vertical" className="h-8 mx-2" />
      <Link href="/documents">
        <Button variant="ghost" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Generated Documents
        </Button>
      </Link>
      <Separator orientation="vertical" className="h-8 mx-2" />
      <Link href="/projects">
        <Button variant="ghost" className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4" />
          Projects
        </Button>
      </Link>
      <Separator orientation="vertical" className="h-8 mx-2" />
      <Button 
        variant="ghost" 
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        className="flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </Button>
    </>
  );


  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {user?.username || user?.name || 'User'}
            </h1>
            <p className="text-muted-foreground">Document Management System</p>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            <div className="flex items-center bg-background rounded-lg p-1 shadow-sm">
              <NavItems />
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 mt-6">
                  <NavItems />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}