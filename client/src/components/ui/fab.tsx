import { Plus } from 'lucide-react';
import { Button } from './button';
import { useState } from 'react';
import { CreateDocumentDialog } from '../documents/create-document-dialog';
import { motion, AnimatePresence } from 'framer-motion';

export function FAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        <Button
          onClick={() => setIsOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full p-0 shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out"
        >
          <motion.div
            animate={{ rotate: isHovered ? 90 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="h-6 w-6" />
          </motion.div>
        </Button>

        <CreateDocumentDialog 
          open={isOpen} 
          onOpenChange={setIsOpen}
        />
      </motion.div>
    </AnimatePresence>
  );
}