import {parseLatex} from './parser';
import type {CalculateRequest,Definition,Parameters} from './types';
const pending=new Map<string,AbortController>();
const mathParams=new Set(['point','lower','upper','modulus','initial_point','initial_value','initial_slope']);
function compileParams(params:Parameters={}) {return Object.fromEntries(Object.entries(params).filter(([k,v])=>!k.startsWith('initial_')||String(v).trim()).map(([k,v])=>[k,mathParams.has(k)?parseLatex(String(v)):v]));}
function compileDefinitions(definitions:Definition[]=[]) {return definitions.map(d=>({name:d.name,ast:parseLatex(d.latex),arguments:d.arguments}));}
export function cancelCalculation(){
  for(const [id,controller]of pending){controller.abort();void fetch('/api/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),keepalive:true});}
  pending.clear();
}
export async function apiRequest<T>(action:string,payload:Record<string,unknown>):Promise<T>{
  const id=crypto.randomUUID();const controller=new AbortController();pending.set(id,controller);
  const timer=setTimeout(()=>{controller.abort();void fetch('/api/cancel',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),keepalive:true});},35000);
  try{
    const response=await fetch(`/api/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,id}),signal:controller.signal});
    const data=await response.json();if(!response.ok||data.error)throw new Error(data.error||`计算服务返回 ${response.status}`);return data.result as T;
  }catch(e){if(e instanceof DOMException&&e.name==='AbortError')throw new Error('计算已取消或超过时间限制。');throw e;}
  finally{clearTimeout(timer);pending.delete(id);}
}
export async function runEngine<T>(type:'calculate'|'plot',payload:unknown):Promise<T>{
  if(type==='calculate'){
    const req=payload as CalculateRequest;
    return apiRequest<T>('calculate',{operation:req.operation,variable:req.variable,ast:parseLatex(req.latex),params:compileParams(req.params),secondary:req.secondary?.trim()?parseLatex(req.secondary):undefined,definitions:compileDefinitions(req.definitions),steps:req.steps});
  }
  const req=payload as {latex:string;variable:string;min:number;max:number};
  const result=await apiRequest<{curves:[number,number|null][][]}>('plot',{asts:[parseLatex(req.latex)],variable:req.variable,xRange:[req.min,req.max],kind:'cartesian'});
  return {points:result.curves[0],variable:req.variable,latex:req.latex,min:req.min,max:req.max} as T;
}
export async function requestGraph<T>(request:{expressions:string[];definitions?:Definition[];params?:Parameters;[key:string]:unknown}):Promise<T>{
  const {expressions,definitions,params,...rest}=request;
  return apiRequest<T>('plot',{...rest,asts:expressions.map(parseLatex),definitions:compileDefinitions(definitions),params:compileParams(params)});
}
export {parseLatex};
