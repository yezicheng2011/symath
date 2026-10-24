import {useEffect,useRef,useState} from 'react';
import type {GraphResult} from './types';
export function Surface({data,wireframe}:{data:GraphResult;wireframe:boolean}){
  const host=useRef<HTMLDivElement>(null);const [error,setError]=useState('');
  useEffect(()=>{
    let cleanup=()=>{};let disposed=false;setError('');
    void (async()=>{
      const THREE=await import('three');const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');
      if(disposed||!host.current)return;
      const node=host.current;
      let renderer:InstanceType<typeof THREE.WebGLRenderer>;
      try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});}catch{setError('当前浏览器无法启动 WebGL。请启用硬件加速后重试。');return;}
      renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#101318');node.appendChild(renderer.domElement);
      const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(42,1,.01,10000);
      const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.1;
      const grid=data.grid!;const size=data.resolution!;const positions:number[]=[];const colors:number[]=[];const indices:number[]=[];
      const zs=grid.map(p=>p[2]).filter((v):v is number=>v!==null).sort((a,b)=>a-b);
      const low=zs[Math.floor(zs.length*.02)]||0,high=zs[Math.floor((zs.length-1)*.98)]||1;
      const color=new THREE.Color();
      grid.forEach(([x,y,z])=>{positions.push(x,z??0,y);const t=Math.max(0,Math.min(1,((z??low)-low)/(high-low||1)));color.setHSL(.1+.42*(1-t),.7,.4+.12*t);colors.push(color.r,color.g,color.b);});
      for(let j=0;j<size-1;j++)for(let i=0;i<size-1;i++){
        const a=j*size+i,b=a+1,c=a+size,d=c+1;
        if([a,b,c,d].every(k=>grid[k][2]!==null))indices.push(a,c,b,b,c,d);
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.65,metalness:.1,wireframe});
      const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
      const span=Math.max(data.xRange[1]-data.xRange[0],data.yRange[1]-data.yRange[0],high-low,2);
      const ground=new THREE.GridHelper(Math.max(data.xRange[1]-data.xRange[0],data.yRange[1]-data.yRange[0])*1.4,16,'#5d5142','#2d343c');scene.add(ground);
      const axes=new THREE.AxesHelper(span*.6);scene.add(axes);scene.add(new THREE.HemisphereLight(0xffffff,0x27303a,2.5));const light=new THREE.DirectionalLight(0xffdfab,3);light.position.set(3,8,5);scene.add(light);
      const center=new THREE.Vector3((data.xRange[0]+data.xRange[1])/2,(low+high)/2,(data.yRange[0]+data.yRange[1])/2);
      controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(span*1.4,span*1.1,span*1.4));camera.lookAt(center);
      const resize=new ResizeObserver(()=>{const w=node.clientWidth,h=Math.max(node.clientHeight,250);renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(node);
      let frame=0;const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera);};animate();
      cleanup=()=>{cancelAnimationFrame(frame);resize.disconnect();controls.dispose();geometry.dispose();material.dispose();ground.geometry.dispose();(ground.material as InstanceType<typeof THREE.Material>).dispose();axes.geometry.dispose();(axes.material as InstanceType<typeof THREE.Material>).dispose();renderer.dispose();renderer.domElement.remove();};
      if(disposed)cleanup();
    })().catch(e=>setError((e as Error).message));
    return()=>{disposed=true;cleanup();};
  },[data,wireframe]);
  return <div className="surface" ref={host} aria-label="三维曲面，可拖动旋转与滚轮缩放">{error&&<div className="graph-message error">{error}</div>}<div className="surface-instructions">LMB 旋转　RMB 平移　SCROLL 缩放</div></div>;
}
