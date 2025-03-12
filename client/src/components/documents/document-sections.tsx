import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GripVertical } from "lucide-react";

interface DocumentSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface DocumentSectionsProps {
  sections: DocumentSection[];
  onReorder: (newSections: DocumentSection[]) => void;
}

export function DocumentSections({ sections, onReorder }: DocumentSectionsProps) {
  const handleDragEnd = (result: any) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onReorder(items);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="document-sections">
        {(provided) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className="space-y-4"
          >
            {sections.map((section, index) => (
              <Draggable
                key={section.id}
                draggableId={section.id}
                index={index}
              >
                {(provided, snapshot) => (
                  <Card
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`p-4 ${
                      snapshot.isDragging ? "shadow-lg" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        {...provided.dragHandleProps}
                        className="mt-1 cursor-grab"
                      >
                        <GripVertical className="h-5 w-5 text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium mb-2">{section.title}</h3>
                        <div>{section.content}</div>
                      </div>
                    </div>
                  </Card>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
