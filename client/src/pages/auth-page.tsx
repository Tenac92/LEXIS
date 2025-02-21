import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Μη έγκυρη μορφή email"),
  password: z.string().min(6, "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    console.log('Υποβολή φόρμας σύνδεσης με δεδομένα:', data);
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-4xl grid md:grid-cols-2 gap-6 p-6">
        <div>
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-br from-primary to-primary-foreground bg-clip-text text-transparent">
              Σύστημα Διαχείρισης Εγγράφων
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={loginForm.handleSubmit(onSubmit)}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Διεύθυνση Email</Label>
                  <Input 
                    type="email"
                    id="email"
                    {...loginForm.register("email")}
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="password">Κωδικός</Label>
                  <Input 
                    type="password"
                    id="password"
                    {...loginForm.register("password")}
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-destructive mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Σύνδεση..." : "Σύνδεση"}
                </Button>
              </div>
            </form>
          </CardContent>
        </div>

        <div className="hidden md:block bg-muted rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Καλώς ήρθατε στο ΣΔΕ</h2>
          <p className="text-muted-foreground">
            Διαχειριστείτε αποτελεσματικά τα έγγραφά σας με το ολοκληρωμένο σύστημα διαχείρισης εγγράφων.
            Παρακολουθήστε προϋπολογισμούς, δημιουργήστε αναφορές και διαχειριστείτε πληροφορίες παραληπτών σε ένα μέρος.
          </p>
        </div>
      </Card>
    </div>
  );
}