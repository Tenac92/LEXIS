import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/header";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

export default function BudgetHistoryPage() {
  const { data: history, isLoading } = useQuery({
    queryKey: ['/api/budget/history'],
    queryFn: async () => {
      const res = await fetch('/api/budget/history');
      if (!res.ok) throw new Error('Failed to fetch budget history');
      return res.json();
    }
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 pt-6 pb-8">
        <Card className="bg-card">
          <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">Budget History</h1>
            <div className="relative">
              {isLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>MIS</TableHead>
                      <TableHead>Previous Amount</TableHead>
                      <TableHead>New Amount</TableHead>
                      <TableHead>Change Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Document ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history?.data?.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>{entry.mis}</TableCell>
                        <TableCell>€{entry.previous_amount}</TableCell>
                        <TableCell>€{entry.new_amount}</TableCell>
                        <TableCell className="capitalize">{entry.change_type.replace('_', ' ')}</TableCell>
                        <TableCell>{entry.change_reason}</TableCell>
                        <TableCell>{entry.document_id}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
