import { Plus } from 'lucide-react';
import { Button } from './button';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreateDocumentDialog } from '../documents/create-document-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const buttonVariants = {
  initial: { 
    scale: 0.8, 
    opacity: 0,
    y: 20 
  },
  animate: { 
    scale: 1, 
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
      duration: 0.4
    }
  },
  exit: { 
    scale: 0.8, 
    opacity: 0,
    y: 20,
    transition: {
      duration: 0.3
    }
  },
  hover: {
    scale: 1.05,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25
    }
  },
  tap: {
    scale: 0.95
  }
};

const iconVariants = {
  initial: { rotate: 0 },
  hover: { 
    rotate: 45,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 10
    }
  }
};

const tooltipVariants = {
  initial: { opacity: 0, x: 10 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0, 
    x: 10,
    transition: {
      duration: 0.1
    }
  }
};

export function FAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        variants={buttonVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        whileHover="hover"
        whileTap="tap"
        className="fixed bottom-6 right-6 z-50"
      >
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setIsOpen(true)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="h-14 w-14 rounded-full p-0 shadow-lg hover:shadow-xl transition-shadow duration-300 ease-in-out bg-primary"
              >
                <motion.div
                  variants={iconVariants}
                  animate={isHovered ? "hover" : "initial"}
                >
                  <Plus className="h-6 w-6" />
                </motion.div>
              </Button>
            </TooltipTrigger>
            <TooltipContent 
              side="left" 
              sideOffset={5}
              asChild
            >
              <motion.div
                variants={tooltipVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="bg-popover text-popover-foreground px-3 py-1.5 text-sm rounded-md shadow-md"
              >
                Create New Document
              </motion.div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <CreateDocumentDialog 
          open={isOpen} 
          onOpenChange={setIsOpen}
        />
      </motion.div>
    </AnimatePresence>
  );
}