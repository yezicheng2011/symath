export interface CellValue {value:number|null;error?:string;text:string}
export function evaluateSheet(rows:string[][]):CellValue[][]{
  const cache=new Map<string,CellValue>();
  function cell(row:number,col:number,path:Set<string>):CellValue{
    const key=`${row}:${col}`;if(cache.has(key))return cache.get(key)!;
    if(path.has(key))return {value:null,error:'#CYCLE',text:'#CYCLE'};
    if(row<0||col<0||row>=rows.length||col>25)return {value:null,error:'#REF',text:'#REF'};
    const raw=(rows[row]?.[col]||'').trim();const stack=new Set(path);stack.add(key);
    let result:CellValue;
    if(!raw)result={value:null,text:''};
    else if(!raw.startsWith('=')){const n=Number(raw);result={value:Number.isFinite(n)?n:null,text:raw};}
    else{
      try{
        const tokens=raw.slice(1).toUpperCase().match(/(?:\d+(?:\.\d*)?|\.\d+)(?:E[+-]?\d+)?|[A-Z]+\d+|[A-Z]+|[+\-*/^(),:]/g)||[];
        if(tokens.join('')!==raw.slice(1).toUpperCase().replace(/\s/g,''))throw new Error('#VALUE');
        let cursor=0;
        const ref=(text:string)=>{const m=/^([A-Z]+)(\d+)$/.exec(text);if(!m)throw new Error('#REF');let c=0;for(const letter of m[1])c=c*26+letter.charCodeAt(0)-64;return [Number(m[2])-1,c-1];};
        const read=(r:number,c:number)=>{const v=cell(r,c,stack);if(v.error)throw new Error(v.error);if(v.value===null&&v.text)throw new Error('#VALUE');return v.value??0;};
        const scalar=(v:number|number[])=>{if(Array.isArray(v))throw new Error('#VALUE');return v;};
        function atom():number|number[]{
          const token=tokens[cursor++];if(!token)throw new Error('#VALUE');
          if(token==='+'||token==='-'){const n=scalar(atom());return token==='-'?-n:n;}
          if(token==='('){const n=expression(0);if(tokens[cursor++]!==')')throw new Error('#VALUE');return n;}
          if(/^\d|^\./.test(token))return Number(token);
          if(/^[A-Z]+\d+$/.test(token)){
            const [r,c]=ref(token);
            if(tokens[cursor]===':'){cursor++;const [rr,cc]=ref(tokens[cursor++]||'');if(Math.abs(rr-r)*Math.abs(cc-c)>10000)throw new Error('#REF');const out=[];for(let y=Math.min(r,rr);y<=Math.max(r,rr);y++)for(let x=Math.min(c,cc);x<=Math.max(c,cc);x++){const a=cell(y,x,stack);if(a.error)throw new Error(a.error);if(a.value!==null)out.push(a.value);}return out;}
            return read(r,c);
          }
          if(token==='PI')return Math.PI;if(token==='E')return Math.E;
          if(tokens[cursor++]!=='(')throw new Error('#NAME');const args:(number|number[])[]=[];
          if(tokens[cursor]!==')'){do{args.push(expression(0));if(tokens[cursor]!==',')break;cursor++;}while(cursor<tokens.length);}
          if(tokens[cursor++]!==')')throw new Error('#VALUE');const values=args.flat();
          const fn:Record<string,(a:number[])=>number>={SUM:a=>a.reduce((s,v)=>s+v,0),COUNT:a=>a.length,AVERAGE:a=>a.reduce((s,v)=>s+v,0)/a.length,AVG:a=>a.reduce((s,v)=>s+v,0)/a.length,MIN:a=>Math.min(...a),MAX:a=>Math.max(...a),SQRT:a=>Math.sqrt(a[0]),ABS:a=>Math.abs(a[0]),SIN:a=>Math.sin(a[0]),COS:a=>Math.cos(a[0]),LOG:a=>Math.log(a[0]),EXP:a=>Math.exp(a[0])};
          if(!fn[token])throw new Error('#NAME');return fn[token](values);
        }
        function expression(min:number):number|number[]{let left=atom();while(cursor<tokens.length){const op=tokens[cursor],precedence:Record<string,number>={'+':1,'-':1,'*':2,'/':2,'^':3};const p=precedence[op];if(p===undefined||p<min)break;cursor++;const a=scalar(left),b=scalar(expression(op==='^'?p:p+1));left=op==='+'?a+b:op==='-'?a-b:op==='*'?a*b:op==='/'?a/b:a**b;}return left;}
        const value=scalar(expression(0));if(cursor!==tokens.length)throw new Error('#VALUE');if(!Number.isFinite(value))throw new Error('#NUM');result={value,text:Number(value.toPrecision(12)).toString()};
      }catch(e){const error=(e as Error).message;result={value:null,error,text:error};}
    }
    cache.set(key,result);return result;
  }
  return rows.map((row,r)=>row.map((_,c)=>cell(r,c,new Set())));
}
export function parseCSV(text:string):string[][]{
  const first=text.split(/\r?\n/)[0],delimiter=first.includes('\t')?'\t':first.split(';').length>first.split(',').length?';':',';
  const rows:string[][]=[];let row:string[]=[],value='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(!quoted&&c===delimiter){row.push(value);value='';}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}else value+=c;if(rows.length>500||row.length>26||value.length>2000)throw new Error('CSV 超过 500 行、26 列或单元格长度上限。');}
  if(quoted)throw new Error('CSV 引号未闭合。');if(value||row.length){row.push(value);rows.push(row);}return rows;
}
export function encodeCSV(rows:string[][]):string{return rows.map(row=>row.map(v=>/[",\n\r]/.test(v)?`"${v.replace(/"/g,'""')}"`:v).join(',')).join('\r\n');}
