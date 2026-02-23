import { lazy, Suspense, useMemo } from 'react';
import 'react-quill/dist/quill.snow.css';
import styles from './RichTextEditor.module.css';

const ReactQuill = lazy(() => import('react-quill'));

const TOOLBAR_OPTIONS = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
];

const EDITOR_MIN_HEIGHT = 300;

export default function RichTextEditor({ value = '', onChange, placeholder, className, minHeight = EDITOR_MIN_HEIGHT }) {
  const modules = useMemo(
    () => ({
      toolbar: TOOLBAR_OPTIONS,
    }),
    []
  );

  return (
    <div
      className={`${styles.wrapper} ${className || ''}`.trim()}
      style={{ '--editor-min-height': `${minHeight}px` }}
    >
      <Suspense fallback={<div style={{ minHeight: minHeight }} />}>
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          modules={modules}
        />
      </Suspense>
    </div>
  );
}
