import { Link } from 'react-router-dom';

// Page d'accueil du site public — hero + sections (contenu placeholder à compléter).
export default function Accueil() {
  return (
    <div className="site-accueil">
      <section className="site-hero">
        <div className="site-hero-texte">
          <h1>Bienvenue à Lekòl Konekte</h1>
          <p>
            La plateforme qui rapproche l'école et les familles : inscriptions en ligne,
            notes et bulletins, paiements — simple, sécurisé, accessible.
          </p>
          <div className="site-hero-actions">
            <Link to="/login" className="btn btn-primaire">Connexion</Link>
            <Link to="/register" className="btn btn-secondaire">Créer un compte</Link>
          </div>
        </div>
      </section>

      <section className="site-sections">
        <div className="carte site-bloc">
          <h3>Notre académie</h3>
          <p className="texte-gris">Du préscolaire au secondaire, un accompagnement à chaque étape.</p>
          <Link to="/academie/primaire">Découvrir l'académie →</Link>
        </div>
        <div className="carte site-bloc">
          <h3>Suivi en ligne</h3>
          <p className="texte-gris">Notes, bulletins et paiements accessibles depuis votre espace.</p>
          <Link to="/a-propos">En savoir plus →</Link>
        </div>
        <div className="carte site-bloc">
          <h3>Restons en contact</h3>
          <p className="texte-gris">Une question ? Notre équipe est là pour vous accompagner.</p>
          <Link to="/contact">Nous contacter →</Link>
        </div>
      </section>
    </div>
  );
}
