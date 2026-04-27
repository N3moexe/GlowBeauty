import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function AdminNotAllowed() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Not allowed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous n'avez pas les permissions necessaires pour acceder a cette section.
        </p>
        <div className="mt-5 flex justify-center">
          <Link href="/admin">
            <Button className="bg-crimson text-white hover:bg-crimson-light">Retour admin</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
