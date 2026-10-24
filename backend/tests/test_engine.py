import json
import signal
import subprocess
import unittest
import sympy as s
from backend.engine import calculate, Context, plot, CATALOG, MathError

def calc(ast, operation='evaluate', **options):
    return calculate({'ast':ast,'operation':operation,'variable':'x',**options})

class KernelTests(unittest.TestCase):
    def test_all_registered_examples_through_real_formula_parser(self):
        fixtures=json.loads(subprocess.check_output(['node','--import','tsx','scripts/catalog-fixtures.ts']))
        self.assertEqual(len(fixtures),len(CATALOG))
        for request in fixtures:
            with self.subTest(operation=request['operation']):
                signal.alarm(10)
                try:
                    result=calculate(request)
                    self.assertTrue(result['latex']);self.assertNotEqual(result['plain'],'None')
                finally:signal.alarm(0)

    def test_exact_arithmetic_and_transcendental_values(self):
        self.assertEqual(calc(['Add',['Divide',1,3],['Divide',1,6]])['plain'],'1/2')
        self.assertEqual(calc(['Sin',1],'simplify')['plain'],'sin(1)')
        self.assertEqual(calc(['Sqrt',['Power','x',2]],'simplify')['plain'],'Abs(x)')
        self.assertEqual(calc(['Divide',['Subtract',['Power','x',2],1],['Subtract','x',1]],'cancel')['plain'],'x + 1')

    def test_complete_periodic_solution_and_equation_systems(self):
        result=calc(['Equal',['Sin','x'],0],'solve')
        self.assertIn('ImageSet',result['plain'])
        result=calc(['List',['Equal',['Add','x','y'],3],['Equal',['Subtract','x','y'],1]],'solve_system',params={'variables':'x,y'})
        self.assertEqual(result['plain'],'{(2, 1)}')
        self.assertEqual(calc(['Equal','x','x'],'solve')['plain'],'Reals')
        self.assertEqual(calc(['Equal','x',['Add','x',1]],'solve')['plain'],'EmptySet')

    def test_improper_integrals_limits_and_high_order_derivatives(self):
        gaussian=['Integrate',['Power','ExponentialE',['Negate',['Power','x',2]]],['Tuple','x',0,'PositiveInfinity']]
        self.assertEqual(calc(gaussian)['plain'],'sqrt(pi)/2')
        self.assertEqual(calc(['Integrate',['Divide',1,['Power','x',2]],['Tuple','x',-1,1]])['plain'],'oo')
        self.assertEqual(calc(['Divide',1,'x'],'limit',params={'point':0,'direction':'+'})['plain'],'oo')
        self.assertEqual(calc(['Divide',1,'x'],'limit',params={'point':0,'direction':'-'})['plain'],'-oo')
        self.assertEqual(calc(['Power','x',6],'diff',params={'order':4})['plain'],'360*x**2')
        self.assertEqual(calc(['Divide',1,['Add',1,['Power','x',2]]],'definite',params={'lower':0,'upper':1})['plain'],'pi/4')

    def test_matrix_decompositions_and_eigenvectors(self):
        matrix=['Matrix',['List',['List',2,1],['List',1,2]]]
        self.assertEqual(calc(matrix,'determinant')['plain'],'3')
        self.assertEqual(calc(matrix,'eigenvals')['plain'],'{1: 1, 3: 1}')
        inverse=Context({}).decode(matrix).inv()
        self.assertEqual(inverse*s.Matrix([[2,1],[1,2]]),s.eye(2))
        with self.assertRaises(Exception):calc(['Matrix',['List',['List',1,2],['List',2,4]]],'invert')

    def test_functions_definitions_ode_recurrence_and_pipeline(self):
        defs=[{'name':'a','ast':2},{'name':'f','arguments':['x'],'ast':['Add',['Power','x',2],'a']}]
        result=calc(['InvisibleOperator','f',['Delimiter',3]],definitions=defs)
        self.assertEqual(result['plain'],'11')
        ode=calc(['Equal',['Add',['Prime','y',2],'y'],0],'dsolve')
        self.assertIn('C1',ode['plain']);self.assertIn('sin(x)',ode['plain'])
        ode=calc(['Equal',['Add',['Prime','y',2],'y'],0],'dsolve',params={'initial_point':0,'initial_value':1,'initial_slope':0})
        self.assertEqual(ode['plain'],'Eq(y(x), cos(x))')
        result=calculate({'ast':['Power',['Add','x',1],3],'operation':'pipeline','variable':'x','steps':['expand','diff','factor']})
        self.assertEqual(len(result['steps']),3);self.assertEqual(result['plain'],'3*(x + 1)**2')

    def test_statistics_geometry_precision_and_assumptions(self):
        self.assertEqual(calc(['List',2,4,4,4,5,5,7,9],'variance')['plain'],'4')
        self.assertEqual(calc(['List',0,0],'distance',secondary=['List',3,4])['plain'],'5')
        self.assertTrue(calc('Pi','numeric',params={'precision':100})['plain'].startswith('3.14159265358979323846264338327950288419716939937510'))
        self.assertEqual(calc(['Sqrt',['Power','x',2]],'simplify',params={'assumption':'positive'})['plain'],'x')

    def test_untrusted_nodes_never_enter_python_parser(self):
        for node in ('__import__','x.__class__',{'str':'open("/etc/passwd")'},['Apply','open','x'],['Power','x',{'num':'1);exec(1)'}]):
            with self.subTest(node=node),self.assertRaises((MathError,TypeError)):calc(node)
        with self.assertRaises(MathError):calc(2,'not-a-function')

    def test_cartesian_parametric_polar_implicit_and_surface_sampling(self):
        result=plot({'asts':[['Sin','x']],'variable':'x','xRange':[-1,1]})
        self.assertEqual(result['curves'][0][500],[0.0,0.0])
        result=plot({'asts':[['List',['Cos','t'],['Sin','t']]],'variable':'t','kind':'parametric','xRange':[-1,1]})
        self.assertEqual(result['curves'][0][500],[1.0,0.0])
        result=plot({'asts':[['Add',['Power','x',2],['Power','y',2]]],'variable':'x','kind':'surface','resolution':20,'xRange':[-2,2],'yRange':[-2,2]})
        self.assertEqual(len(result['grid']),400);self.assertEqual(result['grid'][0][2],8.0)
        with self.assertRaises(MathError):plot({'asts':[['Add','x','a']],'variable':'x'})

if __name__=='__main__':unittest.main()
