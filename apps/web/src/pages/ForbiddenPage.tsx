import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <div className="center-state">
      <div className="brand brand-large">
        <span className="brand-mark">T</span> TimeLogic
      </div>
      <h1>Brak dostępu</h1>
      <p>Nie masz uprawnień do tej części aplikacji.</p>
      <Link to="/" className="button button-primary">
        Wróć na pulpit
      </Link>
    </div>
  );
}
