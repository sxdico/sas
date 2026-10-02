import { useState, useEffect, useCallback } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetch data from an API call with fallback to mock data.
 * The fetcher is a function that returns a Promise<T>.
 * The fallback is used when the API call fails.
 */
export function useApiData<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  deps: unknown[] = []
): ApiState<T> & { setData: React.Dispatch<React.SetStateAction<T | null>> } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchFlag, setRefetchFlag] = useState(0);

  const refetch = useCallback(() => setRefetchFlag((f) => f + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[useApiData] API falló, usando fallback:', err.message);
          setData(fallback);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchFlag, ...deps]);

  return { data, loading, error, refetch, setData };
}
