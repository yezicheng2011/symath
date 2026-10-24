import {useMemo,useRef,useState} from 'react';
import {Icon} from './Icon';
import type {GeometryDocument,GeoObject,GeoPoint} from './types';
export const initialGeometry:GeometryDocument={points:[{id:'A',label:'A',x:-3,y:-2},{id:'B',label:'B',x:3,y:-2},{id:'C',label:'C',x:0,y:3}],objects:[{id:'triangle-1',type:'polygon',points:['A','B','C']}]};
type Tool='move'|'point'|'segment'|'line'|'circle'|'triangle'|'polygon'|'midpoint'|'intersection'|'delete';
const tools:[Tool,string,string][]=[['move','选择 / 拖动','↖'],['point','点','•'],['segment','线段','╱'],['line','直线','↗'],['circle','圆','○'],['triangle','三角形','△'],['polygon','多边形','⬠'],['midpoint','中点','⊙'],['intersection','交点','∩'],['delete','删除','×']];
const distance=(a:GeoPoint,b:GeoPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
export function pruneGeometry(doc:GeometryDocument,pointIds:string[]=[],objectIds:string[]=[]):GeometryDocument{
  const points=new Set(pointIds),objects=new Set(objectIds);let changed=true;
  while(changed){changed=false;for(const o of doc.objects)if(!objects.has(o.id)&&o.points.some(id=>points.has(id))){objects.add(o.id);changed=true;}
    for(const p of doc.points)if(!points.has(p.id)&&(p.parents?.some(id=>points.has(id))||p.objects?.some(id=>objects.has(id)))){points.add(p.id);changed=true;}}
  return{points:doc.points.filter(p=>!points.has(p.id)),objects:doc.objects.filter(o=>!objects.has(o.id))};
}
function intersections(a:GeoObject,b:GeoObject,points:Map<string,GeoPoint>):[number,number][]{
  const p=a.points.map(id=>points.get(id)!),q=b.points.map(id=>points.get(id)!);
  if([...p,...q].some(v=>!v||!Number.isFinite(v.x)))return [];
  if(a.type!=='circle'&&b.type!=='circle'){
    const dx=p[1].x-p[0].x,dy=p[1].y-p[0].y,ex=q[1].x-q[0].x,ey=q[1].y-q[0].y,den=dx*ey-dy*ex;
    if(Math.abs(den)<1e-10)return [];const t=((q[0].x-p[0].x)*ey-(q[0].y-p[0].y)*ex)/den;
    const u=((q[0].x-p[0].x)*dy-(q[0].y-p[0].y)*dx)/den;
    if(a.type==='segment'&&(t<0||t>1)||b.type==='segment'&&(u<0||u>1))return [];
    return [[p[0].x+t*dx,p[0].y+t*dy]];
  }
  if(a.type==='circle'&&b.type==='circle'){
    const r=distance(p[0],p[1]),s=distance(q[0],q[1]),d=distance(p[0],q[0]);if(d<1e-10||d>r+s||d<Math.abs(r-s))return [];
    const t=(r*r-s*s+d*d)/(2*d),h=Math.sqrt(Math.max(0,r*r-t*t)),ux=(q[0].x-p[0].x)/d,uy=(q[0].y-p[0].y)/d;
    return [[p[0].x+t*ux-h*uy,p[0].y+t*uy+h*ux],[p[0].x+t*ux+h*uy,p[0].y+t*uy-h*ux]];
  }
  if(a.type==='circle')return intersections(b,a,points);
  const [p0,p1]=p,[center,edge]=q,r=distance(center,edge),dx=p1.x-p0.x,dy=p1.y-p0.y,fx=p0.x-center.x,fy=p0.y-center.y;
  const aa=dx*dx+dy*dy,bb=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-r*r,disc=bb*bb-4*aa*cc;if(aa<1e-10||disc<0)return [];
  return [(-bb-Math.sqrt(disc))/(2*aa),(-bb+Math.sqrt(disc))/(2*aa)].filter(t=>a.type!=='segment'||t>=0&&t<=1).map(t=>[p0.x+t*dx,p0.y+t*dy]);
}
export function resolveGeometry(doc:GeometryDocument):Map<string,GeoPoint>{
  const points=new Map(doc.points.map(p=>[p.id,{...p}]));
  for(const p of points.values()){
    if(p.construction==='midpoint'){
      const a=points.get(p.parents![0]),b=points.get(p.parents![1]);if(a&&b){p.x=(a.x+b.x)/2;p.y=(a.y+b.y)/2;}
    }else if(p.construction==='intersection'){
      const a=doc.objects.find(o=>o.id===p.objects![0]),b=doc.objects.find(o=>o.id===p.objects![1]);const found=a&&b?intersections(a,b,points)[p.branch||0]:undefined;
      p.x=found?.[0]??NaN;p.y=found?.[1]??NaN;
    }
  }
  return points;
}
export function Geometry({document:doc,onChange,onTransfer}:{document:GeometryDocument;onChange:(doc:GeometryDocument)=>void;onTransfer:(latex:string,operation:string)=>void}){
  const [tool,setTool]=useState<Tool>('move');const [selection,setSelection]=useState<string[]>([]);const [selected,setSelected]=useState('');const [span,setSpan]=useState(10);const [message,setMessage]=useState('拖动 A、B、C，构造会随父对象实时更新。');
  const svg=useRef<SVGSVGElement>(null);const dragging=useRef<string|null>(null);const points=useMemo(()=>resolveGeometry(doc),[doc]);
  const w=900,h=580,scale=w/(span*2);const px=(x:number)=>w/2+x*scale,py=(y:number)=>h/2-y*scale;
  function world(event:React.PointerEvent<SVGSVGElement>):[number,number]{const r=event.currentTarget.getBoundingClientRect();return [((event.clientX-r.left)/r.width*w-w/2)/scale,(h/2-(event.clientY-r.top)/r.height*h)/scale];}
  function makePoint(x:number,y:number,extra:Partial<GeoPoint>={}):GeoPoint{return{id:crypto.randomUUID(),label:String.fromCharCode(65+doc.points.length%26)+(doc.points.length>=26?Math.floor(doc.points.length/26):''),x,y,...extra};}
  function deletePoint(id:string){onChange(pruneGeometry(doc,[id]));}
  function pickPoint(id:string,current:GeometryDocument){
    setSelected(id);
    if(tool==='delete'){deletePoint(id);return;}
    if(tool==='move'||tool==='point')return;
    if(tool==='intersection'){setMessage('交点工具：选择两条直线、线段或圆。');return;}
    if(selection.includes(id)){if(tool==='polygon'&&selection.length>=3)finishPolygon(current);return;}
    const next=[...selection,id];setSelection(next);
    const needed=tool==='triangle'?3:tool==='polygon'?Infinity:2;
    if(next.length===needed){
      if(tool==='midpoint'){
        const a=points.get(next[0])||current.points.find(p=>p.id===next[0])!,b=points.get(next[1])||current.points.find(p=>p.id===next[1])!;
        onChange({...current,points:[...current.points,makePoint((a.x+b.x)/2,(a.y+b.y)/2,{construction:'midpoint',parents:next})]});
      }else onChange({...current,objects:[...current.objects,{id:crypto.randomUUID(),type:tool==='triangle'?'polygon':tool as GeoObject['type'],points:next}]});
      setSelection([]);
    }
  }
  function finishPolygon(current=doc){if(selection.length<3)return;onChange({...current,objects:[...current.objects,{id:crypto.randomUUID(),type:'polygon',points:selection}]});setSelection([]);}
  function pickObject(id:string){setSelected(id);if(tool==='delete'){
    onChange(pruneGeometry(doc,[],[id]));return;
  }if(tool!=='intersection')return;const object=doc.objects.find(o=>o.id===id);if(object?.type==='polygon'){setMessage('请选择直线、线段或圆。');return;}
    const next=[...selection,id];setSelection(next);if(next.length===2){const a=doc.objects.find(o=>o.id===next[0])!,b=doc.objects.find(o=>o.id===next[1])!,found=intersections(a,b,points);
      if(!found.length)setMessage('这两个对象当前没有交点。');else onChange({...doc,points:[...doc.points,...found.map(([x,y],i)=>({...makePoint(x,y,{construction:'intersection',objects:next,branch:i}),id:crypto.randomUUID(),label:`I${doc.points.length+i+1}`}))]});setSelection([]);}
  }
  const chosenObject=doc.objects.find(o=>o.id===selected);const chosenPoint=points.get(selected);
  const stats=doc.objects.map(o=>{const ps=o.points.map(i=>points.get(i)!);if(ps.some(p=>!p||!Number.isFinite(p.x)))return [o.id,'构造在当前坐标下不存在'];let value='';if(o.type==='circle'){const r=distance(ps[0],ps[1]);value=`r ${r.toFixed(4)} / S ${(Math.PI*r*r).toFixed(4)}`;}else if(o.type==='polygon'){const area=Math.abs(ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length];return a+p.x*q.y-p.y*q.x;},0))/2;const perimeter=ps.reduce((a,p,i)=>a+distance(p,ps[(i+1)%ps.length]),0);value=`S ${area.toFixed(4)} / P ${perimeter.toFixed(4)}`;}else value=`L ${distance(ps[0],ps[1]).toFixed(4)}`;return [o.id,value];});
  return <section className="geometry-workspace"><div className="section-bar"><div><span className="module-code">GEO / 02</span><h2>动态几何</h2><span>DEPENDENCY CONSTRUCTION</span></div><div><button onClick={()=>{onChange(structuredClone(initialGeometry));setSelection([]);}}>重置示例</button><button onClick={()=>{onChange({points:[],objects:[]});setSelection([]);}}>清空画布</button></div></div>
    <div className="geometry-tools">{tools.map(([id,label,symbol])=><button key={id} className={tool===id?'active':''} aria-label={label} title={label} onClick={()=>{setTool(id);setSelection([]);setMessage(id==='intersection'?'依次选择两条直线、线段或圆。':`${label}：在画布上选择已有点或点击空白处创建点。`);}}><b>{symbol}</b><span>{label}</span></button>)}{tool==='polygon'&&selection.length>=3&&<button onClick={()=>finishPolygon()}>完成多边形</button>}</div>
    <div className="geometry-layout"><div><svg ref={svg} viewBox={`0 0 ${w} ${h}`} className="geometry-canvas" role="img" aria-label="交互几何画布" onPointerDown={e=>{
      if(e.target!==e.currentTarget&&!(e.target as SVGElement).classList.contains('geometry-bg'))return;
      if(['move','delete','intersection'].includes(tool)){setSelected('');return;}
      if(doc.points.length>=200){setMessage('单文档最多 200 个点。');return;}
      const [x,y]=world(e),point=makePoint(Math.round(x*20)/20,Math.round(y*20)/20),next={...doc,points:[...doc.points,point]};onChange(next);pickPoint(point.id,next);
    }} onPointerMove={e=>{if(!dragging.current)return;const[x,y]=world(e);onChange({...doc,points:doc.points.map(p=>p.id===dragging.current?{...p,x:Math.round(x*100)/100,y:Math.round(y*100)/100}:p)});}} onPointerUp={()=>{dragging.current=null;}} onPointerCancel={()=>{dragging.current=null;}}>
      <defs><pattern id="geometry-grid" width={scale} height={scale} x={w/2%scale} y={h/2%scale} patternUnits="userSpaceOnUse"><path d={`M ${scale} 0 L 0 0 0 ${scale}`} fill="none" stroke="#29323b" strokeWidth=".7"/></pattern></defs><rect className="geometry-bg" width={w} height={h} fill="#11161b"/><rect className="geometry-bg" width={w} height={h} fill="url(#geometry-grid)"/><path d={`M0 ${h/2}H${w}M${w/2} 0V${h}`} stroke="#53616d" strokeWidth="1"/>
      {doc.objects.map(o=>{const ps=o.points.map(id=>points.get(id)!);if(ps.some(p=>!p||!Number.isFinite(p.x)))return null;const active=selected===o.id||selection.includes(o.id),color=active?'#f3a451':'#67b7ad';const common={stroke:color,strokeWidth:active?2.5:1.7,onPointerDown:(e:React.PointerEvent)=>{e.stopPropagation();pickObject(o.id);},className:'geometry-object'};
        if(o.type==='circle')return <circle key={o.id} cx={px(ps[0].x)} cy={py(ps[0].y)} r={distance(ps[0],ps[1])*scale} fill="transparent" {...common}/>;
        if(o.type==='polygon')return <polygon key={o.id} points={ps.map(p=>`${px(p.x)},${py(p.y)}`).join(' ')} fill={active?'#f3a45112':'#67b7ad12'} {...common}/>;
        const dx=ps[1].x-ps[0].x,dy=ps[1].y-ps[0].y;const start=o.type==='line'?{x:ps[0].x-dx*100,y:ps[0].y-dy*100}:ps[0],end=o.type==='line'?{x:ps[1].x+dx*100,y:ps[1].y+dy*100}:ps[1];
        return <g key={o.id}><line x1={px(start.x)} y1={py(start.y)} x2={px(end.x)} y2={py(end.y)} stroke="transparent" strokeWidth="14" onPointerDown={common.onPointerDown}/><line x1={px(start.x)} y1={py(start.y)} x2={px(end.x)} y2={py(end.y)} {...common}/></g>;
      })}
      {[...points.values()].filter(p=>Number.isFinite(p.x)).map(p=><g key={p.id} onPointerDown={e=>{e.stopPropagation();if(tool==='move'&&!p.construction){dragging.current=p.id;svg.current?.setPointerCapture(e.pointerId);}pickPoint(p.id,doc);}} className="geometry-point"><circle cx={px(p.x)} cy={py(p.y)} r="13" fill="transparent"/><circle cx={px(p.x)} cy={py(p.y)} r={selected===p.id||selection.includes(p.id)?5:4} fill={p.construction?'#bba6ec':'#f4aa62'} stroke="#12171e" strokeWidth="2"/><text x={px(p.x)+10} y={py(p.y)-10}>{p.label}</text></g>)}
    </svg><div className="geometry-status"><span>{message}</span><div><button aria-label="缩小几何画布" onClick={()=>setSpan(s=>Math.min(s*1.4,50))}><Icon name="minus" size={13}/></button><button aria-label="放大几何画布" onClick={()=>setSpan(s=>Math.max(s/1.4,2))}><Icon name="plus" size={13}/></button></div></div></div>
    <aside className="geometry-inspector"><h3>OBJECT MANAGER <span>{doc.points.length+doc.objects.length}</span></h3>{chosenPoint&&<div className="point-properties"><strong>点 {chosenPoint.label}{chosenPoint.construction?' / 关联构造':''}</strong>{(['x','y']as const).map(axis=><label key={axis}>{axis}<input type="number" step=".1" aria-label={`点${chosenPoint.label}的${axis}坐标`} disabled={!!chosenPoint.construction} value={Number.isFinite(chosenPoint[axis])?Number(chosenPoint[axis].toFixed(4)):''} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value)&&Math.abs(value)<1e8)onChange({...doc,points:doc.points.map(p=>p.id===chosenPoint.id?{...p,[axis]:value}:p)});}}/></label>)}</div>}
      <div className="geometry-object-list">{[...points.values()].map(p=><button className={selected===p.id?'active':''} key={p.id} onClick={()=>setSelected(p.id)}><span className="geo-dot">•</span><b>{p.label}</b><span>{Number.isFinite(p.x)?`(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`:'未定义'}</span>{p.construction&&<small>LINK</small>}</button>)}{doc.objects.map(o=><button key={o.id} className={selected===o.id?'active':''} onClick={()=>setSelected(o.id)}><span className="geo-dot">{o.type==='circle'?'○':o.type==='polygon'?'△':'╱'}</span><b>{o.points.map(id=>points.get(id)?.label).join('')}</b><span>{stats.find(([id])=>id===o.id)?.[1]}</span></button>)}</div>
      {chosenObject?.type==='polygon'&&<button className="primary-button geometry-transfer" onClick={()=>{const ps=chosenObject.points.map(id=>points.get(id)!);onTransfer(`\\begin{pmatrix}${ps.map(p=>`${p.x}&${p.y}`).join('\\\\')}\\end{pmatrix}`,'polygon_area');}}>送入符号计算 <Icon name="arrow" size={14}/></button>}
      <p className="module-note">拖动自由点将更新依赖它的几何对象。交点与中点保留构造关系。平面几何测量使用数值坐标。</p>
    </aside></div>
  </section>;
}
