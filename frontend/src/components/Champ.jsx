// Champ de formulaire (label + input + erreur)
export default function Champ({ label, erreur, type = 'text', enfant, ...props }) {
  return (
    <div className="champ">
      {label && <label htmlFor={props.id || props.name}>{label}</label>}
      {enfant || <input type={type} {...props} />}
      {erreur && <span className="erreur-champ">{erreur}</span>}
    </div>
  );
}
