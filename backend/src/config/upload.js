// Configuration multer — téléversement de documents sur le disque local
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/uploads/inscriptions
export const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const DEST = path.join(UPLOAD_ROOT, 'inscriptions');

const TYPES_AUTORISES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const DEST_PREUVES = path.join(UPLOAD_ROOT, 'preuves');
const DEST_PHOTOS = path.join(UPLOAD_ROOT, 'photos');   // photos élèves (badge)
const DEST_LOGOS = path.join(UPLOAD_ROOT, 'logos');     // logo de l'école
const DEST_VLOG = path.join(UPLOAD_ROOT, 'vlog');       // photos des publications du vlog

// Crée les sous-dossiers si absents (conteneur / volume vierge en production)
for (const dossier of [DEST, DEST_PREUVES, DEST_PHOTOS, DEST_LOGOS, DEST_VLOG]) {
  fs.mkdirSync(dossier, { recursive: true });
}

const TYPES_IMAGE = { 'image/jpeg': '.jpg', 'image/png': '.png' };

function fileFilter(req, file, cb) {
  if (TYPES_AUTORISES[file.mimetype]) return cb(null, true);
  cb(new Error('TYPE_NON_AUTORISE'));
}

function imageFilter(req, file, cb) {
  if (TYPES_IMAGE[file.mimetype]) return cb(null, true);
  cb(new Error('TYPE_NON_AUTORISE'));
}

// Fabrique un middleware multer stockant dans un sous-dossier donné
function creerUpload(dossier, filtre = fileFilter, typesExt = TYPES_AUTORISES) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dossier),
    filename: (req, file, cb) => {
      // Nom généré aléatoirement — jamais le nom fourni par l'utilisateur (anti-traversal)
      const ext = typesExt[file.mimetype] || '';
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  });
  return multer({ storage, fileFilter: filtre, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 Mo
}

export const uploadDocument = creerUpload(DEST);         // documents d'inscription
export const uploadPreuve = creerUpload(DEST_PREUVES);   // preuves de paiement
export const uploadPhoto = creerUpload(DEST_PHOTOS, imageFilter, TYPES_IMAGE);  // photo élève
export const uploadLogo = creerUpload(DEST_LOGOS, imageFilter, TYPES_IMAGE);    // logo école
export const uploadVlog = creerUpload(DEST_VLOG, imageFilter, TYPES_IMAGE);     // photo publication vlog
