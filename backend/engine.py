"""Permissively licensed symbolic kernel adapter. JSON trees, never Python source."""
import json
import math
import re
import time
from pathlib import Path
from functools import reduce

import sympy as s
from sympy.core.function import AppliedUndef
from sympy.geometry import Point, Line, Polygon, Triangle, Circle

CATALOG = json.loads((Path(__file__).resolve().parent.parent / 'shared/operations.json').read_text(encoding='utf-8'))
OP_IDS = {op['id'] for op in CATALOG}
NAME = re.compile(r'^[A-Za-z][A-Za-z0-9_]{0,39}$')
NUMBER = re.compile(r'^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$')

class MathError(ValueError):
    pass

def name(value):
    if not isinstance(value, str) or not NAME.fullmatch(value) or '__' in value:
        raise MathError('数学标识符需以字母开头，可包含字母、数字和单下划线。')
    return value

def integer(value, low=-1000000, high=1000000):
    try:
        n = int(value)
        if isinstance(value, float) and n != value:
            raise ValueError()
        if str(n) != str(value) and not isinstance(value, s.Integer):
            raise ValueError()
        if not low <= n <= high:
            raise ValueError()
        return n
    except (ValueError, TypeError, OverflowError):
        raise MathError(f'此参数需为 {low} 到 {high} 之间的整数。')

