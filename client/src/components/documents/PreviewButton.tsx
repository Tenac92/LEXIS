import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PreviewButtonProps {
  templateId: number;
  previewData?: any;
  disabled?: boolean;
}

export function PreviewButton({ templateId, previewData, disabled }: PreviewButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePreview = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/templates/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId,
          previewData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      // Get the blob and create a download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-preview.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Preview error:', error);
      toast({
        title: 'Preview Failed',
        description: error instanceof Error ? error.message : 'Failed to generate preview',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handlePreview}
      disabled={disabled || loading}
    >
      <Eye className="mr-2 h-4 w-4" />
      {loading ? 'Generating...' : 'Preview'}
    </Button>
  );
}
