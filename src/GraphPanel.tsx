import {useEffect,useRef,useState} from 'react';
import {requestGraph} from './engine';
import {FormulaField} from './FormulaField';
import {Surface} from './Surface';
import {Icon} from './Icon';
import type {Definition,GraphDocument,GraphResult,PlotKind} from './types';
const colors=['#f4a34f','#60b9b2','#b9a2ed','#ccdb79','#ed899d','#8bb7eb'];
export interface GraphCommand{latex:string;revision:number;kind?:PlotKind}
export function GraphPanel({command,definitions,expanded=false,graphDocument,onChange}:{command:GraphCommand;definitions:Definition[];expanded?:boolean;graphDocument?:GraphDocument;onChange?:(document:GraphDocument)=>void}){
  const [kind,setKind]=useState<PlotKind>(graphDocument?.kind||'cartesian');const [formulas,setFormulas]=useState(graphDocument?.expressions||['\\sin x']);
  const [variable,setVariable]=useState(graphDocument?.variable||'x');const [xRange,setXRange]=useState<[number,number]>(graphDocument?.xRange||[-6,6]);const [yRange,setYRange]=useState<[number,number]>(graphDocument?.yRange||[-3,3]);
  const [parameterRange,setParameterRange]=useState<[number,number]>(graphDocument?.parameterRange||[-Math.PI,Math.PI]);
  const [data,setData]=useState<GraphResult|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [wireframe,setWireframe]=useState(graphDocument?.wireframe||false);
  const saveRef=useRef(onChange);saveRef.current=onChange;
  useEffect(()=>{saveRef.current?.({kind,expressions:formulas,variable,xRange,yRange,parameterRange,wireframe});},[kind,formulas,variable,xRange,yRange,parameterRange,wireframe]);
  const [hover,setHover]=useState<[number,number]|null>(null);const counter=useRef(0);const svg=useRef<SVGSVGElement>(null);
  const [dirty,setDirty]=useState(true);const signature=JSON.stringify([kind,formulas,variable,xRange,yRange,parameterRange,definitions]);
  const signatureRef=useRef(signature);signatureRef.current=signature;
  useEffect(()=>setDirty(true),[signature]);
  async function draw(next?:{kind?:PlotKind;formulas?:string[];xRange?:[number,number];yRange?:[number,number];variable?:string}){
    const current=++counter.current;setBusy(true);setError('');
    const requestedSignature=JSON.stringify([next?.kind||kind,next?.formulas||formulas,next?.variable||variable,next?.xRange||xRange,next?.yRange||yRange,parameterRange,definitions]);
    try{
      const nextKind=next?.kind||kind;
      const result=await requestGraph<GraphResult>({kind:nextKind,expressions:next?.formulas||formulas,variable:next?.variable||variable,secondVariable:'y',xRange:nextKind==='parametric'||nextKind==='polar'?parameterRange:next?.xRange||xRange,yRange:next?.yRange||yRange,definitions,resolution:nextKind==='implicit'?90:55});
      if(counter.current===current){setData(result);if(signatureRef.current===requestedSignature)setDirty(false);}
    }catch(e){if(counter.current===current)setError((e as Error).message);}
    finally{if(counter.current===current)setBusy(false);}
  }
  useEffect(()=>{if(command.revision>0){const k=command.kind||'cartesian';setKind(k);setFormulas([command.latex]);setVariable(k==='parametric'||k==='polar'?'t':'x');void draw({kind:k,formulas:[command.latex],variable:k==='parametric'||k==='polar'?'t':'x'});}else void draw();},[command.revision]);
  const width=800,height=expanded?490:340,pad=35;
  const px=(x:number)=>pad+(x-xRange[0])/(xRange[1]-xRange[0]||1)*(width-2*pad);
  const py=(y:number)=>height-pad-(y-yRange[0])/(yRange[1]-yRange[0]||1)*(height-2*pad);
  function ticks(lo:number,hi:number,count:number){if(hi<=lo)return [];const raw=(hi-lo)/count,base=10**Math.floor(Math.log10(raw));const step=[1,2,5,10].map(n=>n*base).find(n=>n>=raw)||base*10;const out=[];for(let x=Math.ceil(lo/step)*step;x<=hi&&out.length<20;x+=step)out.push(Number(x.toPrecision(8)));return out;}
  const paths=(data?.curves||[]).map(points=>{let path='',last:number|null=null;for(const[x,y]of points){if(x===null||y===null||Math.abs(py(y))>height*10){last=null;continue;}const sy=py(y);path+=`${last===null||Math.abs(sy-last)>height*.8?'M':'L'}${px(x).toFixed(2)},${sy.toFixed(2)} `;last=sy;}return path;});
  let implicit='';
  if(data?.kind==='implicit'&&data.grid){const grid=data.grid,n=data.resolution!;for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){
    const a=j*n+i;const corners=[grid[a],grid[a+1],grid[a+n+1],grid[a+n]];const crossings:[number,number][]=[];
    for(let k=0;k<4;k++){const p=corners[k],q=corners[(k+1)%4];if(p[2]===null||q[2]===null||p[2]*q[2]>0||p[2]===q[2])continue;const t=p[2]/(p[2]-q[2]);crossings.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
    for(let k=0;k+1<crossings.length;k+=2)implicit+=`M${px(crossings[k][0])},${py(crossings[k][1])}L${px(crossings[k+1][0])},${py(crossings[k+1][1])} `;
  }}
  function zoom(factor:number){const cx=(xRange[0]+xRange[1])/2,cy=(yRange[0]+yRange[1])/2;const dx=(xRange[1]-xRange[0])*factor/2,dy=(yRange[1]-yRange[0])*factor/2;const xr:[number,number]=[cx-dx,cx+dx],yr:[number,number]=[cy-dy,cy+dy];setXRange(xr);setYRange(yr);void draw({xRange:xr,yRange:yr});}
  function fit(){const ps=data?.curves?.flat().filter((p):p is [number,number]=>p[0]!==null&&p[1]!==null);if(!ps?.length)return;const ys=ps.map(p=>p[1]).sort((a,b)=>a-b);const lo=ys[Math.floor(ys.length*.03)],hi=ys[Math.floor((ys.length-1)*.97)],padding=Math.max((hi-lo)*.2,.5);setYRange([lo-padding,hi+padding]);}
  function changeKind(k:PlotKind){setKind(k);setData(null);setError('');if(k==='surface'||k==='implicit'){setFormulas([k==='surface'?'\\sin\\left(\\sqrt{x^2+y^2}\\right)':'x^2+y^2=9']);setVariable('x');setXRange([-5,5]);setYRange([-5,5]);}else if(k==='parametric'){setFormulas(['[\\cos(3t),\\sin(2t)]']);setVariable('t');setParameterRange([-Math.PI,Math.PI]);setXRange([-2,2]);setYRange([-2,2]);}else if(k==='polar'){setFormulas(['2\\cos(3t)']);setVariable('t');setParameterRange([-Math.PI,Math.PI]);setXRange([-3,3]);setYRange([-3,3]);}else{setFormulas(['\\sin x']);setVariable('x');setXRange([-6,6]);setYRange([-3,3]);}}
  function download(){let url='',filename='symath-graph.svg';if(kind==='surface'){const canvas=document.querySelector<HTMLCanvasElement>('.surface canvas');if(!canvas)return;url=canvas.toDataURL('image/png');filename='symath-surface.png';}else if(svg.current){const clone=svg.current.cloneNode(true)as SVGSVGElement;clone.setAttribute('xmlns','http://www.w3.org/2000/svg');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.graph-grid{stroke:#303741;stroke-width:1}.graph-axis{stroke:#74808c;stroke-width:1.2}text{fill:#8c96a3;font:12px monospace}';clone.prepend(style);url=URL.createObjectURL(new Blob([clone.outerHTML],{type:'image/svg+xml'}));}if(url){const a=document.createElement('a');a.href=url;a.download=filename;a.click();if(url.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(url),1000);}}
  return <section className={`graph-panel ${expanded?'expanded':''}`} aria-label="绘图工作区"><div className="dock-title"><span><Icon name="chart" size={15}/> GRAPHICS <b>{kind==='surface'?'3D':'2D'}</b></span><div><button title="导出图像" aria-label="导出图像" onClick={download}><Icon name="down" size={14}/></button></div></div>
    <div className="graph-types">{([['cartesian','函数'],['parametric','参数'],['polar','极坐标'],['implicit','隐式'],['surface','三维']]as[PlotKind,string][]).map(([k,label])=><button key={k} className={kind===k?'active':''} onClick={()=>changeKind(k)}>{label}</button>)}</div>
    <div className="graph-expressions">{formulas.map((f,i)=><div className="graph-expression" key={i}><span style={{color:colors[i]}}>F{String(i+1).padStart(2,'0')}</span><FormulaField value={f} onChange={v=>setFormulas(fs=>fs.map((q,j)=>j===i?v:q))} onSubmit={()=>void draw()} label={`绘图公式${i+1}`}/>{i>0&&<button aria-label={`删除曲线${i+1}`} onClick={()=>setFormulas(fs=>fs.filter((_,j)=>j!==i))}><Icon name="close" size={12}/></button>}</div>)}</div>
    <div className="graph-controls"><label>变量 <input value={variable} maxLength={20} aria-label="绘图变量" onChange={e=>setVariable(e.target.value)}/></label>{kind==='cartesian'&&formulas.length<6&&<button onClick={()=>setFormulas(f=>[...f,''])}><Icon name="plus" size={12}/>曲线</button>}<button className="graph-draw" disabled={busy} onClick={()=>void draw()}>{busy?'绘制中…':'生成图像'}<Icon name="arrow" size={12}/></button></div>
    <div className="graph-viewport">{dirty&&data&&!busy&&<span className="graph-stale">输入已修改 / 需重新生成</span>}{kind==='surface'&&data?.kind==='surface'?<Surface data={data} wireframe={wireframe}/>:<svg ref={svg} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="函数曲线与坐标网格" onPointerLeave={()=>setHover(null)} onPointerMove={e=>{const rect=e.currentTarget.getBoundingClientRect();const u=(e.clientX-rect.left)/rect.width*width,t=(e.clientY-rect.top)/rect.height*height;setHover([xRange[0]+(u-pad)/(width-2*pad)*(xRange[1]-xRange[0]),yRange[1]-(t-pad)/(height-2*pad)*(yRange[1]-yRange[0])]);}}>
      <defs><clipPath id="graph-area"><rect x={pad} y={pad} width={width-2*pad} height={height-2*pad}/></clipPath><pattern id="graph-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#2d343d"/></pattern></defs><rect width={width} height={height} fill="#101318"/><rect x={pad} y={pad} width={width-2*pad} height={height-2*pad} fill="url(#graph-dots)"/>
      {ticks(xRange[0],xRange[1],7).map(x=><g key={`x${x}`}><path d={`M${px(x)} ${pad}V${height-pad}`} className={x===0?'graph-axis':'graph-grid'}/><text x={px(x)} y={height-14} textAnchor="middle">{Number(x.toPrecision(4))}</text></g>)}
      {ticks(yRange[0],yRange[1],5).map(y=><g key={`y${y}`}><path d={`M${pad} ${py(y)}H${width-pad}`} className={y===0?'graph-axis':'graph-grid'}/><text x={pad-8} y={py(y)+4} textAnchor="end">{Number(y.toPrecision(4))}</text></g>)}
      {paths.map((path,i)=><path key={i} className="function-path" d={path} fill="none" stroke={colors[i]} strokeWidth="2.2" clipPath="url(#graph-area)"/>)}
      {implicit&&<path d={implicit} fill="none" stroke={colors[0]} strokeWidth="2" clipPath="url(#graph-area)"/>}
      {hover&&<g clipPath="url(#graph-area)"><path d={`M${px(hover[0])} ${pad}V${height-pad}M${pad} ${py(hover[1])}H${width-pad}`} stroke="#7a8793" strokeWidth=".7" strokeDasharray="4 5"/><circle cx={px(hover[0])} cy={py(hover[1])} r="3" fill="#f4a34f"/></g>}
    </svg>}{busy&&<div className="graph-message"><span className="spinner"/>计算采样点</div>}{error&&<div className="graph-message error" role="alert">{error}</div>}{!data&&!busy&&!error&&<div className="graph-message">设置公式与范围，生成图像</div>}</div>
    <div className="graph-readout"><span>{hover?`X ${hover[0].toFixed(4)}　Y ${hover[1].toFixed(4)}`:`${data?.elapsed??0} ms　/　${kind==='surface'?`${data?.resolution??0}² MESH`:'NUMERICAL SAMPLING'}`}</span><div>{kind==='surface'?<label><input type="checkbox" checked={wireframe} onChange={e=>setWireframe(e.target.checked)}/>线框</label>:<><button aria-label="缩小图像" onClick={()=>zoom(1.5)}><Icon name="minus" size={13}/></button><button title="适应曲线" aria-label="适应曲线" onClick={fit}>FIT</button><button aria-label="放大图像" onClick={()=>zoom(1/1.5)}><Icon name="plus" size={13}/></button></>}</div></div>
    <div className="graph-ranges">{([['X',xRange,setXRange],['Y',yRange,setYRange],...(kind==='parametric'||kind==='polar'?[['T',parameterRange,setParameterRange] as const]:[])]as const).map(([label,range,setter])=><label key={label}>{label}<input aria-label={`${label}轴下限`} type="number" value={Number(range[0].toFixed(5))} onChange={e=>setter([Number(e.target.value),range[1]])}/><span>→</span><input aria-label={`${label}轴上限`} type="number" value={Number(range[1].toFixed(5))} onChange={e=>setter([range[0],Number(e.target.value)])}/></label>)}</div><div className="graph-caption">实数采样 / 极点附近可能出现采样误差。范围修改后点击生成。</div>
  </section>;
}
