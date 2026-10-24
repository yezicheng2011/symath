import {readFileSync} from 'node:fs';
import {parseLatex} from '../src/parser';
import type {OperationInfo} from '../src/types';
const catalog=JSON.parse(readFileSync('shared/operations.json','utf8')) as OperationInfo[];
const fixtures=catalog.map(op=>({operation:op.id,variable:op.id==='recurrence'?'n':'x',ast:parseLatex(op.example),secondary:op.secondExample?parseLatex(op.secondExample):undefined,params:{variables:'x,y',order:op.id==='polynomial_fit'?2:op.id==='series'?6:1,point:0,lower:op.id==='product'?1:0,upper:op.id==='product'?10:'PositiveInfinity',target:'t',dependent:op.id==='recurrence'?'f':'y',precision:30,modulus:11,exponent:3}}));
process.stdout.write(JSON.stringify(fixtures));
