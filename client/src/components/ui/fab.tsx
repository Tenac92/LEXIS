import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { CreateDocumentDialog } from "@/components/documents/create-document-dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const tooltipVariants = {
  initial: { opacity: 0, scale: 0.8, y: 10 },
  animate: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0,
    scale: 0.8,
    y: 10,
    transition: {
      duration: 0.15
    }
  }
};

const buttonVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.1 },
  tap: { scale: 0.95 }
};

export function FAB() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Only show FAB for regular users, not for admin or manager roles
  if (!user || user.role === 'admin' || user.role === 'manager') {
    return null;
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-full",
            "bg-gradient-to-r from-primary to-primary/90",
            "text-primary-foreground shadow-lg",
            "transition-shadow hover:shadow-xl"
          )}
          onClick={() => setIsOpen(true)}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          variants={buttonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
        >
          <Plus className="h-6 w-6" />
          <AnimatePresence>
            {isHovered && (
              <motion.div
                className="absolute right-full mr-4 rounded-md bg-popover px-3 py-1.5 text-sm font-medium text-popover-foreground shadow-md"
                variants={tooltipVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                Create Document
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <CreateDocumentDialog 
        open={isOpen} 
        onOpenChange={handleOpenChange}
        onClose={handleClose}
      />
    </>
  );
}