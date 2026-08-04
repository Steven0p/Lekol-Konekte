import { useState, useEffect } from 'react';
import { permissionsApi, messagesApi } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';
import Statistiques from './Statistiques.jsx';

const DESCRIPTION = {
  matieres_gestion: "Direction ne peut plus créer, modifier ni supprimer de matière ou coefficient tant que c'est désactivé (la consultation reste possible).",
  notes_saisie: "Le secrétariat ne peut plus saisir, modifier, supprimer ni valider de notes tant que c'est désactivé.",
  notes_publication: "Direction ne peut plus publier ni retirer de bulletins tant que c'est désactivé.",
};

export default function Permissions() {
  const [permissions, setPermissions] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(null);

  const charger = () => permissionsApi.lister().then((d) => setPermissions(d.permissions)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const basculer = async (p) => {
    setErreur('');
    setEnCours(p.cle);
    try {
      await permissionsApi.basculer(p.cle, !p.autorise);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  if (erreur && !permissions) {
    return (
      <div style={{ maxWidth: 960 }}>
        <div className="page-entete"><h1>Contrôle d'accès</h1></div>
        <Alerte type="erreur">{erreur}</Alerte>
        <Bouton type="button" onClick={charger}>Réessayer</Bouton>
      </div>
    );
  }
  if (!permissions) return <Chargement />;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Contrôle d'accès</h1>
        <p>Autorisez ou révoquez, pour direction et le secrétariat, les fonctions les plus sensibles du site.</p>
      </div>

      <Alerte type="erreur">{erreur}</Alerte>

      <Carte>
        {permissions.map((p, i) => (
          <div key={p.cle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem',
            padding: '1rem 0', borderTop: i === 0 ? 'none' : '1px solid var(--s-bord)',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--s-txt)' }}>{p.libelle}</p>
              <p className="texte-gris" style={{ margin: '.25rem 0 0', fontSize: '.85rem', maxWidth: 460 }}>
                {DESCRIPTION[p.cle]}
              </p>
              {p.modifieLe && (
                <p className="texte-gris" style={{ margin: '.25rem 0 0', fontSize: '.78rem' }}>
                  Dernière modification : {dateHeureFr(p.modifieLe)}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexShrink: 0 }}>
              <span className={`tdb-badge ${p.autorise ? 'tdb-badge-vert' : 'tdb-badge-rouge'}`}>
                {p.autorise ? 'Autorisé' : 'Désactivé'}
              </span>
              <label className="eco-switch" title={p.autorise ? 'Désactiver' : 'Autoriser'}>
                <input type="checkbox" checked={p.autorise}
                  disabled={enCours === p.cle} onChange={() => basculer(p)} />
                <span className="eco-slider" />
              </label>
            </div>
          </div>
        ))}
      </Carte>

      <div className="notes-section-titre" style={{ marginTop: '1.5rem' }}><Icone nom="chart" /> Statistiques & santé du site</div>
      <Statistiques />

      <div className="notes-section-titre" style={{ marginTop: '1.5rem' }}><Icone nom="inbox" /> Boîte de réception</div>
      <BoiteReception />

      <div className="notes-section-titre" style={{ marginTop: '1.5rem' }}>Mon compte</div>
      <MonCompte />

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>
    </div>
  );
}

function MonCompte() {
  const { utilisateur, rafraichir } = useAuth();
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauCourriel, setNouveauCourriel] = useState(utilisateur?.courriel || '');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');

    const courrielChange = nouveauCourriel.trim().toLowerCase() !== utilisateur.courriel;
    if (!courrielChange && !nouveauMotDePasse) {
      setErreur("Modifiez le courriel et/ou le mot de passe avant d'enregistrer.");
      return;
    }
    if (nouveauMotDePasse && nouveauMotDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await permissionsApi.modifierCompte({
        motDePasseActuel,
        nouveauCourriel: courrielChange ? nouveauCourriel.trim().toLowerCase() : undefined,
        nouveauMotDePasse: nouveauMotDePasse || undefined,
      });
      await rafraichir();
      setMsg('Compte mis à jour.');
      setMotDePasseActuel(''); setNouveauMotDePasse(''); setConfirmation('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Carte>
      <form onSubmit={soumettre} className="notes-form-grille" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {msg && <Alerte type="info">{msg}</Alerte>}

        <Champ label="Courriel" type="email" value={nouveauCourriel}
          onChange={(e) => setNouveauCourriel(e.target.value)} required />
        <Champ label="Nouveau mot de passe (laisser vide pour ne pas changer)" type="password"
          value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)}
          autoComplete="new-password" placeholder="min. 8 caractères" />
        {nouveauMotDePasse && (
          <Champ label="Confirmer le nouveau mot de passe" type="password" value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" required />
        )}
        <Champ label="Mot de passe actuel (obligatoire pour confirmer)" type="password"
          value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)}
          autoComplete="current-password" required />

        <div>
          <Bouton type="submit" enCours={enCours}>Enregistrer</Bouton>
        </div>
      </form>
    </Carte>
  );
}

