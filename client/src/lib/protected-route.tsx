import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import { ReactNode } from "react";

// Accept both sync functions and lazy-loaded components
type ComponentType = (() => React.JSX.Element) | React.LazyExoticComponent<() => React.JSX.Element>;

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: ComponentType;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Route parameters will be passed to Component when rendered through Route
  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}