class Context:
    def __init__(self, request):
        self.request = request
        self.params = request.get('params', {})
        if not isinstance(self.params, dict):
            raise MathError('参数格式错误。')
        self.variable = name(request.get('variable', 'x'))
        self.operation = request.get('operation', 'evaluate')
        self.symbols = {}
        self.definitions = {}
        self.functions = {}
        self.nodes = 0
        self.assumption = self.params.get('assumption', 'real')
        self.dependent = name(self.params.get('dependent', 'f' if self.operation == 'recurrence' else 'y'))
        if self.operation in ('dsolve', 'recurrence'):
            self.functions[self.dependent] = (None, None)
        definitions = request.get('definitions', [])
        if not isinstance(definitions, list) or len(definitions) > 100:
            raise MathError('定义表最多支持 100 个定义。')
        for item in definitions:
            if not isinstance(item, dict):
                raise MathError('定义格式错误。')
            key = name(item.get('name'))
            if key in ('e', 'i', 'pi'):
                raise MathError('请勿覆盖数学常数 e、i、pi。')
            if item.get('arguments'):
                argnames = item['arguments']
                if not isinstance(argnames, list) or not 1 <= len(argnames) <= 8:
                    raise MathError('函数支持 1 到 8 个形式参数。')
                old = self.definitions.copy()
                for a in argnames:
                    self.definitions.pop(name(a), None)
                body = self.decode(item['ast'])
                self.definitions = old
                self.functions[key] = ([self.symbol(a) for a in argnames], body)
            else:
                self.definitions[key] = self.decode(item['ast'])

    def symbol(self, value):
        value = name(value)
        if value not in self.symbols:
            assumptions = {}
            if value == self.variable and self.assumption in ('real', 'positive', 'integer'):
                assumptions[self.assumption] = True
            self.symbols[value] = s.Symbol(value, **assumptions)
        return self.symbols[value]

    def call(self, key, arguments):
        key = name(key)
        if key in self.functions:
            params, body = self.functions[key]
            if params is not None:
                if len(params) != len(arguments):
                    raise MathError(f'函数 {key} 需要 {len(params)} 个参数。')
                return body.subs(dict(zip(params, arguments)), simultaneous=True)
        return s.Function(key)(*arguments)

    def decode(self, node, depth=0):
        self.nodes += 1
        if depth > 70 or self.nodes > 12000:
            raise MathError('公式树过大，请拆分计算。')
        d = lambda n: self.decode(n, depth+1)
        if isinstance(node, bool) or node is None:
            raise MathError('不是有效的数学表达式。')
        if isinstance(node, (int, float)):
            if isinstance(node, float) and not math.isfinite(node):
                raise MathError('非法数值。')
            if len(str(node)) > 1200:
                raise MathError('单个数值最多支持 1200 位。')
            return s.Rational(str(node))
        if isinstance(node, str):
            constants = {'Pi': s.pi, 'pi': s.pi, 'ExponentialE': s.E, 'e': s.E,
                         'ImaginaryUnit': s.I, 'i': s.I, 'PositiveInfinity': s.oo,
                         'NegativeInfinity': -s.oo, 'ComplexInfinity': s.zoo,
                         'EulerGamma': s.EulerGamma, 'CatalanConstant': s.Catalan, 'True':s.true,'False':s.false}
            if node in constants:
                return constants[node]
            if node in self.definitions:
                return self.definitions[node]
            if self.operation in ('dsolve', 'recurrence') and node == self.dependent:
                return self.call(node, [self.symbol(self.variable)])
            return self.symbol(node)
        if isinstance(node, dict):
            if 'num' in node and isinstance(node['num'], str) and len(node['num']) < 1200 and NUMBER.fullmatch(node['num']):
                return s.Rational(node['num'])
            if 'sym' in node:
                return d(node['sym'])
            if 'fn' in node:
                return d(node['fn'])
            raise MathError('无法识别数学对象。')
        if not isinstance(node, list) or not node or not isinstance(node[0], str):
            raise MathError('无法识别公式结构。')
        head, *args = node
        if head in ('Error', 'LatexString', 'String', 'Hold'):
            raise MathError('公式未完成或含有不支持的文本。')
        if head in ('InvisibleOperator', 'Multiply'):
            builtins={'Gamma':s.gamma,'gamma':s.gamma,'erf':s.erf,'erfc':s.erfc,'zeta':s.zeta,'beta':s.beta,
                      'LambertW':s.LambertW,'factorial':s.factorial,'binomial':s.binomial,'sinc':s.sinc,
                      'asin':s.asin,'acos':s.acos,'atan':s.atan,'atan2':s.atan2,'abs':s.Abs}
            if len(args) == 2 and isinstance(args[0], str) and isinstance(args[1], list) and args[1][0] == 'Delimiter' and (args[0] in self.functions or args[0] in ('f', 'g', 'h') or args[0] in builtins):
                arg = args[1][1]
                values = [d(a) for a in arg[1:]] if isinstance(arg, list) and arg[0] in ('Sequence','Tuple') else [d(arg)]
                return builtins[args[0]](*values) if args[0] in builtins else self.call(args[0], values)
            return reduce(lambda a,b: a*b, (d(a) for a in args), s.S.One)
        if head == 'Add':
            return reduce(lambda a,b: a+b, (d(a) for a in args), s.S.Zero)
        if head == 'Subtract':
            values = [d(a) for a in args]
            return reduce(lambda a,b: a-b, values[1:], values[0])
        if head == 'Negate': return -d(args[0])
        if head in ('Divide','Rational'): return d(args[0])/d(args[1])
        if head == 'Power': return d(args[0])**d(args[1])
        if head == 'Square': return d(args[0])**2
        if head == 'Sqrt': return s.sqrt(d(args[0]))
        if head == 'Root': return s.real_root(d(args[0]),d(args[1]))
        if head in ('Delimiter', 'Block'): return d(args[0])
        if head in ('List', 'Tuple', 'Sequence'): return [d(a) for a in args]
        if head == 'Matrix':
            rows = d(args[0])
            if not isinstance(rows,list) or not rows or len(rows)>32 or any(not isinstance(r,list) or len(r)!=len(rows[0]) or len(r)>32 for r in rows):
                raise MathError('请输入规则矩阵，最多 32 × 32。')
            return s.Matrix(rows)
        if head in ('Equal','NotEqual','Less','LessEqual','Greater','GreaterEqual'):
            relations = {'Equal':s.Eq,'NotEqual':s.Ne,'Less':s.Lt,'LessEqual':s.Le,'Greater':s.Gt,'GreaterEqual':s.Ge}
            if len(args)!=2: raise MathError('请将连等式拆成多个方程。')
            return relations[head](d(args[0]),d(args[1]),evaluate=False)
        if head in ('And', 'Or', 'Not'):
            return {'And':s.And,'Or':s.Or,'Not':s.Not}[head](*[d(a) for a in args])
        if head=='Which':
            if len(args)%2:raise MathError('分段函数的条件与表达式需成对。')
            return s.Piecewise(*[(d(args[i+1]),d(args[i])) for i in range(0,len(args),2)])
        if head in ('D','Derivative'):
            return s.Derivative(d(args[0]),self.symbol(args[1]),evaluate=False)
        if head == 'Prime':
            order = int(args[1]) if len(args)>1 and isinstance(args[1], (int,float)) else 1
            return s.Derivative(d(args[0]),self.symbol(self.variable),order,evaluate=False)
        if head in ('Integrate','Sum','Product'):
            spec=args[1]
            if isinstance(spec,list) and spec[0] in ('Tuple','Limits') and len(spec)==4:
                spec=(self.symbol(spec[1]),d(spec[2]),d(spec[3]))
            else: spec=self.symbol(spec)
            cls={'Integrate':s.Integral,'Sum':s.Sum,'Product':s.Product}[head]
            return cls(d(args[0]),spec)
        if head == 'Limit':
            fn=args[0]
            if not isinstance(fn,list) or fn[0]!='Function': raise MathError('极限格式错误。')
            point=args[1]; direction='+-'
            if isinstance(point,list) and point[0] in ('PseudoInverse','Superplus','Superminus'):
                direction='-' if point[0]=='Superminus' else '+';point=point[1]
            if len(args)>2: direction='+' if args[2]==1 else '-'
            return s.Limit(d(fn[1]),self.symbol(fn[2]),d(point),dir=direction)
        if head == 'Log': return s.log(d(args[0]),d(args[1]) if len(args)>1 else 10)
        if head == 'Lb': return s.log(d(args[0]),2)
        if head == 'Lg': return s.log(d(args[0]),10)
        if head == 'Apply' and isinstance(args[0],list) and args[0][0]=='InverseFunction':
            inverse={'Sin':s.asin,'Cos':s.acos,'Tan':s.atan,'Sinh':s.asinh,'Cosh':s.acosh,'Tanh':s.atanh}
            if args[0][1] in inverse: return inverse[args[0][1]](d(args[1]))
        funcs={'Sin':s.sin,'Cos':s.cos,'Tan':s.tan,'Cot':s.cot,'Sec':s.sec,'Csc':s.csc,
               'Arcsin':s.asin,'Arccos':s.acos,'Arctan':s.atan,'Arctan2':s.atan2,
               'Sinh':s.sinh,'Cosh':s.cosh,'Tanh':s.tanh,'Arsinh':s.asinh,'Arcosh':s.acosh,'Artanh':s.atanh,
               'Ln':s.log,'Exp':s.exp,'Abs':s.Abs,'Floor':s.floor,'Ceil':s.ceiling,'Sign':s.sign,
               'Factorial':s.factorial,'Gamma':s.gamma,'LogGamma':s.loggamma,'Erf':s.erf,'Erfc':s.erfc,
               'Zeta':s.zeta,'Re':s.re,'Im':s.im,'Conjugate':s.conjugate,'Determinant':s.det,
               'Min':s.Min,'Max':s.Max,'GCD':s.gcd,'LCM':s.lcm,'Binomial':s.binomial}
        if head in funcs:
            values=[d(a) for a in args]
            if head=='Factorial' and values[0].is_number and (values[0]>10000 or values[0]<-10000):
                raise MathError('阶乘数值过大，请使用符号形式。')
            return funcs[head](*values)
        raise MathError(f'尚未识别数学结构 {head}；可通过对应运算的参数面板输入。')

    def parameter(self, key, default):
        return self.decode(self.params[key]) if key in self.params else default

    def variables(self):
        raw=self.params.get('variables', self.variable)
        if not isinstance(raw,str): raise MathError('变量列表格式错误。')
        parts=[v.strip() for v in raw.replace('，',',').split(',') if v.strip()]
        if not 1<=len(parts)<=12: raise MathError('请选择 1 到 12 个变量。')
        return [self.symbol(n) for n in parts]

