import { useEffect, useRef, useState } from 'react';
import { authApi } from '../services/api.js';

// Attend que le script Google Identity Services (chargé dans index.html) soit
// prêt — il est chargé en <script defer>, potentiellement pas encore exécuté
// au montage de ce composant.
function attendreGoogle() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const id = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(id);
        resolve(window.google);
      }
    }, 100);
    setTimeout(() => clearInterval(id), 10_000);
  });
}

// Bouton « Se connecter avec Google » — réutilisé sur Login et Register.
// Ne s'affiche pas si l'intégration n'est pas configurée côté serveur
// (pas de GOOGLE_CLIENT_ID) ou si le script Google échoue à charger.
export default function BoutonGoogle({ onCredential, texte = 'signin_with' }) {
  const conteneurRef = useRef(null);

  useEffect(() => {
    let annule = false;
    authApi.googleClientId()
      .then(async (d) => {
        if (!d.clientId || annule) return;
        const google = await attendreGoogle();
        if (annule || !conteneurRef.current) return;
        google.accounts.id.initialize({
          client_id: d.clientId,
          callback: (reponse) => onCredential(reponse.credential),
        });
        google.accounts.id.renderButton(conteneurRef.current, {
          type: 'standard', theme: 'outline', size: 'large', width: 320, text: texte, logo_alignment: 'left',
        });
      })
      .catch(() => { /* bouton simplement absent si la configuration échoue */ });
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: 'grid', justifyItems: 'center', margin: '1rem 0' }}>
      <div ref={conteneurRef} />
    </div>
  );
}
