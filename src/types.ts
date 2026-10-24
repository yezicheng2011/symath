import catalog from '../shared/operations.json';
export type Category = 'algebra'|'equations'|'calculus'|'matrices'|'discrete'|'complex'|'statistics'|'geometry';
export interface OperationInfo {id:string;label:string;category:Category;symbol:string;description?:string;params?:string[];input?:string;example:string;secondary?:string;secondExample?:string}
export const operations=catalog as OperationInfo[];
export type Operation=string;
export const categories: {id:Category;label:string;code:string}[]=[
  {id:'algebra',label:'代数与多项式',code:'ALG'},{id:'equations',label:'方程与微分方程',code:'EQN'},
  {id:'calculus',label:'微积分与变换',code:'CALC'},{id:'matrices',label:'矩阵与线性代数',code:'MAT'},
  {id:'discrete',label:'数论与组合',code:'NUM'},{id:'complex',label:'复数分析',code:'CPLX'},
  {id:'statistics',label:'统计与拟合',code:'STAT'},{id:'geometry',label:'解析几何',code:'GEO'},
];
export type MathNode = number|string|MathNode[]|{num?:string;sym?:string;fn?:MathNode[];str?:string};
export type Parameters=Record<string,string|number>;
export interface Definition {id:string;name:string;latex:string;arguments?:string[]}
export interface CalculateRequest {latex:string;operation:Operation;variable:string;params?:Parameters;secondary?:string;definitions?:Definition[];steps?:string[]}
export interface Calculation {latex:string;plain:string;note?:string;elapsed:number;engine?:string;approximate?:boolean;variables?:string[];steps?:(Calculation & {operation:string})[]}
export interface Entry extends Calculation {id:string;created:number;inputLatex:string;operation:Operation;variable:string;params?:Parameters;secondary?:string;stale?:boolean}
export interface GeoPoint {id:string;x:number;y:number;label:string;parents?:string[];construction?:'midpoint'|'intersection';objects?:string[];branch?:number}
export interface GeoObject {id:string;type:'segment'|'line'|'circle'|'polygon';points:string[]}
export interface GeometryDocument {points:GeoPoint[];objects:GeoObject[]}
export interface Workbook {id:string;title:string;entries:Entry[];draft:string;updated:number;definitions?:Definition[];sheet?:string[][];geometry?:GeometryDocument;pipeline?:string[];graph?:GraphDocument}
export type PlotKind='cartesian'|'parametric'|'polar'|'implicit'|'surface';
export interface GraphDocument {kind:PlotKind;expressions:string[];variable:string;xRange:[number,number];yRange:[number,number];parameterRange?:[number,number];wireframe:boolean}
export interface GraphResult {kind:PlotKind;curves?:([number|null,number|null][])[];grid?:[number,number,number|null][];resolution?:number;xRange:[number,number];yRange:[number,number];elapsed:number}
export interface PlotData {points:[number,number|null][];variable:string;latex:string;min:number;max:number}
