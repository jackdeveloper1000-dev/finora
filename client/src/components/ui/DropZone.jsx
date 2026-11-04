import { UploadCloud } from 'lucide-react';
import { useId, useState } from 'react';

export default function DropZone({ onFiles, accept, multiple = true, disabled, title, hint }) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const handle = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length && !disabled) onFiles(multiple ? files : files.slice(0, 1));
  };

  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <label
      htmlFor={inputId}
      className={`dropzone${dragging ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}`}
      onDragEnter={(e) => { stop(e); setDragging(true); }}
      onDragOver={stop}
      onDragLeave={(e) => { stop(e); setDragging(false); }}
      onDrop={(e) => { stop(e); setDragging(false); handle(e.dataTransfer.files); }}
    >
      <span className="dropzone__icon"><UploadCloud size={26} /></span>
      <span className="dropzone__title">{title}</span>
      {hint && <span className="dropzone__hint">{hint}</span>}
      <input
        id={inputId}
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
    </label>
  );
}
