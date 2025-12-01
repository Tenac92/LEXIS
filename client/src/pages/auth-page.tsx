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
    // Security: Never log sensitive form data
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-4xl grid md:grid-cols-2 gap-6 p-6">
        <div>
          <CardHeader>
            <CardTitle className="text-2xl font-bold bg-gradient-to-br from-primary to-primary-foreground bg-clip-text text-transparent">
              SUM-e
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
                  <Label htmlFor="password">Κωδικός Πρόσβασης</Label>
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
                  {loginMutation.isPending ? "Σύνδεση σε εξέλιξη..." : "Σύνδεση"}
                </Button>
              </div>
            </form>
          </CardContent>
        </div>

        <div className="hidden md:block bg-muted rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Καλώς ήρθατε στο SUM-e</h2>
            <p className="text-sm text-muted-foreground font-medium">Ολοκληρωμένη διαχείριση έργων και προϋπολογισμών</p>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Διαχείριση Εγγράφων</h3>
                <p className="text-xs text-muted-foreground">Δημιουργήστε, επεξεργαστείτε και παρακολουθήστε όλα τα έγγραφά σας σε ένα κεντρικό σύστημα</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Έλεγχος Προϋπολογισμού</h3>
                <p className="text-xs text-muted-foreground">Παρακολουθήστε και διαχειριστείτε τους προϋπολογισμούς έργων με ακρίβεια</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">✓</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">Αναφορές & Ανάλυση</h3>
                <p className="text-xs text-muted-foreground">Δημιουργήστε λεπτομερείς αναφορές και αποκτήστε πολύτιμες πληροφορίες</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}