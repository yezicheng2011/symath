import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLatex} from '../src/parser';
import {evaluateSheet,parseCSV,encodeCSV} from '../src/sheet';
import {resolveGeometry,pruneGeometry} from '../src/Geometry';
import {validateWorkbook} from '../src/storage';

test('visual formulas parse to mathematical trees, including higher derivatives and systems',()=>{
  assert.deepEqual(parseLatex('\\frac{d^2}{dx^2}x^3'),['D',['D',['Power','x',3],'x'],'x']);
  assert.equal((parseLatex('\\begin{cases}x+y=3\\\\x-y=1\\end{cases}')as unknown[])[0],'List');
  assert.equal((parseLatex('y^{\\prime\\prime}+y=0')as unknown[])[0],'Equal');
  for(const latex of ['','\\placeholder{}','\\frac{1}{}'])assert.throws(()=>parseLatex(latex));
});
test('spreadsheet dependencies, aggregation, precedence and cycle errors',()=>{
  const result=evaluateSheet([['2','3','=A1+B1*2'],['4','=SUM(A1:A2)','=AVERAGE(A1:B1)'],['=A3','=(2+3)^2','=SQRT(9)']]);
  assert.equal(result[0][2].value,8);assert.equal(result[1][1].value,6);assert.equal(result[1][2].value,2.5);
  assert.equal(result[2][0].error,'#CYCLE');assert.equal(result[2][1].value,25);assert.equal(result[2][2].value,3);
  assert.equal(evaluateSheet([['=fetch(A1)']])[0][0].error,'#CYCLE');
  assert.equal(evaluateSheet([['=alert(1)']])[0][0].error,'#NAME');
});
test('CSV quoted text, multiline values, separators, and export round trip',()=>{
  const rows=[['a,b','say "hello"','line\nnext'],['1','2','3']];assert.deepEqual(parseCSV(encodeCSV(rows)),rows);
  assert.deepEqual(parseCSV('1\t2\n3\t4'),[['1','2'],['3','4']]);assert.throws(()=>parseCSV('"unclosed'));
});
test('dependent geometry follows moved parents and recalculates intersections',()=>{
  const doc={points:[{id:'a',label:'A',x:0,y:0},{id:'b',label:'B',x:4,y:0},{id:'c',label:'C',x:0,y:4},{id:'d',label:'D',x:4,y:4},{id:'m',label:'M',x:2,y:0,construction:'midpoint' as const,parents:['a','b']},{id:'i',label:'I',x:2,y:2,construction:'intersection' as const,objects:['line1','line2']}],objects:[{id:'line1',type:'line' as const,points:['a','d']},{id:'line2',type:'line' as const,points:['b','c']}]};
  let points=resolveGeometry(doc);assert.equal(points.get('m')!.x,2);assert.equal(points.get('i')!.y,2);
  doc.points[1].x=8;points=resolveGeometry(doc);assert.equal(points.get('m')!.x,4);assert.ok(Math.abs(points.get('i')!.x-8/3)<1e-10);
  const removed=pruneGeometry(doc,[],['line1']);assert.ok(!removed.points.some(p=>p.id==='i'));assert.equal(removed.points.length,5);
});
test('v2 workbook restores definitions, sheet, geometry and exact computation parameters',()=>{
  const book=validateWorkbook({title:'测试',entries:[{inputLatex:'x^2',latex:'2x',plain:'2*x',operation:'diff',variable:'x',params:{order:1,precision:50}}],definitions:[{name:'a',latex:'2'}],sheet:[['1','=A1*2']],geometry:{points:[{id:'a',label:'A',x:0,y:0}],objects:[]},pipeline:['expand','diff']});
  assert.equal(book.entries[0].params!.precision,50);assert.equal(book.definitions![0].name,'a');assert.equal(book.sheet![0][1],'=A1*2');assert.equal(book.geometry!.points[0].x,0);
  assert.throws(()=>validateWorkbook({title:'bad',entries:[],definitions:[{name:'__class__',latex:'2'}]}));
});
