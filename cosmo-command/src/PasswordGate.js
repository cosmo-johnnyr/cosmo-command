import React, { useState, useEffect } from 'react';
import './PasswordGate.css';

const CORRECT_PASSWORD = 'cosmocommand1';
const AUTH_KEY = 'cosmo_command_auth';

function PasswordGate({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated
    const auth = localStorage.getItem(AUTH_KEY);
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      localStorage.setItem(AUTH_KEY, 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid access code');
      setPassword('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setPassword('');
  };

  if (isLoading) {
    return (
      <div className="password-gate loading">
        <div className="loader"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="password-gate">
        <div className="password-container">
          <div className="logo-section">
            <div className="logo-icon">◈</div>
            <h1 className="logo-title">COSMO COMMAND</h1>
            <p className="logo-subtitle">Secure Access Terminal</p>
          </div>
          
          <form onSubmit={handleSubmit} className="password-form">
            <div className="input-group">
              <label htmlFor="password">Access Code</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter code..."
                autoFocus
                autoComplete="off"
              />
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <button type="submit" className="submit-btn">
              AUTHENTICATE
            </button>
          </form>
          
          <div className="security-notice">
            <span className="lock-icon">🔒</span>
            <span>Session will be remembered on this device</span>
          </div>
        </div>
        
        <div className="grid-background"></div>
      </div>
    );
  }

  return (
    <>
      {children}
      <button className="logout-btn" onClick={handleLogout} title="Logout">
        ⧉
      </button>
    </>
  );
}

export default PasswordGate;