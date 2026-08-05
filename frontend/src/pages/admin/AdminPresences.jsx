import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { adminApi, urlPhotoEleveAdmin } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Alerte from '../../components/Alerte.jsx';

// Extrait le code d'accès depuis le contenu scanné : le QR du badge encode
// une URL complète (/eleve?code=XXXX) — on retombe sur le texte brut si ce
// n'est pas une URL valide (badge abîmé, code tapé à la main un jour).
function extraireCode(texte) {
  try {
    const u = new URL(texte);
    const code = u.searchParams.get('code');
    if (code) return code;
  } catch { /* pas une URL — on utilise le texte tel quel */ }
  return texte.trim();
}

const COOLDOWN_MS = 4000; // évite de re-soumettre le même badge pendant qu'il reste dans le cadre

export default function AdminPresences() {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const flux = useRef(null);
  const dernierCode = useRef(null);
  const dernierScanLe = useRef(0);
  const enTraitement = useRef(false);

  const [camActive, setCamActive] = useState(false);
  const [erreurCam, setErreurCam] = useState('');
  const [resultat, setResultat] = useState(null); // { eleve, dejaMarque, heure } ou { erreur }
  const [liste, setListe] = useState([]);

  const chargerListe = useCallback(() => {
    adminApi.presencesDuJour().then((d) => setListe(d.presences)).catch(() => {});
  }, []);
  useEffect(() => { chargerListe(); }, [chargerListe]);

  const traiterCode = useCallback(async (texteScanne) => {
    const code = extraireCode(texteScanne);
    const maintenant = Date.now();
    if (code === dernierCode.current && maintenant - dernierScanLe.current < COOLDOWN_MS) return;
    if (enTraitement.current) return;
    dernierCode.current = code;
    dernierScanLe.current = maintenant;
    enTraitement.current = true;
    try {
      const d = await adminApi.scannerPresence(code);
      setResultat({ ...d, erreur: null });
      chargerListe();
    } catch (e) {
      setResultat({ erreur: e.message });
    } finally {
      enTraitement.current = false;
    }
  }, [chargerListe]);

  const boucleScan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height);
      if (code?.data) traiterCode(code.data);
    }
    if (flux.current) requestAnimationFrame(boucleScan);
  }, [traiterCode]);

  const demarrerCamera = async () => {
    setErreurCam('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      flux.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamActive(true);
      requestAnimationFrame(boucleScan);
    } catch (e) {
      setErreurCam("Impossible d'accéder à la caméra : " + e.message);
    }
  };

  const arreterCamera = () => {
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    setCamActive(false);
  };

  useEffect(() => () => arreterCamera(), []);

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="page-entete">
        <h1>Présence quotidienne</h1>
        <p>Scannez le QR au dos du badge de chaque élève pour confirmer sa présence — le parent est notifié par courriel automatiquement.</p>
      </div>

      <div className="rangee" style={{ gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Carte style={{ flex: '1 1 340px' }}>
          {erreurCam && <Alerte type="erreur">{erreurCam}</Alerte>}
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '4/3', background: '#111',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <video ref={videoRef} muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: camActive ? 'block' : 'none' }} />
            {!camActive && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <button type="button" className="btn btn-primaire" onClick={demarrerCamera}>Activer la caméra</button>
              </div>
            )}
          </div>
          {camActive && (
            <div style={{ marginTop: '.75rem' }}>
              <button type="button" className="btn btn-secondaire" onClick={arreterCamera}>Arrêter la caméra</button>
            </div>
          )}

          {resultat && (
            <div style={{ marginTop: '1rem' }}>
              {resultat.erreur ? (
                <Alerte type="erreur">{resultat.erreur}</Alerte>
              ) : (
                <div className="rangee" style={{ gap: '.9rem', padding: '.75rem', border: '1px solid var(--gris-bordure)', borderRadius: 10 }}>
                  <img src={urlPhotoEleveAdmin(resultat.eleve.id)} alt=""
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', background: 'var(--gris-clair)' }}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{resultat.eleve.nom}</p>
                    <p className="texte-gris" style={{ margin: '.15rem 0 0', fontSize: '.85rem' }}>
                      {resultat.eleve.niveau} — arrivé(e) à {resultat.heure}
                    </p>
                    {resultat.dejaMarque && (
                      <p style={{ margin: '.3rem 0 0', fontSize: '.8rem', color: 'var(--gris)' }}>
                        Déjà pointé(e) aujourd'hui — parent non re-notifié.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Carte>

        <Carte titre={`Présences aujourd'hui (${liste.length})`} style={{ flex: '1 1 300px' }}>
          {liste.length === 0 ? (
            <p className="texte-gris">Aucun élève pointé pour l'instant.</p>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau">
                <thead><tr><th>Élève</th><th>Classe</th><th>Heure</th></tr></thead>
                <tbody>
                  {liste.map((p) => (
                    <tr key={p.id}>
                      <td>{[p.prenom, p.nom].filter(Boolean).join(' ')}</td>
                      <td>{p.niveau || '—'}</td>
                      <td>{new Date(p.heure_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Port-au-Prince' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Carte>
      </div>
    </div>
  );
}
