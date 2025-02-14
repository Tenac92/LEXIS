import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["/api/stats/dashboard"],
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.full_name}</h1>
          <p className="text-muted-foreground">Document Management System</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          Logout
        </Button>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.total_documents || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats?.pending_documents || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">€{stats?.total_amount || 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
