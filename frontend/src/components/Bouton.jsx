// Bouton réutilisable
export default function Bouton({ variante = 'primaire', bloc, sm, enCours, children, ...props }) {
  const classes = [
    'btn',
    `btn-${variante}`,
    bloc ? 'btn-bloc' : '',
    sm ? 'btn-sm' : '',
  ].filter(Boolean).join(' ');

  return (
    <button className={classes} disabled={enCours || props.disabled} {...props}>
      {enCours && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
      {children}
    </button>
  );
}