const STATUT_LIBELLE = { non_lu: 'Non lu', lu: 'Lu', repondu: 'Répondu' };
const STATUT_BADGE = { non_lu: 'tdb-badge-rouge', lu: 'tdb-badge-gris', repondu: 'tdb-badge-vert' };

function BoiteReception() {
  const [messages, setMessages] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [erreur, setErreur] = useState('');

  const [ouvert, setOuvert] = useState(null); // message en cours de consultation
  const [chargeDetail, setChargeDetail] = useState(false);
  const [reponse, setReponse] = useState('');
  const [iaEnCours, setIaEnCours] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');
  const [msgModal, setMsgModal] = useState('');

  const chargerListe = () => messagesApi.lister(filtre || undefined).then((d) => setMessages(d.messages)).catch((e) => setErreur(e.message));
  useEffect(() => { setMessages(null); chargerListe(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filtre]);

  const ouvrir = async (id) => {
    setErreurModal(''); setMsgModal(''); setReponse(''); setOuvert({ id });
    setChargeDetail(true);
    try {
      const d = await messagesApi.detail(id);
      setOuvert(d.message);
      chargerListe(); // reflète le passage à « lu » dans la liste
    } catch (e) {
      setErreurModal(e.message);
    } finally {
      setChargeDetail(false);
    }
  };

  const genererIA = async () => {
    setErreurModal(''); setIaEnCours(true);
    try {
      const d = await messagesApi.reponseIa(ouvert.id);
      setReponse(d.brouillon);
    } catch (e) {
      setErreurModal(e.message);
    } finally {
      setIaEnCours(false);
    }
  };

  const envoyerReponse = async () => {
    if (!reponse.trim()) { setErreurModal('La réponse ne peut pas être vide.'); return; }
    setErreurModal(''); setEnvoiEnCours(true);
    try {
      await messagesApi.repondre(ouvert.id, reponse);
      setMsgModal('Réponse envoyée par courriel.');
      setOuvert((o) => ({ ...o, statut: 'repondu', reponse }));
      chargerListe();
    } catch (e) {
      setErreurModal(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <>
      <div className="insc-barre" style={{ marginBottom: '.75rem' }}>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les messages</option>
          <option value="non_lu">Non lus</option>
          <option value="lu">Lus</option>
          <option value="repondu">Répondus</option>
        </select>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {!messages ? (
        <Chargement />
      ) : messages.length === 0 ? (
        <Carte><p className="texte-gris">Aucun message pour ce filtre.</p></Carte>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead><tr><th>Nom</th><th>Courriel</th><th>Reçu le</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td className="insc-nom">{m.nom}</td>
                  <td>{m.courriel}</td>
                  <td>{dateHeureFr(m.cree_le)}</td>
                  <td><span className={`tdb-badge ${STATUT_BADGE[m.statut]}`}>{STATUT_LIBELLE[m.statut]}</span></td>
                  <td>
                    <button type="button" className="paie-btn paie-details" onClick={() => ouvrir(m.id)}>Voir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ouvert && (
        <div className="prof-modal-fond" onClick={() => !envoiEnCours && setOuvert(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setOuvert(null)} aria-label="Fermer">×</button>
            {chargeDetail || !ouvert.nom ? <Chargement /> : (
              <>
                <h2 style={{ marginBottom: '.25rem' }}>{ouvert.nom}</h2>
                <p className="texte-gris" style={{ marginBottom: '.75rem' }}>
                  {ouvert.courriel} — {dateHeureFr(ouvert.cree_le)}
                </p>
                <p style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{ouvert.message}</p>

                {ouvert.statut === 'repondu' && ouvert.reponse && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontWeight: 700, marginBottom: '.35rem' }}>Réponse envoyée :</p>
                    <p className="texte-gris" style={{ whiteSpace: 'pre-wrap' }}>{ouvert.reponse}</p>
                  </div>
                )}

                {ouvert.statut !== 'repondu' && (
                  <>
                    {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
                    {msgModal && <Alerte type="info">{msgModal}</Alerte>}
                    <div className="rangee" style={{ marginBottom: '.5rem' }}>
                      <Bouton type="button" variante="secondaire" onClick={genererIA} enCours={iaEnCours}>
                        Générer une réponse (IA)
                      </Bouton>
                    </div>
                    <Champ label="Réponse (envoyée par courriel)" enfant={
                      <textarea rows={6} value={reponse} onChange={(e) => setReponse(e.target.value)}
                        placeholder="Rédigez votre réponse, ou générez un brouillon avec l'IA…" />
                    } />
                    <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '.75rem' }}>
                      <Bouton type="button" onClick={envoyerReponse} enCours={envoiEnCours}>Envoyer la réponse</Bouton>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
