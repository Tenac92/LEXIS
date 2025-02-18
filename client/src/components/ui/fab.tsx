import { Plus } from 'lucide-react';
import { Button } from './button';
import { useState } from 'react';
import { CreateDocumentDialog } from '../documents/create-document-dialog';

export function FAB() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full p-0 shadow-lg hover:shadow-xl"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <CreateDocumentDialog 
        open={isOpen} 
        onOpenChange={setIsOpen}
      />
    </>
  );
}