import {ComputeEngine} from '@cortex-js/compute-engine';
import type {MathNode} from './types';
const ce=new ComputeEngine();
function normalize(node:MathNode):MathNode {
  if(!Array.isArray(node))return node;
  const [head,...rest]=node;const args=rest.map(normalize);
  if((head==='InvisibleOperator'||head==='Multiply')&&args.length>=2){
    const f=args[0];
    if(Array.isArray(f)&&f[0]==='Divide'){
      const numerator=f[1],denominator=f[2];
      const order=numerator==='d'?1:Array.isArray(numerator)&&numerator[0]==='Power'&&numerator[1]==='d'?numerator[2]:null;
      if(typeof order==='number'&&Array.isArray(denominator)&&['Multiply','InvisibleOperator'].includes(String(denominator[0]))&&denominator[1]==='d'){
        const power=denominator[2];const variable=order===1?power:Array.isArray(power)&&power[0]==='Power'&&power[2]===order?power[1]:null;
        if(typeof variable==='string'){
          if(!Number.isInteger(order)||order<1||order>12)throw new Error('导数阶数需为 1 到 12 的整数。');
          let result:MathNode=args.length===2?args[1]:['Multiply',...args.slice(1)];
          for(let i=0;i<order;i++)result=['D',result,variable];return result;
        }
      }
    }
  }
  return [head,...args];
}
export function parseLatex(latex:string):MathNode {
  if(!latex.trim())throw new Error('请输入数学表达式。');
  if(latex.length>15000)throw new Error('单条公式超过 15000 字符，请拆分为多个计算单元。');
  if(/\\(?:placeholder|error)\b/.test(latex))throw new Error('公式中还有未填写的空位。');
  const normalized=latex.replace(/\\mathrm\{(sin|cos|tan|cot|sec|csc|sinh|cosh|tanh|log|ln|exp|asin|acos|atan|abs)\}/g,(_,n:string)=>`\\${({asin:'arcsin',acos:'arccos',atan:'arctan',log:'ln'} as Record<string,string>)[n]||n}`)
    .replace(/\\binom\{([^{}]+)\}\{([^{}]+)\}/g,'\\operatorname{binomial}($1,$2)');
  const parsed=ce.parse(normalized,{form:'raw'});
  if(!parsed?.isValid)throw new Error('公式未完成或无法解析，请检查括号、上下标和矩阵结构。');
  return normalize(parsed.json as MathNode);
}