def residual(e):
    return e.lhs-e.rhs if isinstance(e,s.Equality) else e

def as_matrix(e):
    if isinstance(e,s.MatrixBase):return e
    if isinstance(e,(list,tuple)):return s.Matrix(e)
    raise MathError('此运算需要矩阵或向量，请使用矩阵输入工具。')

def as_list(e):
    if isinstance(e,s.MatrixBase):return list(e)
    if isinstance(e,(list,tuple)):return list(e)
    raise MathError('请输入列表 [a,b,c] 或矩阵。')

def render(result, note='', started=None, approximate=False):
    tex=s.latex(result,mat_str='matrix',mat_delim='[')
    plain=s.sstr(result)
    if len(tex)>160000 or len(plain)>160000: raise MathError('结果超过显示上限，请分步计算。')
    if isinstance(result,s.ConditionSet):note='返回条件集合：当前算法未能将解进一步显式化。'
    if isinstance(result,s.Basic) and result.has(s.Integral,s.Derivative,s.Sum,s.Product,s.Limit):
        note=(note+' 引擎保留了未求值的符号运算；这部分尚未得到显式结果。').strip()
    return {'latex':tex,'plain':plain,'note':note,'elapsed':round((time.monotonic()-(started or time.monotonic()))*1000),
            'approximate':approximate,'engine':'SymPy '+s.__version__,'variables':sorted(str(v) for v in getattr(result,'free_symbols',set()))}

