import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, User, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.adminAuth.login.useMutation({
    onSuccess: (data) => {
      if (data.requiresTwoFactor) {
        if (!data.sessionToken) {
          setError("Session de verification invalide");
          return;
        }
        setSessionToken(data.sessionToken);
        setPassword("");
        setError("");
      } else {
        toast.success("Connecté avec succès");
        setLocation("/admin");
      }
    },
    onError: (err) => {
      setError(err.message || "Erreur de connexion");
      toast.error("Erreur: " + (err.message || "Identifiants invalides"));
    },
  });

  const verifyTwoFactorMutation = trpc.adminAuth.verifyTwoFactor.useMutation({
    onSuccess: () => {
      toast.success("Connecté avec succès");
      setLocation("/admin");
    },
    onError: (err) => {
      setError(err.message || "Code invalide");
      toast.error("Erreur: " + (err.message || "Code invalide"));
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ username, password });
  };

  const handleVerifyTwoFactor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionToken) return;
    setError("");
    verifyTwoFactorMutation.mutate({ sessionToken, code: twoFactorCode });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-crimson/10 to-green-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-crimson text-white rounded-t-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-white text-crimson rounded px-1.5 py-0.5 font-extrabold text-xs leading-none">
              <span className="text-green-accent">%</span>BP
            </div>
            <span className="font-bold">SenBonsPlans</span>
          </div>
          <CardTitle>Administration</CardTitle>
          <CardDescription className="text-crimson/80">
            {sessionToken ? "Vérification 2FA" : "Connexion sécurisée"}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!sessionToken ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username" className="text-sm font-medium">
                  Nom d'utilisateur
                </Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Votre nom d'utilisateur"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                    className="pl-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loginMutation.isPending || !username || !password}
                className="w-full bg-crimson hover:bg-crimson-light text-white"
              >
                {loginMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Se connecter
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                <p className="font-medium mb-1">Authentification à deux facteurs</p>
                <p>Entrez le code 6 chiffres de votre application d'authentification ou un code de secours 8 caractères.</p>
              </div>

              <div>
                <Label htmlFor="code" className="text-sm font-medium">
                  Code de vérification
                </Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000 ou XXXXXXXX"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.toUpperCase())}
                  disabled={verifyTwoFactorMutation.isPending}
                  maxLength={8}
                  className="mt-1 text-center text-lg tracking-widest"
                />
              </div>

              <Button
                type="submit"
                disabled={verifyTwoFactorMutation.isPending || !twoFactorCode}
                className="w-full bg-crimson hover:bg-crimson-light text-white"
              >
                {verifyTwoFactorMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vérifier
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSessionToken(null);
                  setTwoFactorCode("");
                  setError("");
                }}
                className="w-full"
              >
                Retour
              </Button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t text-center text-xs text-muted-foreground">
            <p>Accès réservé aux administrateurs</p>
            <p className="mt-1">Tous les accès sont enregistrés et sécurisés</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
