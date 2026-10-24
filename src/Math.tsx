import { useEffect, useMemo, useRef } from 'react';
import { convertLatexToMarkup, MathfieldElement } from 'mathlive';
import 'mathlive/static.css';
import 'mathlive/fonts.css';

MathfieldElement.fontsDirectory = '/fonts';
MathfieldElement.soundsDirectory = null;
MathfieldElement.computeEngine = null;

export function MathView({ latex, className = '' }: { latex: string; className?: string }) {
  const markup = useMemo(() => {
    // Imported notebooks are data, never a source of HTML links or styling commands.
    const safe = latex.replace(/\\(?:href|url|html\w*|includegraphics|style)\b/g, '\\operatorname');
    try { return convertLatexToMarkup(safe, { letterShapeStyle: 'tex' }); } catch { return ''; }
  }, [latex]);
  return <span className={`math-view ${className}`} role="math" aria-label={latex} dangerouslySetInnerHTML={{ __html: markup }} />;
}

export function MathEditor({ value, onChange, onSubmit, editorRef, label='数学公式输入',onFocus }: {
  value: string; onChange: (value: string) => void; onSubmit: () => void;
  editorRef: React.MutableRefObject<MathfieldElement | null>;
  label?:string;onFocus?:(field:MathfieldElement)=>void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const changeRef = useRef(onChange); changeRef.current = onChange;
  const submitRef = useRef(onSubmit); submitRef.current = onSubmit;
  useEffect(() => {
    const field = new MathfieldElement();
    field.mathVirtualKeyboardPolicy = 'manual';
    field.smartFence = true;
    field.setAttribute('aria-label', label);
    field.setAttribute('placeholder', '输入数学表达式');
    field.value = value;
    field.addEventListener('input', () => changeRef.current(field.value));
    field.addEventListener('focusin',()=>onFocus?.(field));
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitRef.current(); }
    });
    container.current!.append(field); editorRef.current = field;
    return () => { field.remove(); editorRef.current = null; };
  }, []);
  useEffect(() => { if (editorRef.current && editorRef.current.value !== value) editorRef.current.value = value; }, [value, editorRef]);
  return <div className="math-editor" ref={container} />;
}