def apply_operation(op,e,ctx):
    p=ctx.params;v=ctx.symbol(ctx.variable)
    point=ctx.parameter('point',s.S.Zero)
    lo=ctx.parameter('lower',s.S.Zero);hi=ctx.parameter('upper',s.S.One)
    order=integer(p.get('order',1),0,30)
    precision=integer(p.get('precision',50),10,500)
    target=ctx.symbol(p.get('target','t'))
    other=lambda:ctx.decode(ctx.request.get('secondary'))
    note='';approximate=False
    unary={'simplify':s.simplify,'expand':s.expand,'factor':s.factor,'cancel':s.cancel,'together':s.together,
           'trigsimp':s.trigsimp,'expand_trig':s.expand_trig,'powsimp':s.powsimp,'expand_log':s.expand_log,
           'logcombine':s.logcombine,'radsimp':s.radsimp,'real':s.re,'imag':s.im,'conjugate':s.conjugate,
           'abs':s.Abs,'arg':s.arg,'expand_complex':s.expand_complex}
    if op=='evaluate':
        result=[x.doit() if hasattr(x,'doit') else x for x in e] if isinstance(e,list) else e.doit()
        if isinstance(e,s.Integral) and any(len(l)==1 for l in e.limits):result+=s.Symbol('C');note='C 为任意积分常数。'
    elif op in unary:result=unary[op](e)
    elif op=='apart':result=s.apart(e,v)
    elif op=='collect':result=s.collect(s.expand(e),v)
    elif op=='substitute':result=e.subs(v,point)
    elif op in ('poly_div','poly_gcd','poly_lcm','resultant'):
        a,b=residual(e),residual(other());result={'poly_div':s.div,'poly_gcd':s.gcd,'poly_lcm':s.lcm,'resultant':s.resultant}[op](a,b,v)
        if op=='poly_div':note='结果依次为商与余式。'
    elif op=='discriminant':result=s.discriminant(residual(e),v)
    elif op=='groebner':result=list(s.groebner([residual(a) for a in as_list(e)],*ctx.variables(),order='lex').polys);result=[q.as_expr() for q in result]
    elif op=='solve':
        domain=s.S.Complexes if p.get('domain')=='complex' else s.S.Reals
        result=s.solveset(residual(e),v,domain=domain)
        note='解集保留自由参数与周期结构；条件集合表示未能显式求解的部分。'
    elif op=='solve_system':
        result=s.nonlinsolve([residual(a) for a in as_list(e)],ctx.variables())
        note='各元组的分量顺序：'+', '.join(map(str,ctx.variables()))+'。非线性参数退化情形仍需结合原式判断。'
    elif op=='inequality':result=s.reduce_inequalities(e if isinstance(e,list) else [e],v)
    elif op=='nsolve':result=s.nsolve(residual(e),v,point,prec=precision);approximate=True;note='由初值出发找到的数值根，不代表全部根。'
    elif op=='nroots':result=s.nroots(residual(e),n=precision,maxsteps=300);approximate=True
    elif op=='diophantine':
        vs=sorted(residual(e).free_symbols,key=str);result=s.diophantine(residual(e),syms=vs);note='各元组变量顺序：'+', '.join(map(str,vs))+'；参数取整数。'
    elif op in ('dsolve','recurrence'):
        fn=ctx.call(ctx.dependent,[v]);initials={};initial_point=ctx.parameter('initial_point',s.S.Zero)
        if 'initial_value' in p:initials[fn.subs(v,initial_point)]=ctx.parameter('initial_value',s.S.Zero)
        if 'initial_slope' in p:
            key=s.diff(fn,v).subs(v,initial_point) if op=='dsolve' else fn.subs(v,initial_point+1)
            initials[key]=ctx.parameter('initial_slope',s.S.Zero)
        if op=='dsolve':result=s.dsolve(e,fn,ics=initials or None)
        else:result=s.rsolve(residual(e),fn,init=initials or None)
        note='已应用指定的初始条件；剩余 C₁、C₂… 为自由常数。' if initials else '未指定初始条件，保留任意常数。'
    elif op=='diff':
        if order>12:raise MathError('一次微分最多支持 12 阶。')
        result=s.diff(e,v,order)
    elif op=='integrate':
        result=e.doit() if isinstance(e,s.Integral) else s.integrate(e,v)
        if not isinstance(e,s.Integral) or any(len(l)==1 for l in e.limits):result+=s.Symbol('C');note='C 为任意积分常数。'
    elif op=='definite':
        result=e.doit() if isinstance(e,s.Integral) else s.integrate(e,(v,lo,hi))
        note='反常积分按通常收敛意义计算，不以柯西主值替代。'
        if result.has(s.oo,-s.oo,s.zoo,s.nan):note='积分发散或在给定条件下不存在有限值。'
    elif op=='limit':
        direction=p.get('direction','+-')
        if direction not in ('+-','+','-'):raise MathError('极限方向参数错误。')
        result=s.limit(e,v,point,dir=direction)
    elif op=='series':result=s.series(e,v,point,order)
    elif op=='summation':result=s.summation(e,(v,lo,hi))
    elif op=='product':result=s.product(e,(v,lo,hi))
    elif op=='laplace':result=s.laplace_transform(e,v,target);note='结果依次为变换、收敛横坐标和附加条件。'
    elif op=='inverse_laplace':result=s.inverse_laplace_transform(e,v,target)
    elif op=='fourier':result=s.fourier_transform(e,v,target);note='采用 exp(−2πi·x·k) 的 Fourier 约定。'
    elif op=='inverse_fourier':result=s.inverse_fourier_transform(e,v,target);note='采用 exp(+2πi·x·k) 的逆 Fourier 约定。'
    elif op=='gradient':result=s.Matrix([s.diff(e,x) for x in ctx.variables()])
    elif op=='hessian':result=s.hessian(e,ctx.variables())
    elif op=='jacobian':result=as_matrix(e).jacobian(ctx.variables())
    elif op=='numeric_integral':result=s.Integral(e,(v,lo,hi)).evalf(precision,maxn=precision*3);approximate=True;note=f'目标精度 {precision} 位；振荡与奇点可能影响数值收敛，请结合误差判断。'
    elif op=='numeric':result=e.evalf(precision) if hasattr(e,'evalf') else [x.evalf(precision) for x in e];approximate=True
    elif op in ('determinant','invert','transpose','rank','rref','nullspace','columnspace','eigenvals','eigenvects','diagonalize','charpoly','trace','lu','qr','cholesky','svd','norm','matrixexp'):
        a=as_matrix(e)
        methods={'determinant':'det','invert':'inv','transpose':'transpose','rank':'rank','rref':'rref',
                 'nullspace':'nullspace','columnspace':'columnspace','eigenvals':'eigenvals','eigenvects':'eigenvects',
                 'diagonalize':'diagonalize','trace':'trace','lu':'LUdecomposition','qr':'QRdecomposition',
                 'cholesky':'cholesky','svd':'singular_value_decomposition','norm':'norm','matrixexp':'exp'}
        result=a.charpoly(v).as_expr() if op=='charpoly' else getattr(a,methods[op])()
        note={'rref':'结果依次为行最简矩阵与主元列索引（从 0 开始）。','diagonalize':'结果依次为 P、D，满足 A = PDP⁻¹。','lu':'结果依次为 L、U、行置换列表。','qr':'结果依次为 Q、R。','svd':'结果依次为 U、Σ、V，满足 A = UΣVᴴ；采用约化分解。'}.get(op,'')
    elif op in ('dot','cross'):result=getattr(as_matrix(e),op)(as_matrix(other()))
    elif op=='linear_solve':result=as_matrix(e).gauss_jordan_solve(as_matrix(other()));note='结果依次为解向量与自由参数向量。'
    elif op in ('factorint','isprime','nextprime','prevprime','divisors','totient','fibonacci','bernoulli','continued_fraction'):
        if op!='continued_fraction' and e.is_Integer is not True:raise MathError('此数论运算需要整数。')
        if op in ('factorint','isprime','nextprime','prevprime') and len(str(abs(e)))>200:raise MathError('交互数论计算最多支持 200 位整数。')
        if op in ('fibonacci','bernoulli') and abs(e)>2000:raise MathError('序号过大，请将序号控制在 2000 以内。')
        result=getattr(s,op)(e)
    elif op in ('gcd','lcm'):result=getattr(s,op)(e,other())
    elif op=='mod_inverse':result=s.mod_inverse(e,ctx.parameter('modulus',s.Integer(11)))
    elif op=='mod_power':result=s.Integer(pow(int(e),integer(p.get('exponent',3),0,1000000),int(ctx.parameter('modulus',s.Integer(11)))))
    elif op=='binomial':result=s.binomial(e,order)
    elif op=='permutations':result=s.ff(e,order)
    elif op=='polar':result=(s.Abs(e),s.arg(e));note='结果依次为模、主辐角（弧度）。'
    elif op in ('mean','median','variance','stddev','describe'):
        values=as_list(e)
        if not values or len(values)>2000:raise MathError('统计数据数量需为 1 到 2000。')
        if any(a.is_real is False or a.free_symbols for a in values):raise MathError('描述统计需要实数数据。')
        n=len(values);avg=s.Add(*values)/n;var=s.Add(*[(a-avg)**2 for a in values])/n
        ordered=sorted(values,key=lambda x:float(x));median=ordered[n//2] if n%2 else (ordered[n//2-1]+ordered[n//2])/2
        result={'mean':avg,'median':median,'variance':var,'stddev':s.sqrt(var),
                'describe':s.Matrix([[n,avg,median,ordered[0],ordered[-1],var,s.sqrt(var)]])}[op]
        if op=='describe':note='各列依次为：数量、均值、中位数、最小值、最大值、总体方差、总体标准差。'
    elif op in ('correlation','linear_fit','polynomial_fit'):
        a=as_matrix(e)
        if a.cols!=2 or a.rows<2:raise MathError('请输入至少两行的两列矩阵，每行为 (x,y)。')
        xs=list(a[:,0]);ys=list(a[:,1]);n=len(xs)
        if op=='correlation':
            ax=s.Add(*xs)/n;ay=s.Add(*ys)/n
            result=s.simplify(s.Add(*[(x-ax)*(y-ay) for x,y in zip(xs,ys)])/s.sqrt(s.Add(*[(x-ax)**2 for x in xs])*s.Add(*[(y-ay)**2 for y in ys])))
        else:
            degree=1 if op=='linear_fit' else order
            if degree>12 or degree>=n:raise MathError('拟合阶数需小于数据点数，且不超过 12。')
            design=s.Matrix([[x**k for k in range(degree+1)] for x in xs]);co=(design.T*design).inv()*design.T*s.Matrix(ys)
            result=s.Add(*[co[k]*v**k for k in range(degree+1)]);note='普通最小二乘拟合；数据应为实数且设计矩阵满列秩。'
    elif op=='normal_pdf':result=s.exp(-e**2/2)/s.sqrt(2*s.pi)
    elif op=='normal_cdf':result=(1+s.erf(e/s.sqrt(2)))/2
    elif op in ('distance','midpoint'):
        a=Point(*as_list(e));b=Point(*as_list(other()));result=a.distance(b) if op=='distance' else a.midpoint(b)
    elif op in ('triangle_area','triangle_centroid','polygon_area','circumcircle','line_intersection','point_line_distance'):
        a=as_matrix(e)
        if a.cols!=2:raise MathError('此平面几何运算需要两列点坐标。')
        points=[Point(*a.row(i)) for i in range(a.rows)]
        if op in ('triangle_area','triangle_centroid','circumcircle'):
            if len(points)!=3:raise MathError('需要恰好三个非共线点。')
            triangle=Triangle(*points)
            if not isinstance(triangle,Triangle):raise MathError('三点共线，不能构造三角形或外接圆。')
            result={'triangle_area':lambda:abs(triangle.area),'triangle_centroid':lambda:triangle.centroid,
                    'circumcircle':lambda:(triangle.circumcircle.center,triangle.circumcircle.radius)}[op]()
            if op=='circumcircle':note='结果依次为圆心和半径。'
        elif op=='polygon_area':result=abs(Polygon(*points).area)
        elif op=='line_intersection':
            if len(points)!=4:raise MathError('需要四行点坐标。')
            result=Line(points[0],points[1]).intersection(Line(points[2],points[3]))
        else:
            if len(points)!=3:raise MathError('需要三行点坐标：点、直线上的两个点。')
            result=Line(points[1],points[2]).distance(points[0])
    else:raise MathError('未知运算，请更新功能目录。')
    if result is None:raise MathError('当前算法未得到结果。请检查数学条件或尝试其他形式。')
    if op in ('simplify','cancel','together','apart','factor','expand'):
        if s.denom(residual(e))!=1:note=(note+' 变形结果沿用原表达式定义域。').strip()
    if isinstance(e,s.Integral) and isinstance(result,s.Basic) and result.has(s.oo,-s.oo,s.zoo,s.nan):note='积分发散或在当前条件下不存在有限值。'
    return result,note,approximate

def calculate(request):
    started=time.monotonic();ctx=Context(request)
    op=request.get('operation','evaluate')
    if op not in OP_IDS and op!='pipeline':raise MathError('没有注册这项运算。')
    e=ctx.decode(request.get('ast'))
    if op=='pipeline':
        steps=request.get('steps',[])
        allowed={'simplify','expand','factor','cancel','together','apart','trigsimp','expand_trig','powsimp','radsimp','diff','integrate','substitute','numeric','transpose','invert'}
        if not isinstance(steps,list) or not 1<=len(steps)<=20:raise MathError('流水线需包含 1 到 20 个步骤。')
        report=[]
        for step in steps:
            if step not in allowed:raise MathError('流水线包含不支持的步骤。')
            e,note,approx=apply_operation(step,e,ctx);report.append({'operation':step,**render(e,note,started,approx)})
        result=render(e,'已按顺序执行全部转换步骤。',started);result['steps']=report;return result
    result,note,approximate=apply_operation(op,e,ctx)
    return render(result,note,started,approximate)

def plot(request):
    started=time.monotonic();ctx=Context(request)
    kind=request.get('kind','cartesian')
    v=ctx.symbol(ctx.variable);w=ctx.symbol(request.get('secondVariable','y'))
    xmin,xmax=[float(x) for x in request.get('xRange',[-6,6])]
    ymin,ymax=[float(x) for x in request.get('yRange',[-6,6])]
    if not all(math.isfinite(x) for x in (xmin,xmax,ymin,ymax)) or not 1e-7<xmax-xmin<=1e6 or not 1e-7<ymax-ymin<=1e6:raise MathError('坐标范围错误。')
    expressions=request.get('asts',[])
    if not isinstance(expressions,list) or not 1<=len(expressions)<=6:raise MathError('一次支持 1 到 6 条曲线。')
    exprs=[ctx.decode(n) for n in expressions]
    def compile_expr(expr,args):
        if isinstance(expr,s.Equality):expr=expr.rhs if str(expr.lhs) in ('y','z') and kind!='implicit' else expr.lhs-expr.rhs
        if not isinstance(expr,s.Expr) or expr.free_symbols-set(args) or expr.atoms(AppliedUndef):raise MathError('图像含未赋值的变量或自定义函数；请先代入参数。')
        return s.lambdify(args,expr,modules='mpmath',cse=True,docstring_limit=0)
    def finite(fn,*args):
        try:
            z=complex(fn(*args))
            return float(z.real) if abs(z.imag)<1e-9 and math.isfinite(z.real) and abs(z.real)<1e10 else None
        except (ValueError,TypeError,ZeroDivisionError,OverflowError):return None
    if kind in ('surface','implicit'):
        size=integer(request.get('resolution',55),20,100)
        fn=compile_expr(exprs[0],[v,w]);points=[]
        for j in range(size):
            y=ymin+(ymax-ymin)*j/(size-1)
            for i in range(size):
                x=xmin+(xmax-xmin)*i/(size-1);points.append([x,y,finite(fn,x,y)])
        if not any(p[2] is not None for p in points):raise MathError('该范围内没有可绘制的实数值。')
        return {'kind':kind,'grid':points,'resolution':size,'xRange':[xmin,xmax],'yRange':[ymin,ymax],'elapsed':round((time.monotonic()-started)*1000)}
    curves=[];count=1000
    if kind=='parametric':
        pair=exprs[0] if isinstance(exprs[0],list) else exprs
        if len(pair)!=2:raise MathError('参数曲线需要两个坐标表达式。')
        fx,fy=[compile_expr(e,[v]) for e in pair];points=[]
        for i in range(count+1):
            t=xmin+(xmax-xmin)*i/count;x=finite(fx,t);y=finite(fy,t);points.append([x,y])
        curves.append(points)
    else:
        for e in exprs:
            fn=compile_expr(e,[v]);points=[]
            for i in range(count+1):
                t=xmin+(xmax-xmin)*i/count;y=finite(fn,t)
                points.append([t,y] if kind=='cartesian' else [None,None] if y is None else [y*math.cos(t),y*math.sin(t)])
            if not any(p[1] is not None for p in points):raise MathError('该区间内没有可绘制的实数点。')
            curves.append(points)
    return {'kind':kind,'curves':curves,'xRange':[xmin,xmax],'yRange':[ymin,ymax],'elapsed':round((time.monotonic()-started)*1000)}
