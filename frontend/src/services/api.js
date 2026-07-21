// Client API — envoie toujours le cookie de session (credentials: 'include')
// En dev : backend séparé (localhost:4000). En prod : même origine → chemin relatif '/api'.
const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api');

async function request(chemin, options = {}) {
  const estFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${chemin}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(estFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  let data = null;
  try { data = await res.json(); } catch { /* pas de corps JSON */ }

  if (!res.ok) {
    const err = new Error((data && data.erreur) || 'Une erreur est survenue.');
    err.status = res.status;
    err.payload = data || {};
    throw err;
  }
  return data;
}

const json = (body) => JSON.stringify(body);

export const authApi = {
  register: (payload) => request('/auth/register', { method: 'POST', body: json(payload) }),
  verifierCourriel: (payload) => request('/auth/verifier-courriel', { method: 'POST', body: json(payload) }),
  renvoyerCode: (courriel) => request('/auth/renvoyer-code', { method: 'POST', body: json({ courriel }) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: json(payload) }),
  eleveConnexion: (code) => request('/auth/eleve-connexion', { method: 'POST', body: json({ code }) }),
  motDePasseOublie: (courriel) => request('/auth/mot-de-passe-oublie', { method: 'POST', body: json({ courriel }) }),
  reinitialiserMotDePasse: (payload) => request('/auth/reinitialiser-mot-de-passe', { method: 'POST', body: json(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
};

export const inscriptionsApi = {
  lister: () => request('/inscriptions'),
  creer: (payload) => request('/inscriptions', { method: 'POST', body: json(payload) }),
  detail: (id) => request(`/inscriptions/${id}`),
  listerDocuments: (id) => request(`/inscriptions/${id}/documents`),
  televerserDocument: (id, type, fichier) => {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('fichier', fichier);
    return request(`/inscriptions/${id}/documents`, { method: 'POST', body: fd });
  },
};

export const notesApi = {
  mesEleves: () => request('/mes-eleves'),
  notesEleve: (idEleve) => request(`/eleves/${idEleve}/notes`),
  bulletinsEleve: (idEleve) => request(`/eleves/${idEleve}/bulletins`),
  documentsOfficielsEleve: (idEleve) => request(`/eleves/${idEleve}/documents-officiels`),
  genererCodeEleve: (idEleve) => request(`/eleves/${idEleve}/code-acces`, { method: 'POST' }),
};

// Espace élève (connexion par code) — lecture seule
export const eleveApi = {
  mesNotes: () => request('/eleve/mes-notes'),
  mesBulletins: () => request('/eleve/mes-bulletins'),
  appreciationIA: (body) => request('/eleve/appreciation-ia', { method: 'POST', body: json(body) }),
  badge: () => request('/eleve/badge'),
  televerserPhoto: (fichier) => {
    const fd = new FormData();
    fd.append('photo', fichier);
    return request('/eleve/photo', { method: 'POST', body: fd });
  },
};

export const paiementsApi = {
  tarifs: () => request('/tarifs'),
  coordonnees: () => request('/ecole/coordonnees'),
  lister: () => request('/paiements'),
  detail: (id) => request(`/paiements/${id}`),
  creer: (payload) => request('/paiements', { method: 'POST', body: json(payload) }),
  televerserPreuve: (id, fichier) => {
    const fd = new FormData();
    fd.append('preuve', fichier);
    return request(`/paiements/${id}/preuve`, { method: 'POST', body: fd });
  },
};

const qs = (params = {}) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null);
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
};

export const adminApi = {
  // Inscriptions
  inscriptions: (params) => request(`/admin/inscriptions${qs(params)}`),
  changerStatutInscription: (id, body) => request(`/inscriptions/${id}/statut`, { method: 'PATCH', body: json(body) }),
  messageParentIA: (id, body) => request(`/inscriptions/${id}/message-ia`, { method: 'POST', body: json(body) }),
  // Notes
  eleves: (niveau) => request(`/admin/eleves${qs({ niveau })}`),
  matieres: (niveau) => request(`/matieres${qs({ niveau })}`),
  notes: (params) => request(`/admin/notes${qs(params)}`),
  creerNote: (body) => request('/notes', { method: 'POST', body: json(body) }),
  majNote: (id, body) => request(`/notes/${id}`, { method: 'PATCH', body: json(body) }),
  supprimerNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  validerNote: (id) => request(`/notes/${id}/valider`, { method: 'PATCH' }),
  // Paiements
  paiements: (statut) => request(`/admin/paiements${qs({ statut })}`),
  validationPaiement: (id, body) => request(`/paiements/${id}/validation`, { method: 'PATCH', body: json(body) }),
  // Économat — acquittement de scolarité par trimestre
  acquittements: (params) => request(`/admin/acquittements${qs(params)}`),
  marquerAcquittement: (body) => request('/admin/acquittements', { method: 'POST', body: json(body) }),
  retirerAcquittement: (body) => request('/admin/acquittements', { method: 'DELETE', body: json(body) }),
  // Codes d'accès élèves (secrétariat)
  elevesCodes: (recherche) => request(`/admin/eleves-codes${qs({ recherche })}`),
  genererCodeEleve: (id) => request(`/admin/eleves/${id}/code-acces`, { method: 'POST' }),
  // Badges élèves (secrétariat)
  badgeEleve: (id) => request(`/admin/eleves/${id}/badge`),
  televerserPhotoEleve: (id, fichier) => {
    const fd = new FormData();
    fd.append('photo', fichier);
    return request(`/admin/eleves/${id}/photo`, { method: 'POST', body: fd });
  },
};

export const directionApi = {
  matieres: (niveau) => request(`/matieres${qs({ niveau })}`),
  creerMatiere: (body) => request('/matieres', { method: 'POST', body: json(body) }),
  majMatiere: (id, body) => request(`/matieres/${id}`, { method: 'PATCH', body: json(body) }),
  supprimerMatiere: (id) => request(`/matieres/${id}`, { method: 'DELETE' }),
  publications: () => request('/publications'),
  publier: (body) => request('/publications', { method: 'POST', body: json(body) }),
  bulletinsNiveau: (niveau) => request(`/admin/bulletins${qs({ niveau })}`),
  tarifs: () => request('/tarifs'),
  creerTarif: (body) => request('/tarifs', { method: 'POST', body: json(body) }),
  majTarif: (id, body) => request(`/tarifs/${id}`, { method: 'PUT', body: json(body) }),
  fraisDivers: () => request('/frais-divers'),
  creerFrais: (body) => request('/frais-divers', { method: 'POST', body: json(body) }),
  majFrais: (id, body) => request(`/frais-divers/${id}`, { method: 'PUT', body: json(body) }),
  supprimerFrais: (id) => request(`/frais-divers/${id}`, { method: 'DELETE' }),
  ecole: () => request('/ecole/coordonnees'),
  majEcole: (body) => request('/ecole', { method: 'PUT', body: json(body) }),
  televerserLogo: (fichier) => {
    const fd = new FormData();
    fd.append('logo', fichier);
    return request('/ecole/logo', { method: 'POST', body: fd });
  },
};

// Vlog — système indépendant (propre authentification)
export const vlogApi = {
  publications: () => request('/vlog'),
  adminMe: () => request('/vlog/admin/me'),
  adminLogin: (body) => request('/vlog/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/vlog/admin/logout', { method: 'POST' }),
  creer: ({ titre, contenu, categorie, photo }) => {
    const fd = new FormData();
    fd.append('titre', titre);
    fd.append('contenu', contenu);
    fd.append('categorie', categorie);
    if (photo) fd.append('photo', photo);
    return request('/vlog', { method: 'POST', body: fd });
  },
  supprimer: (id) => request(`/vlog/${id}`, { method: 'DELETE' }),
  redactionIA: (body) => request('/vlog/redaction-ia', { method: 'POST', body: json(body) }),
};

// Corps enseignant — système indépendant (propre authentification)
function formDataProf({ nom, prenom, matiere, fonction, diplomes, experienceAnnees, parcours, photo }) {
  const fd = new FormData();
  const ajouter = (cle, val) => { if (val !== undefined && val !== null) fd.append(cle, val); };
  ajouter('nom', nom);
  ajouter('prenom', prenom);
  ajouter('matiere', matiere);
  ajouter('fonction', fonction);
  ajouter('diplomes', diplomes);
  ajouter('experienceAnnees', experienceAnnees);
  ajouter('parcours', parcours);
  if (photo) fd.append('photo', photo);
  return fd;
}

export const profsApi = {
  liste: () => request('/professeurs'),
  adminMe: () => request('/professeurs/admin/me'),
  adminLogin: (body) => request('/professeurs/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/professeurs/admin/logout', { method: 'POST' }),
  creer: (data) => request('/professeurs', { method: 'POST', body: formDataProf(data) }),
  modifier: (id, data) => request(`/professeurs/${id}`, { method: 'PUT', body: formDataProf(data) }),
  supprimer: (id) => request(`/professeurs/${id}`, { method: 'DELETE' }),
};

// URLs directes de fichiers (téléchargement via navigation — le cookie de session est envoyé)
export const urlDocumentSoumis = (id) => `${API_URL}/documents-soumis/${id}/fichier`;
export const urlDocumentOfficiel = (id) => `${API_URL}/documents-officiels/${id}/fichier`;
export const urlPreuvePaiement = (id) => `${API_URL}/paiements/${id}/preuve`;
export const urlPhotoEleve = () => `${API_URL}/eleve/photo`;
export const urlPhotoEleveAdmin = (id) => `${API_URL}/admin/eleves/${id}/photo`;
export const urlLogoEcole = () => `${API_URL}/ecole/logo`;
export const urlPhotoVlog = (id) => `${API_URL}/vlog/${id}/photo`;
export const urlPhotoProf = (id) => `${API_URL}/professeurs/${id}/photo`;

export { request, API_URL };
