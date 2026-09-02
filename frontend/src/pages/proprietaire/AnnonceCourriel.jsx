import { useState } from 'react';
import { annonceApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const LONGUEUR_MAX = 5000;

export default function AnnonceCourriel() {
  const [idee, setIdee] = useState('');
  const [objet, setObjet] = useState('');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [iaEnCours, setIaEnCours] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  const genererIA = async () => {
    if (!idee.trim()) return;
    setErreur(''); setIaEnCours(true);
    try {
      const d = await annonceApi.redactionIa(idee.trim());
      if (d.objet) setObjet(d.objet);
      setMessage(d.message);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setIaEnCours(false);
    }
  };

  const envoyer = async () => {
    setErreur(''); setEnCours(true);
    try {
      const r = await annonceApi.envoyerCourriel(objet.trim(), message.trim());
      setResultat(r);
      setIdee(''); setObjet(''); setMessage('');
      setConfirmation(false);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="page-entete">
        <h1>Annonce par courriel</h1>
        <p>Envoyez un message par courriel à tous les parents ayant une adresse enregistrée.</p>
      </div>

      <Carte>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {resultat && (
          <Alerte type="info">
            Envoyé à {resultat.envoyes} sur {resultat.total} parent{resultat.total > 1 ? 's' : ''}
            {resultat.echecs > 0 ? ` (${resultat.echecs} échec${resultat.echecs > 1 ? 's' : ''}).` : '.'}
          </Alerte>
        )}

        <Champ label="Idée de l'annonce (facultatif)" enfant={
          <textarea rows={2} value={idee} onChange={(e) => setIdee(e.target.value)}
            placeholder="Ex. : l'école sera fermée demain pour cause de..." />
        } />
        <div className="rangee" style={{ marginBottom: '1rem' }}>
          <Bouton type="button" variante="secondaire" disabled={!idee.trim()} onClick={genererIA} enCours={iaEnCours}>
            Rédiger avec l'IA
          </Bouton>
        </div>

        <Champ label="Objet" value={objet} onChange={(e) => setObjet(e.target.value)}
          maxLength={200} placeholder="Objet du courriel" />

        <div className="champ">
          <label>Message</label>
          <textarea rows={8} maxLength={LONGUEUR_MAX} value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Rédigez votre message, ou générez un brouillon avec l'IA ci-dessus…" />
          <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '.25rem' }}>
            {message.length}/{LONGUEUR_MAX} caractères
          </p>
        </div>

        <div className="rangee" style={{ marginTop: '.5rem' }}>
          <Bouton type="button" disabled={!objet.trim() || !message.trim()} onClick={() => setConfirmation(true)}>
            Envoyer l'annonce
          </Bouton>
        </div>
      </Carte>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>

      {confirmation && (
        <div className="prof-modal-fond" onClick={() => !enCours && setConfirmation(false)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setConfirmation(false)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Confirmer l'envoi</h2>
            <p style={{ color: '#4A5568', marginBottom: '1rem' }}>
              Ce message sera envoyé par courriel à <strong>tous les parents</strong> ayant une adresse enregistrée.
              Cette action est irréversible.
            </p>
            <p style={{ fontWeight: 700, marginBottom: '.35rem' }}>{objet}</p>
            <p style={{ background: 'var(--gris-champ)', padding: '.75rem', borderRadius: 'var(--rayon-sm)', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
              {message}
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setConfirmation(false)} disabled={enCours}>Annuler</button>
              <button type="button" className="mat-modifier" onClick={envoyer} disabled={enCours}>
                {enCours ? 'Envoi…' : 'Confirmer l\'envoi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
