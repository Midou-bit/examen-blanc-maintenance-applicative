import React from "react";
import { Link } from "react-router-dom";
import "./Header.css";

const Header = ({ isAuthenticated, onLogout }) => {
  return (
    <header className="header">
      <nav>
        <ul className="nav-list">
          <li className="nav-item">
            <Link to="/tasks" className="nav-link">
              Mes Tâches
            </Link>
          </li>
          {!isAuthenticated ? (
            <li className="nav-item">
              <Link to="/login" className="nav-link">
                Connexion
              </Link>
            </li>
          ) : (
            <li className="nav-item">
              <button onClick={onLogout} className="nav-link">
                Déconnexion
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
};

export default Header;
