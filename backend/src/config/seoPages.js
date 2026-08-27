// Métadonnées SEO/Open Graph par route publique — utilisées pour injecter un
// <title>/<meta> propre à chaque page dans le HTML servi par Express. Les
// robots des réseaux sociaux (WhatsApp, Facebook…) n'exécutent pas le
// JavaScript React : ces valeurs doivent donc déjà être dans le HTML brut.
// Garder ces textes cohérents avec les hooks useTitrePage() côté frontend.
export const PAGES_SEO = {
  '/': {
    titre: 'Lekòl Konekte',
    description: "Lekòl Konekte — plateforme de gestion scolaire : inscriptions en ligne, notes, bulletins et documents officiels pour les familles, élèves et l'administration.",
  },
  '/a-propos': {
    titre: 'À propos — Lekòl Konekte',
    description: "Découvrez la mission, l'histoire et les valeurs de l'école Lekòl Konekte.",
  },
  '/vlog': {
    titre: 'Vlog — Lekòl Konekte',
    description: 'Actualités, annonces et vie scolaire de Lekòl Konekte.',
  },
  '/professeurs': {
    titre: 'Notre équipe pédagogique — Lekòl Konekte',
    description: 'Découvrez les professeurs et le corps enseignant de Lekòl Konekte.',
  },
  '/academie/prescolaire': {
    titre: 'Préscolaire — Lekòl Konekte',
    description: "L'éveil et les premiers apprentissages, dans un cadre bienveillant.",
  },
  '/academie/primaire': {
    titre: 'Primaire — Lekòl Konekte',
    description: 'Les fondations solides en lecture, écriture et calcul.',
  },
  '/academie/secondaire': {
    titre: 'Secondaire — Lekòl Konekte',
    description: "Préparer les élèves à la réussite et à la suite de leur parcours.",
  },
  '/examens': {
    titre: 'Examens passés — Lekòl Konekte',
    description: "Consultez les feuilles d'examens passés par niveau à Lekòl Konekte.",
  },
  '/contact': {
    titre: 'Contact — Lekòl Konekte',
    description: 'Besoin de nous joindre ? Retrouvez ici nos coordonnées et notre formulaire.',
  },
  '/calendrier': {
    titre: 'Calendrier — Lekòl Konekte',
    description: 'Dates importantes, périodes scolaires et évènements à venir.',
  },
  '/support': {
    titre: 'Support — Lekòl Konekte',
    description: 'Aide, questions fréquentes et assistance pour utiliser la plateforme.',
  },
  '/anciens-eleves': {
    titre: 'Anciens élèves — Lekòl Konekte',
    description: "Anciens élèves de Lekòl Konekte : faites une demande en ligne pour retrouver vos résultats et bulletins.",
  },
};
