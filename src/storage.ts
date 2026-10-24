import { operations, type Entry, type Workbook } from './types';
const KEY = 'moyu.workbooks.v1';
export const newWorkbook = (): Workbook => ({ id: crypto.randomUUID(), title: '未命名工作表', entries: [], draft: '', updated: Date.now() });

export function validateWorkbook(input: unknown): Workbook {
  if (!input || typeof input !== 'object') throw new Error('不是有效的 SyMath 工作表。');
  const data = input as Record<string, unknown>;
  if (typeof data.title !== 'string' || data.title.length > 100 || !Array.isArray(data.entries) || data.entries.length > 1000) throw new Error('工作表格式不正确，或超过 1000 条计算记录。');
  const entries: Entry[] = data.entries.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('计算记录格式不正确。');
    const e = row as Record<string, unknown>;
    if (typeof e.latex !== 'string' || e.latex.length > 160000 || typeof e.inputLatex !== 'string' || e.inputLatex.length > 15000 || typeof e.plain !== 'string' || e.plain.length > 160000 || !(operations.some((op) => op.id === e.operation)||e.operation==='pipeline') || typeof e.variable !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(e.variable) || e.variable.includes('__')) throw new Error('计算记录含有不受支持的数据。');
    return { id: crypto.randomUUID(), latex: e.latex, inputLatex: e.inputLatex, plain: e.plain, operation: e.operation, variable: e.variable, params:validateParams(e.params),secondary:typeof e.secondary==='string'?e.secondary.slice(0,15000):undefined,approximate:!!e.approximate,stale:!!e.stale,steps:Array.isArray(e.steps)?e.steps.slice(0,20).map((v:unknown)=>{if(!v||typeof v!=='object')throw new Error('流水线结果格式错误。');const q=v as Record<string,unknown>;if(typeof q.latex!=='string'||q.latex.length>160000||typeof q.plain!=='string'||q.plain.length>160000||typeof q.operation!=='string')throw new Error('流水线结果格式错误。');return{latex:q.latex,plain:q.plain,operation:q.operation,elapsed:Number(q.elapsed)||0};}):undefined,variables:Array.isArray(e.variables)?e.variables.filter(v=>typeof v==='string').slice(0,100):undefined,created: Number(e.created) || Date.now(), elapsed: Number(e.elapsed) || 0, note: typeof e.note === 'string' ? e.note.slice(0,5000) : '' } as Entry;
  });
  const definitions=Array.isArray(data.definitions)?data.definitions.slice(0,100).map((value:unknown)=>{if(!value||typeof value!=='object')throw new Error('定义格式错误。');const d=value as Record<string,unknown>;if(typeof d.name!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(d.name)||d.name.includes('__')||typeof d.latex!=='string'||d.latex.length>15000)throw new Error('定义格式错误。');const args=Array.isArray(d.arguments)?d.arguments:undefined;if(args&&(args.length>8||args.some(v=>typeof v!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(v)||v.includes('__'))))throw new Error('函数参数格式错误。');return{id:crypto.randomUUID(),name:d.name,latex:d.latex,arguments:args};}):undefined;
  const sheet=Array.isArray(data.sheet)?data.sheet:undefined;
  if(sheet&&(sheet.length>500||sheet.some(row=>!Array.isArray(row)||row.length>26||row.some(v=>typeof v!=='string'||v.length>2000))))throw new Error('表格超过 500 行 × 26 列，或包含非法单元格。');
  let geometry:Workbook['geometry'];
  if(data.geometry){const g=data.geometry as Record<string,unknown>;if(!Array.isArray(g.points)||!Array.isArray(g.objects)||g.points.length>200||g.objects.length>500)throw new Error('几何文档格式错误。');
    const points=g.points.map((p:Record<string,unknown>)=>{if(typeof p.id!=='string'||p.id.length>100||typeof p.label!=='string'||p.label.length>30||typeof p.x!=='number'||typeof p.y!=='number'||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('几何点格式错误。');if(p.construction&&!['midpoint','intersection'].includes(String(p.construction)))throw new Error('未知几何构造。');return{id:p.id,label:p.label,x:p.x,y:p.y,construction:p.construction as 'midpoint'|'intersection'|undefined,parents:Array.isArray(p.parents)?p.parents.slice(0,2).map(String):undefined,objects:Array.isArray(p.objects)?p.objects.slice(0,2).map(String):undefined,branch:p.branch===1?1:0};});
    const pointIds=new Set(points.map(p=>p.id));if(pointIds.size!==points.length)throw new Error('几何点标识重复。');
    const objects=g.objects.map((o:Record<string,unknown>)=>{if(typeof o.id!=='string'||o.id.length>100||!['segment','line','circle','polygon'].includes(String(o.type))||!Array.isArray(o.points)||o.points.length<2||o.points.length>200||o.points.some(p=>!pointIds.has(String(p))))throw new Error('几何对象格式错误。');return{id:o.id,type:o.type as 'segment'|'line'|'circle'|'polygon',points:o.points.map(String)};});
    const objectIds=new Set(objects.map(o=>o.id));if(objectIds.size!==objects.length)throw new Error('几何对象标识重复。');
    const seen=new Set<string>();for(const p of points){if(p.construction==='midpoint'&&(!p.parents||p.parents.length!==2||p.parents.some(id=>!seen.has(id))))throw new Error('中点依赖顺序错误。');if(p.construction==='intersection'&&(!p.objects||p.objects.length!==2||p.objects.some(id=>!objectIds.has(id)||objects.find(o=>o.id===id)!.points.some(point=>!seen.has(point)))))throw new Error('交点依赖错误。');seen.add(p.id);}geometry={points,objects};
  }
  const pipeline=Array.isArray(data.pipeline)?data.pipeline.filter(v=>typeof v==='string'&&operations.some(o=>o.id===v)).slice(0,20):undefined;
  let graph:Workbook['graph'];if(data.graph){const g=data.graph as Record<string,unknown>;if(!['cartesian','parametric','polar','implicit','surface'].includes(String(g.kind))||typeof g.variable!=='string'||g.variable.length>40||!Array.isArray(g.expressions)||g.expressions.length>6||g.expressions.some(e=>typeof e!=='string'||e.length>15000)||![g.xRange,g.yRange].every(r=>Array.isArray(r)&&r.length===2&&r.every(n=>typeof n==='number'&&Number.isFinite(n))))throw new Error('图形文档格式错误。');graph={kind:g.kind as NonNullable<Workbook['graph']>['kind'],variable:g.variable,expressions:g.expressions,xRange:g.xRange as [number,number],yRange:g.yRange as [number,number],parameterRange:Array.isArray(g.parameterRange)&&g.parameterRange.length===2&&g.parameterRange.every(n=>typeof n==='number'&&Number.isFinite(n))?g.parameterRange as [number,number]:undefined,wireframe:!!g.wireframe};}
  return { id: typeof data.id === 'string' ? data.id.slice(0,100) : crypto.randomUUID(), title: data.title, entries, draft: typeof data.draft === 'string' ? data.draft.slice(0,15000) : '', updated: Number(data.updated) || Date.now(),definitions,sheet,geometry,pipeline,graph };
}
function validateParams(value:unknown):Record<string,string|number>|undefined{if(!value||typeof value!=='object'||Array.isArray(value))return undefined;const entries=Object.entries(value);if(entries.length>30)throw new Error('参数过多。');return Object.fromEntries(entries.map(([k,v])=>{if(typeof v!=='string'&&typeof v!=='number'||typeof v==='string'&&v.length>15000||typeof v==='number'&&!Number.isFinite(v))throw new Error('运算参数格式错误。');return[k,v];}));}
export function loadWorkbooks(): Workbook[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [{ ...newWorkbook(), title: '计算工作表 01', draft: '\\int_0^\\infty e^{-x^2}\\,dx' }];
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length > 100) throw new Error('本地工作表数据异常。');
  const books = data.map(validateWorkbook);
  return books.length ? books : [newWorkbook()];
}
export function saveWorkbooks(books: Workbook[]) { localStorage.setItem(KEY, JSON.stringify(books)); }
export function exportWorkbook(book: Workbook) {
  const blob = new Blob([JSON.stringify({ format: 'moyu-cas', version: 2, workbook: book }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `${book.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0,80) || '工作表'}.symath.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
