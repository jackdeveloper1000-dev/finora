import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors';

export default function useFetch(loader) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await loader();
      if (id === latest.current) setState({ data, loading: false, error: '' });
    } catch (err) {
      if (id === latest.current) setState({ data: null, loading: false, error: getErrorMessage(err) });
    }
  }, [loader]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
