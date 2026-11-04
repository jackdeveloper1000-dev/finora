import { useCallback, useRef, useState } from 'react';
import { getErrorMessage } from '../utils/errors';
import { validateFile } from '../utils/files';

// Uploads files one at a time and tracks per-file progress/errors.
export default function useUploadQueue({ upload, onUploaded }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(0);

  const patch = (id, changes) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...changes } : it)));

  const add = useCallback(
    async (files, options) => {
      const entries = files.map((file) => ({ id: nextId.current++, file, name: file.name, progress: 0, error: validateFile(file) }));
      setItems((list) => [...entries, ...list]);

      for (const entry of entries.filter((e) => !e.error)) {
        try {
          await upload(entry.file, options, (progress) => patch(entry.id, { progress }));
          setItems((list) => list.filter((it) => it.id !== entry.id));
          onUploaded?.();
        } catch (err) {
          patch(entry.id, { error: getErrorMessage(err), progress: 0 });
        }
      }
    },
    [upload, onUploaded],
  );

  const dismiss = (id) => setItems((list) => list.filter((it) => it.id !== id));

  return { items, add, dismiss };
}
