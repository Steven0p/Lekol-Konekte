import { useEffect, useState } from 'react';
import { directionApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const LIBELLE_ROLE = { parent: 'Parents', eleve: 'Élèves', admin: 'Secrétariat', direction: 'Direction' };
const LIBELLE_INSCRIPTION = {
  en_attente: 'En attente', complement_demande: 'Complément demandé',
  accepte: 'Accepté', refuse: 'Refusé', confirmee: 'Confirmé',
};
const LIBELLE_PAIEMENT = { en_attente: 'En attente', valide: 'Validé', rejete: 'Rejeté' };

// « 202631 » (format YEARWEEK MySQL, mode 3) -> « Semaine 31 · 2026 »
function libelleSemaine(yearweek) {
  const s = String(yearweek);
  return `Semaine ${s.slice(4)} · ${s.slice(0, 4)}`;
}

function Pastille({ ok, texte }) {
  return <span className={`tdb-badge ${ok ? 'tdb-badge-vert' : 'tdb-badge-rouge'}`}>{texte}</span>;
}

function BarreEvolution({ donnees }) {
  const max = Math.max(1, ...donnees.map((d) => d.n));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {donnees.map((d) => (
        <div key={d.semaine} style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <span style={{ width: 130, fontSize: '.82rem', color: 'var(--s-txt2)' }}>{libelleSemaine(d.semaine)}</span>
          <div style={{ flex: 1, background: 'rgba(26,54,93,.08)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              width: `${(d.n / max) * 100}%`, background: 'var(--s-navy)',
              height: 10, borderRadius: 6, minWidth: d.n ? 6 : 0,
            }} />
          </div>
          <strong style={{ width: 24, textAlign: 'right', fontSize: '.85rem' }}>{d.n}</strong>
        </div>
      ))}
      {donnees.length === 0 && <p className="texte-gris" style={{ fontSize: '.85rem' }}>Aucune donnée sur cette période.</p>}
    </div>
  );
}

export default function Statistiques() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    directionApi.statistiques().then(setD).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!d) return <Chargement />;

  const { compteurs, croissance, sante } = d;
  const parRole = Object.fromEntries(compteurs.parRole.map((r) => [r.role, r.n]));
  const parInscription = Object.fromEntries(compteurs.parInscriptionStatut.map((r) => [r.statut, r.n]));
  const parPaiement = Object.fromEntries(compteurs.parPaiementStatut.map((r) => [r.statut, r.n]));

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-entete">
        <h1>Statistiques & santé du site</h1>
        <p>Vue d'ensemble technique et évolution de l'utilisation de la plateforme.</p>
      </div>

      <Carte titre="Santé du serveur">
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Pastille ok={sante.courrielConfigure} texte={sante.courrielConfigure ? 'Courriel actif' : 'Courriel inactif'} />
          <Pastille ok={sante.iaConfiguree} texte={sante.iaConfiguree ? 'Assistant IA actif' : 'Assistant IA inactif'} />
        </div>
        <p className="texte-gris" style={{ fontSize: '.85rem' }}>
          Serveur démarré le {dateHeureFr(sante.demarreLe)} (redémarre à chaque mise à jour du site).
        </p>

        <h4 style={{ margin: '1rem 0 .5rem', fontSize: '.9rem' }}>Dernières erreurs</h4>
        {sante.dernieresErreurs.length === 0 ? (
          <p className="texte-gris" style={{ fontSize: '.85rem' }}>Aucune erreur depuis le dernier démarrage.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.82rem' }}>
            {sante.dernieresErreurs.map((e, i) => (
              <li key={i}><span className="texte-gris">{dateHeureFr(e.date)}</span> — {e.message}</li>
            ))}
          </ul>
        )}
      </Carte>

      <div className="rangee" style={{ gap: '1rem', alignItems: 'stretch', flexWrap: 'wrap', marginTop: '1rem' }}>
        <Carte titre="Comptes" style={{ flex: '1 1 260px' }}>
          <p style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 .5rem' }}>{compteurs.totalUtilisateurs}</p>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.85rem' }}>
            {Object.entries(LIBELLE_ROLE).map(([role, libelle]) => (
              <li key={role}>{libelle} : {parRole[role] || 0}</li>
            ))}
          </ul>
        </Carte>

        <Carte titre="Dossiers d'inscription" style={{ flex: '1 1 260px' }}>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.85rem' }}>
            {Object.entries(LIBELLE_INSCRIPTION).map(([statut, libelle]) => (
              <li key={statut}>{libelle} : {parInscription[statut] || 0}</li>
            ))}
          </ul>
        </Carte>

        <Carte titre="Paiements" style={{ flex: '1 1 260px' }}>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.85rem' }}>
            {Object.entries(LIBELLE_PAIEMENT).map(([statut, libelle]) => (
              <li key={statut}>{libelle} : {parPaiement[statut] || 0}</li>
            ))}
          </ul>
        </Carte>
      </div>

      <div className="rangee" style={{ gap: '1rem', alignItems: 'stretch', flexWrap: 'wrap', marginTop: '1rem' }}>
        <Carte titre="Nouveaux comptes par semaine" style={{ flex: '1 1 400px' }}>
          <BarreEvolution donnees={croissance.comptes} />
        </Carte>
        <Carte titre="Nouvelles inscriptions par semaine" style={{ flex: '1 1 400px' }}>
          <BarreEvolution donnees={croissance.inscriptions} />
        </Carte>
      </div>
    </div>
  );
}
