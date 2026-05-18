import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface PageLoadingContextValue {
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

const PageLoadingContext = createContext<PageLoadingContextValue>({
  isLoading: false,
  setIsLoading: () => {},
});

function PageLoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <PageLoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {children}
    </PageLoadingContext.Provider>
  );
}

/** Lido pelo TopNavigation para mostrar o spinner ao lado do título. */
function usePageLoading() {
  return useContext(PageLoadingContext).isLoading;
}

/**
 * Chamado pelas páginas para sinalizar carregamento ao nav.
 * Limpa automaticamente no unmount.
 */
function useSetPageLoading(loading: boolean) {
  const { setIsLoading } = useContext(PageLoadingContext);
  useEffect(() => {
    setIsLoading(loading);
    return () => setIsLoading(false);
  }, [loading, setIsLoading]);
}

export { PageLoadingProvider, usePageLoading, useSetPageLoading };
