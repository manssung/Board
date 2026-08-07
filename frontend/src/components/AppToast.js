import React, { useEffect, useState } from 'react';
import '../css/AppToast.css';

let pendingToast = null;
let pendingAlert = null;

export const showToast = (message, type = 'info') => {
  pendingToast = { message, type };
  window.dispatchEvent(new CustomEvent('strategy-qna-toast', { detail: pendingToast }));
};

export const showAppAlert = (title, message) => {
  pendingAlert = { title, message };
  window.dispatchEvent(new CustomEvent('strategy-qna-alert', { detail: pendingAlert }));
};

export default function AppToast() {
  const [toast, setToast] = useState(null);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    let timer;
    const handleToast = (event) => {
      clearTimeout(timer);
      setToast(event.detail);
      pendingToast = null;
      timer = setTimeout(() => setToast(null), 3600);
    };
    window.addEventListener('strategy-qna-toast', handleToast);
    const handleAlert = (event) => {
      pendingAlert = null;
      setAlert(event.detail);
    };
    window.addEventListener('strategy-qna-alert', handleAlert);
    if (pendingToast) handleToast({ detail: pendingToast });
    if (pendingAlert) handleAlert({ detail: pendingAlert });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('strategy-qna-toast', handleToast);
      window.removeEventListener('strategy-qna-alert', handleAlert);
    };
  }, []);

  return (
    <>
      {toast && <div className={`app-toast ${toast.type}`} role="status" aria-live="polite">{toast.message}</div>}
      {alert && (
        <div className="app-alert-backdrop" role="presentation">
          <section className="app-alert-dialog" role="alertdialog" aria-modal="true" aria-labelledby="app-alert-title">
            <span className="app-alert-icon">!</span>
            <h3 id="app-alert-title">{alert.title}</h3>
            <p>{alert.message}</p>
            <button type="button" onClick={() => setAlert(null)}>확인</button>
          </section>
        </div>
      )}
    </>
  );
}
