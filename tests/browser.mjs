import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const origin=process.env.TEST_URL||'http://127.0.0.1:5173';
const browser=await chromium.launch({args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],external=[];const context=await browser.newContext({viewport:{width:1600,height:1050},acceptDownloads:true});
context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
await context.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin)||url.startsWith('data:')||url.startsWith('blob:'))return route.continue();external.push(url);return route.abort();});
const page=await context.newPage();page.setDefaultTimeout(18000);
async function setFormula(latex,label='数学公式输入'){await page.locator('math-field').and(page.getByLabel(label,{exact:true})).evaluate((f,v)=>{f.value=v;f.dispatchEvent(new InputEvent('input',{bubbles:true}));},latex);}
async function choose(id){await page.getByLabel('搜索运算',{exact:true}).fill(id);const button=page.locator('.category-operations button').filter({has:page.locator(`small:text-is("${id}")`)});await button.click();await page.getByLabel('搜索运算',{exact:true}).fill('');}
async function mode(label){await page.locator('.workspace-mode-tabs').getByRole('button',{name:label,exact:true}).click();}
async function result(action=()=>page.getByRole('button',{name:'计算',exact:true}).click()){const n=await page.locator('.result-cell').count();await action();await page.waitForFunction(n=>document.querySelectorAll('.result-cell').length===n+1,n,{timeout:25000});return page.locator('.cell-output [role=math]').last().getAttribute('aria-label');}
try{
 await page.goto(origin);await page.waitForSelector('.kernel-status.online');await page.waitForSelector('.function-path');
 assert.match(await result(),/sqrt.*pi/);
 await page.locator('math-field[aria-label="数学公式输入"]').evaluate(f=>f.focus());await page.waitForFunction(()=>document.activeElement?.tagName==='MATH-FIELD');await page.waitForTimeout(150);await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('1/2',{delay:45});
 assert.equal(await result(()=>page.keyboard.press('Enter')),'\\frac{1}{2}');
 console.log('✓ Industrial workbench, server kernel, real keyboard math input, exact improper integral');
 await choose('solve');await setFormula('\\sin x=0');assert.match(await result(),/mathbb\{Z\}/);
 await choose('solve_system');await page.locator('.input-mode-tabs').getByRole('button',{name:'方程组',exact:true}).click();assert.match(await result(),/2.*1/);
 await choose('eigenvals');await page.locator('.input-mode-tabs').getByRole('button',{name:'矩阵',exact:true}).click();await setFormula('2','矩阵第1行第1列');await setFormula('1','矩阵第1行第2列');await setFormula('1','矩阵第2行第1列');await setFormula('2','矩阵第2行第2列');assert.match(await result(),/3/);
 await choose('dsolve');await page.locator('.input-mode-tabs').getByRole('button',{name:'公式',exact:true}).click();await setFormula('y^{\\prime\\prime}+y=0');assert.match(await result(),/C_\{1\}/);
 await choose('limit');await setFormula('1/x');await page.getByLabel('极限方向',{exact:true}).selectOption('+');assert.match(await result(),/infty/);
 await choose('numeric');await setFormula('\\pi');await page.getByLabel('有效位数',{exact:true}).fill('80');assert.ok((await result()).length>70);
 console.log('✓ Periodic solving, structured equation systems, matrix eigenvalues, ODE, one-sided limits, 80 digits');
 await choose('evaluate');await page.getByRole('button',{name:'添加变量或函数',exact:true}).click();await page.getByLabel('定义名称').fill('a');await setFormula('2','数学定义');await page.getByRole('button',{name:'保存定义',exact:true}).click();await page.waitForSelector('dialog[open]',{state:'detached'});
 await page.getByRole('button',{name:'添加变量或函数',exact:true}).click();await page.getByLabel('定义名称').fill('f');await page.getByLabel('函数形式参数').fill('x');await setFormula('x^2+a','数学定义');await page.getByRole('button',{name:'保存定义',exact:true}).click();await page.waitForSelector('dialog[open]',{state:'detached'});await setFormula('f(3)');assert.equal(await result(),'11');
 console.log('✓ Persistent constant definitions and custom mathematical functions');
 await mode('数据工作表');await page.getByLabel('单元格A8',{exact:true}).fill('=SUM(A2:A7)');await page.getByLabel('单元格B8',{exact:true}).click();assert.equal(await page.getByLabel('单元格A8',{exact:true}).inputValue(),'21');await page.getByLabel('单元格A2',{exact:true}).fill('10');await page.getByLabel('单元格B8',{exact:true}).click();assert.equal(await page.getByLabel('单元格A8',{exact:true}).inputValue(),'30');
 await page.getByRole('button',{name:/A \/ B → 线性拟合/}).click();assert.equal(await page.locator('.console-header strong').innerText(),'线性最小二乘拟合');assert.match(await result(),/x/);
 console.log('✓ Spreadsheet cell references, live recomputation, data-to-symbolic regression');
 await mode('动态几何');await page.getByRole('button',{name:'中点',exact:true}).click();await page.locator('.geometry-point').filter({has:page.locator('text:text-is("A")')}).locator('circle').first().click({force:true});await page.locator('.geometry-point').filter({has:page.locator('text:text-is("B")')}).locator('circle').first().click({force:true});
 assert.equal(await page.locator('.geometry-point').count(),4);
 await page.getByRole('button',{name:'选择 / 拖动',exact:true}).click();const canvas=await page.locator('.geometry-canvas').boundingBox();const x=canvas.x+315/900*canvas.width,y=canvas.y+380/580*canvas.height;
 await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+40,y-20,{steps:8});await page.mouse.up();
 const geometry=await page.evaluate(()=>JSON.parse(localStorage.getItem('moyu.workbooks.v1')).find(b=>b.geometry)?.geometry);assert.ok(geometry.points[0].x!==-3);assert.equal(geometry.points[3].construction,'midpoint');
 console.log('✓ Dynamic geometry: linked midpoint creation and free-point dragging');
 await choose('diff');await page.getByLabel('微分阶数',{exact:true}).fill('1');await setFormula('(x+1)^3');await mode('计算流水线');await page.getByRole('button',{name:'运行流水线',exact:true}).click();await page.waitForSelector('.pipeline-trace');assert.match(await page.locator('.cell-output [role=math]').last().getAttribute('aria-label'),/3.*x.*1/);
 await mode('图形引擎');await page.getByRole('button',{name:'三维',exact:true}).click();await page.getByRole('button',{name:'生成图像',exact:true}).click();await page.waitForSelector('.surface canvas',{timeout:25000});await page.waitForTimeout(500);await page.screenshot({path:'/tmp/moyu-industrial-surface.png'});
 assert.ok(await page.locator('.surface canvas').evaluate(c=>c.toDataURL().length)>5000);
 await page.getByRole('button',{name:'隐式',exact:true}).click();await page.getByRole('button',{name:'生成图像',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.graph-readout')?.textContent.includes('NUMERICAL')&&!document.querySelector('.graph-message'));assert.ok(await page.locator('.graph-viewport path[stroke="#f4a34f"]').count()>0);
 console.log('✓ Visual pipeline intermediate results, WebGL 3D surface, implicit-curve sampling');
 await mode('符号计算');await page.getByLabel('工作表名称',{exact:true}).fill('工业工作站回归测试');const count=await page.locator('.result-cell').count();
 const downloadEvent=page.waitForEvent('download');await page.locator('.document-tools').getByRole('button',{name:'导出',exact:true}).click();const download=await downloadEvent;const file=await download.path();const json=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(json.version,2);assert.equal(json.workbook.entries.length,count);assert.equal(json.workbook.definitions.length,2);assert.ok(json.workbook.geometry);assert.ok(json.workbook.sheet);
 await page.reload();await page.waitForSelector('.kernel-status.online');assert.equal(await page.locator('.result-cell').count(),count);
 await page.locator('input[type=file][accept=".json,application/json"]').setInputFiles({name:'test.json',mimeType:'application/json',buffer:readFileSync(file)});await page.waitForFunction(()=>document.querySelectorAll('.document-tabs>button').length>=3);
 assert.equal(await page.locator('.result-cell').count(),count);await page.screenshot({path:'/tmp/moyu-industrial-desktop.png'});
 console.log('✓ Complete workbook export/import, definitions + geometry + sheet, reload persistence');
 const mobile=await context.newPage();await mobile.setViewportSize({width:390,height:844});await mobile.goto(origin);await mobile.waitForSelector('math-field');assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
 await mobile.getByRole('button',{name:'显示函数浏览器'}).click();await mobile.waitForSelector('.function-browser.mobile-open');await mobile.getByRole('button',{name:'关闭函数浏览器'}).click();await mobile.screenshot({path:'/tmp/moyu-industrial-mobile.png'});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('✓ 390px layout, mobile function explorer, no script errors or third-party requests');
}finally{await browser.close();}
