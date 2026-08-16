import { useState } from 'react';
import PaiementsTab from './economat/PaiementsTab.jsx';
import TarifsTab from './economat/TarifsTab.jsx';
import AcquittementsTab from './economat/AcquittementsTab.jsx';

const ONGLETS = [
  { cle: 'paiements', libelle: 'Paiements' },
  { cle: 'tarifs', libelle: 'Tarifs' },
  { cle: 'acquittements', libelle: 'Acquittements élèves' },
];

export default function Economat() {
  const [onglet, setOnglet] = useState('paiements');

  return (
    <div className="insc-page">
      <div className="page-entete">
        <h1>Économat</h1>
        <p>Paiements, tarifs et acquittements des élèves — tout en un seul endroit.</p>
      </div>

      <div className="eco-onglets" role="tablist">
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
            className={`eco-onglet ${onglet === o.cle ? 'actif' : ''}`}
            onClick={() => setOnglet(o.cle)}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'paiements' && <PaiementsTab />}
      {onglet === 'tarifs' && <TarifsTab />}
      {onglet === 'acquittements' && <AcquittementsTab />}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Konekte. Tous droits réservés.</footer>
    </div>
  );
}
