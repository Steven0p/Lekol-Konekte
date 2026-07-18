import { useEffect, useRef, useState } from 'react';
import { adminApi, urlPhotoEleveAdmin, urlLogoEcole } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import CarteBadge from '../../components/CarteBadge.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function AdminBadges() {
  const [recherche, setRecherche] = useState('');
  const [eleves, setEleves] = useState(null);
  const [badge, setBadge] = useState(null);
  const [version, setVersion] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichierRef = useRef(null);

  const charger = (r) => {
    adminApi.elevesCodes(r).then((d) => setEleves(d.eleves)).catch((e) => setErreur(e.message));
  };
  useEffect(() => { charger(''); }, []);

  const rechercher = (e) => {
    e.preventDefault();
    setEleves(null);
    charger(recherche);
  };

  const voirBadge = async (id) => {
    setErreur('');
    try {
      const d = await adminApi.badgeEleve(id);
      setBadge(d.badge);
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(e.message);
    }
  };

  const envoyerPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier || !badge) return;
    setErreur('');
    setEnCours(true);
    try {
      await adminApi.televerserPhotoEleve(badge.id, fichier);
      setVersion((v) => v + 1);
      setBadge((b) => ({ ...b, aPhoto: true }));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="page-entete no-print">
        <h1>Badges élèves</h1>
        <p>Recherchez un élève, ajoutez sa photo si besoin, puis imprimez son badge.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <div className="grille grille-2 no-print" style={{ alignItems: 'start' }}>
        <Carte titre="Élèves">
          <form onSubmit={rechercher}>
            <div className="rangee" style={{ gap: '.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Champ label="Rechercher" value={recherche}
                onChange={(e) => setRecherche(e.target.value)} placeholder="nom, niveau, code…" />
              <div style={{ marginBottom: '1rem' }}><Bouton type="submit" variante="secondaire">Rechercher</Bouton></div>
            </div>
          </form>
          {!eleves ? <Chargement /> : eleves.length === 0 ? (
            <p className="texte-gris">Aucun élève trouvé.</p>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead><tr><th>Élève</th><th>Niveau</th><th></th></tr></thead>
                <tbody>
                  {eleves.map((el) => (
                    <tr key={el.id}>
                      <td style={{ fontWeight: 600 }}>{el.nom}</td>
                      <td>{el.niveau || '—'}</td>
                      <td>
                        <Bouton sm variante="secondaire" onClick={() => voirBadge(el.id)}>Voir le badge</Bouton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>

        <div>
          {badge ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <CarteBadge badge={badge}
                photoSrc={badge.aPhoto ? `${urlPhotoEleveAdmin(badge.id)}?v=${version}` : null}
                logoSrc={`${urlLogoEcole()}?v=${version}`} />
              <Carte className="no-print" style={{ width: 340 }}>
                <input ref={fichierRef} type="file" accept="image/png,image/jpeg" onChange={envoyerPhoto} hidden />
                <div className="rangee" style={{ gap: '.75rem', flexWrap: 'wrap' }}>
                  <Bouton variante="secondaire" onClick={() => fichierRef.current?.click()} enCours={enCours}>
                    {badge.aPhoto ? 'Changer la photo' : 'Ajouter la photo'}
                  </Bouton>
                  <Bouton onClick={() => window.print()}>Imprimer</Bouton>
                </div>
                <p className="texte-gris" style={{ marginTop: '.6rem', fontSize: '.82rem' }}>Photo JPG ou PNG, max 5 Mo.</p>
              </Carte>
            </div>
          ) : (
            <Carte className="no-print"><p className="texte-gris">Sélectionnez un élève pour afficher son badge.</p></Carte>
          )}
        </div>
      </div>
    </div>
  );
}
