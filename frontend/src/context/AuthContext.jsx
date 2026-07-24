// Contexte d'authentification — utilisateur courant + actions
import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [utilisateur, setUtilisateur] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    authApi.me()
      .then((data) => setUtilisateur(data.utilisateur))
      .catch(() => setUtilisateur(null))
      .finally(() => setChargement(false));
  }, []);

  const login = async (payload) => {
    const data = await authApi.login(payload);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  // Connexion espace élève par code d'accès (sans courriel ni mot de passe)
  const eleveConnexion = async (code) => {
    const data = await authApi.eleveConnexion(code);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  // register ouvre directement la session : il n'y a plus d'étape de vérification
  const register = async (payload) => {
    const data = await authApi.register(payload);
    setUtilisateur(data.utilisateur);
    return data.utilisateur;
  };

  const logout = async () => {
    await authApi.logout();
    setUtilisateur(null);
  };

  return (
    <AuthContext.Provider value={{ utilisateur, chargement, login, eleveConnexion, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider.');
  return ctx;
}
