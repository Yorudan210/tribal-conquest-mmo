import { createContext, useCallback, useContext, useRef, useState } from "react";

// Remplace le toast() de l'ancien index.html (qui créait/retirait un <div> à la main dans #toasts) :
// ici une simple liste d'état React, chaque toast se retire tout seul après le même délai (4.5s).
const ToastCtx = createContext(null);

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const toast = useCallback((msg) => {
    if(!msg) return;
    const id = nextId.current++;
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id!==id)), 4500);
  }, []);

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div id="toasts">
        {toasts.map(t => <div className="toast" key={t.id}>{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(){
  const ctx = useContext(ToastCtx);
  if(!ctx) throw new Error("useToast doit être utilisé sous <ToastProvider>");
  return ctx;
}
