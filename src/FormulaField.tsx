import {useRef} from 'react';
import type {MathfieldElement} from 'mathlive';
import {MathEditor} from './Math';
export function FormulaField({value,onChange,label='数学公式输入',onSubmit=()=>{},onFocus,fieldRef,className=''}:{value:string;onChange:(value:string)=>void;label?:string;onSubmit?:()=>void;onFocus?:(field:MathfieldElement)=>void;fieldRef?:React.MutableRefObject<MathfieldElement|null>;className?:string}){
  const local=useRef<MathfieldElement|null>(null);
  return <div className={`formula-field ${className}`}><MathEditor value={value} onChange={onChange} onSubmit={onSubmit} editorRef={fieldRef||local} label={label} onFocus={onFocus}/></div>;
}
