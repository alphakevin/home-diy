import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

// World units are metres; all displayed and input dimensions are millimetres.
const $ = id => document.getElementById(id);
const viewport = $('viewport');
const initial = { left:0, right:0, panel:true, shelf:false, stove:100, gap:8, reference:'top', dims:'installation', view:'perspective' };
const state = { ...initial };
const C = { bottom:.865, ceiling:1.565, opening:.760, depth:.380, board:.018, railBottom:1.057, railTop:1.137 };
const colors = { measured:'#24766b', product:'#3f6ea6', derived:'#b5632c' };
let renderer, scene, camera, controls, hood, duct, panel, shelf, stove, leftHinge, rightHinge;
let dimRecords = [], cameraTween = null, dragStart = null;
const doorMeshes = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = new THREE.Clock();
const v = a => new THREE.Vector3(...a);
const topY = () => C.bottom - state.gap/1000;
const installDistance = () => 865 - state.gap - state.stove - (state.reference === 'bottom' ? 192 : 0);

const mat = (color, roughness=.65, metalness=0) => new THREE.MeshStandardMaterial({color,roughness,metalness});
const materials = {
  cabinet:mat('#dedfd8'), inside:mat('#f1f0e9'), edge:mat('#d2d5cd'), black:mat('#20272a',.35,.48),
  glass:mat('#12191c',.18,.42), filter:mat('#343e41',.5,.65), metal:mat('#a7b0b1',.36,.78),
  wall:mat('#e9e9e4'), tile:mat('#dedfd9'), stone:mat('#f1f2ee',.65,.08), stove:mat('#23282a',.2,.4),
  shelf:new THREE.MeshStandardMaterial({color:'#cf8653',transparent:true,opacity:.55,roughness:.75,depthWrite:false}),
  light:new THREE.MeshStandardMaterial({color:'#fff4d6',emissive:'#fff0ce',emissiveIntensity:1.7}),
  // Display materials separate the hood parts without relying on an environment map.
  hoodCase:new THREE.MeshStandardMaterial({color:'#64717c',roughness:.48,metalness:.16,emissive:'#34424c',emissiveIntensity:.10}),
  hoodRim:new THREE.MeshStandardMaterial({color:'#53616c',roughness:.36,metalness:.22,emissive:'#34424c',emissiveIntensity:.08}),
  hoodBody:new THREE.MeshStandardMaterial({color:'#46535e',roughness:.52,metalness:.12,emissive:'#34424c',emissiveIntensity:.10}),
  hoodFilter:new THREE.MeshStandardMaterial({color:'#8b969e',roughness:.58,metalness:.18,side:THREE.DoubleSide}),
  hoodGlass:mat('#26343f',.24,.14)
};
function box(parent,w,h,d,x,y,z,material,edges=false){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
  if(edges){const edge=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:'#8d9695',transparent:true,opacity:.25}));mesh.add(edge);}
  return mesh;
}
function cylinder(parent,r,h,x,y,z,material){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,48),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function ring(parent,r,t,x,y,z,material){const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,t,8,48),material);mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
function makeCabinets(){
  const cabinetry=new THREE.Group();scene.add(cabinetry);
  for(const sign of [-1,1]){
    const center=sign*.599;
    box(cabinetry,.402,.018,.38,center,C.bottom+.009,.19,materials.inside,true);
    box(cabinetry,.402,.018,.38,center,1.574,.19,materials.inside,true);
    box(cabinetry,.018,.718,.38,sign*.389,1.224,.19,materials.inside,true);
    box(cabinetry,.018,.718,.38,sign*.809,1.224,.19,materials.cabinet,true);
    box(cabinetry,.398,.713,.018,sign*.607,1.223,.389,materials.cabinet,true);
    box(cabinetry,.4,.018,.35,center,1.23,.185,materials.inside);
  }
  // Central top panel with a schematic duct opening (not a drilling template).
  const outline=new THREE.Shape();outline.moveTo(-.38,0);outline.lineTo(.38,0);outline.lineTo(.38,.38);outline.lineTo(-.38,.38);outline.closePath();
  const hole=new THREE.Path();hole.absarc(0,.145,.12,0,Math.PI*2,true);outline.holes.push(hole);
  const roof=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:.018,bevelEnabled:false,curveSegments:48}),materials.inside);
  roof.rotation.x=Math.PI/2;roof.position.y=1.583;roof.castShadow=true;roof.receiveShadow=true;cabinetry.add(roof);
  box(cabinetry,.76,.08,.018,0,1.097,.371,materials.inside,true);
  // Keep the horizontal rail; the removable shelf is separate and off by default.
  shelf=box(cabinetry,.76,.018,.36,0,1.128,.18,materials.shelf,true);shelf.visible=false;
  panel=box(cabinetry,.754,.186,.018,0,.961,.389,materials.black,true);
  for(const sign of [-1,1]){
    box(cabinetry,.02,.13,.02,sign*.36,.961,.352,materials.edge);
    const hinge=new THREE.Group();hinge.position.set(sign*.38,1.312,.38);cabinetry.add(hinge);
    const door=box(hinge,.377,.506,.018,-sign*.1885,0,.009,materials.cabinet,true);
    door.userData.door=sign<0?'left':'right';doorMeshes.push(door);
    // Hinge hardware visible when the door swings away from the casing.
    for(const y of [-.16,.16]){
      const pin=cylinder(hinge,.006,.04,0,y,0,materials.metal);
      box(hinge,.043,.024,.006,-sign*.021,y,-.006,materials.metal);
      box(cabinetry,.005,.05,.045,sign*.375,1.312+y,.349,materials.metal);
      pin.userData.hardware=true;
    }
    if(sign<0)leftHinge=hinge;else rightHinge=hinge;
  }
}
function makeHood(){
  hood=new THREE.Group();scene.add(hood);
  box(hood,.365,.496,.325,0,.248,.1625,materials.hoodCase,true);
  box(hood,.896,.06,.47,0,-.03,.235,materials.hoodRim,true);
  // Wedge housing: the rear low point is 192 mm below the upper edge.
  const section=new THREE.Shape();section.moveTo(0,-.06);section.lineTo(.47,-.06);section.lineTo(.16,-.192);section.lineTo(0,-.192);section.closePath();
  const wedge=new THREE.Mesh(new THREE.ExtrudeGeometry(section,{depth:.896,bevelEnabled:false}),materials.hoodBody);
  wedge.rotation.y=-Math.PI/2;wedge.position.x=.448;wedge.castShadow=true;wedge.receiveShadow=true;hood.add(wedge);
  const filter=new THREE.Mesh(new THREE.PlaneGeometry(.738,.326),materials.hoodFilter);
  filter.rotation.x=Math.atan2(.31,.132);filter.position.set(0,-.125,.317);hood.add(filter);
  for(let i=0;i<40;i++)box(hood,.008,.013,.004,(i-19.5)*.017,-.047,.472,materials.glass);
  box(hood,.235,.026,.002,0,-.024,.472,materials.hoodGlass);
  for(let i=0;i<5;i++)box(hood,.007,.002,.001,(i-2)*.034,-.024,.474,materials.metal);
  box(hood,.18,.004,.015,0,-.064,.432,materials.light);
  box(hood,.69,.014,.035,0,-.185,.045,materials.glass);
  // Wall bracket only represents the attachment principle; hole positions are not specified.
  box(hood,.30,.028,.01,0,.37,.004,materials.metal);
}
function rebuildDuct(){
  if(duct){scene.remove(duct);duct.traverse(o=>o.geometry?.dispose());}
  duct=new THREE.Group();scene.add(duct);
  const start=topY()+.496;
  cylinder(duct,.109,.035,0,start+.0175,.145,materials.black);
  const height=1.70-start-.035;
  cylinder(duct,.105,height,0,start+.035+height/2,.145,materials.metal);
  for(let y=start+.04;y<1.70;y+=.011)ring(duct,.108,.002,0,y,.145,materials.metal);
}
function makeRoom(){
  const room=new THREE.Group();scene.add(room);
  box(room,1.95,1.87,.022,0,.86,-.025,materials.wall);
  for(let y=.32;y<1.75;y+=.32)box(room,1.95,.0012,.001,0,y,-.013,materials.tile);
  for(const x of [-.64,0,.64])box(room,.0012,1.86,.001,x,.86,-.013,materials.tile);
  box(room,1.89,.038,.64,0,-.019,.32,materials.stone,true);
  box(room,1.83,.105,.57,0,-.09,.285,materials.cabinet,true);
  for(const x of [-.61,0,.61])box(room,.002,.10,.002,x,-.09,.572,materials.edge);
}
function rebuildStove(){
  if(stove){scene.remove(stove);stove.traverse(o=>o.geometry?.dispose());}
  stove=new THREE.Group();scene.add(stove);
  const h=state.stove/1000;
  box(stove,.72,.026,.42,0,.014,.272,materials.stove,true);
  for(const x of [-.205,.205]){
    cylinder(stove,.067,.018,x,.035,.265,materials.black);
    cylinder(stove,.045,.015,x,.046,.265,materials.filter);
    ring(stove,.051,.004,x,.054,.265,materials.metal);
    for(const angle of [0,Math.PI/2]){
      const grate=box(stove,.164,.012,.012,x,Math.max(.006,h-.006),.265,materials.black);grate.rotation.y=angle;
    }
    for(const dx of [-.07,.07])box(stove,.01,Math.max(.002,h-.042),.016,x+dx,.036+Math.max(.002,h-.042)/2,.265,materials.black);
  }
  for(const x of [-.06,.06])cylinder(stove,.016,.02,x,.036,.43,materials.metal);
}
function bindInterface(){
  $('door-angle').addEventListener('input',e=>{state.left=state.right=Number(e.target.value);updateUI();});
  $('left-door').addEventListener('click',()=>toggleDoor('left'));
  $('right-door').addEventListener('click',()=>toggleDoor('right'));
  $('show-panel').addEventListener('change',e=>{state.panel=e.target.checked;syncModel();});
  $('show-shelf').addEventListener('change',e=>{state.shelf=e.target.checked;syncModel();});
  $('gap').addEventListener('input',e=>{state.gap=Number(e.target.value);syncModel(true);});
  $('stove-height').addEventListener('input',e=>{
    if(e.target.value===''||!e.target.validity.valid)return;
    state.stove=Number(e.target.value);if(scene)rebuildStove();syncModel();
  });
  $('stove-height').addEventListener('blur',()=>{$('stove-height').value=state.stove;});
  $('device-reference').addEventListener('change',e=>{state.reference=e.target.value;syncModel();});
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  document.querySelectorAll('[data-dims]').forEach(b=>b.addEventListener('click',()=>{state.dims=b.dataset.dims;syncModel();}));
  $('interior').addEventListener('click',()=>{
    state.left=state.right=105;state.panel=false;state.shelf=false;state.dims='cabinet';setView('perspective');syncModel();
  });
  $('reset').addEventListener('click',()=>{
    Object.assign(state,initial);$('stove-height').value=100;
    if(scene){rebuildStove();camera.zoom=1;camera.updateProjectionMatrix();setView('perspective');}
    syncModel(true);
  });
}
function toggleDoor(side){state[side]=state[side]>1?0:105;updateUI();}
function updateUI(){
  $('door-angle').value=Math.round((state.left+state.right)/2);
  $('door-value').textContent=state.left===state.right?`${state.left}°`:`左 ${state.left}° / 右 ${state.right}°`;
  for(const side of ['left','right']){const b=$(`${side}-door`);b.textContent=`${state[side]>0?'关闭':'打开'}${side==='left'?'左':'右'}门`;b.setAttribute('aria-pressed',String(state[side]>0));}
  $('show-panel').checked=state.panel;$('show-shelf').checked=state.shelf;
  $('gap').value=state.gap;$('gap-value').textContent=`${state.gap} mm`;
  $('device-reference').value=state.reference;
  $('shelf-warning').hidden=!state.shelf;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(state.view===b.dataset.view)));
  document.querySelectorAll('[data-dims]').forEach(b=>b.setAttribute('aria-pressed',String(state.dims===b.dataset.dims)));
  const distance=installDistance();
  $('distance-value').textContent=distance;
  $('distance-label').textContent=state.reference==='top'?'上沿距灶具基准':'最低沿距灶具基准';
  $('distance-formula').textContent=`865 − ${state.stove} − ${state.gap}${state.reference==='bottom'?' − 192':''} = ${distance}`;
  const valid=distance>=720&&distance<=800;
  $('range-note').textContent=valid?'落在图示 720–800 mm 内 · 基准待确认':'超出图示 720–800 mm · 请核对基准及高度';
  document.querySelector('.distance-result').classList.toggle('invalid',!valid);
  const rows=state.dims==='cabinet' ? [
    ['柜间净宽','760','measured'],['柜体深度 / 高度','380 / 700','measured'],['上部机箱 宽 × 深','365 × 325','product'],['上部机箱高度','496','product'],['机箱顶部余量',String(204+state.gap),'derived'],['收口空档 / 横条','192 / 80','measured']
  ] : [['烟机宽度','896','product'],['烟机深度','470','product'],['柜底距台面','865','measured'],['两侧覆盖（各）','68','derived'],['烟机上沿距台面',String(865-state.gap),'derived'],['柜底间隙',String(state.gap),'derived']];
  $('dimension-list').replaceChildren();
  for(const [name,value,type] of rows){const dt=document.createElement('dt');dt.textContent=name;const dd=document.createElement('dd');dd.style.color=colors[type];dd.append(document.createTextNode(value));const unit=document.createElement('small');unit.textContent='mm';dd.append(unit);$('dimension-list').append(dt,dd);}
}
function syncModel(move=false){
  updateUI();
  if(!scene)return;
  hood.position.y=topY();panel.visible=state.panel;shelf.visible=state.shelf;
  if(move)rebuildDuct();
  rebuildDimensions();
}
function setView(name){
  state.view=name;updateUI();
  if(!camera)return;
  const target=new THREE.Vector3(0,.80,.18);
  const positions={perspective:new THREE.Vector3(2.9,2.12,4.8),front:new THREE.Vector3(0,.80,6),side:new THREE.Vector3(6,.80,.18)};
  cameraTween={from:camera.position.clone(),to:positions[name],fromTarget:controls.target.clone(),toTarget:target,start:performance.now()};
  if(reducedMotion){camera.position.copy(cameraTween.to);controls.target.copy(target);cameraTween=null;controls.update();}
}
function init(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xeaf0f4,0);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.domElement.setAttribute('aria-hidden','true');viewport.prepend(renderer.domElement);
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-1.5,1.5,1.1,-1.1,.01,40);
  camera.position.set(2.9,2.12,4.8);
  controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.8,.18);controls.enableDamping=true;controls.dampingFactor=.08;
  controls.minZoom=.45;controls.maxZoom=3.5;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI*.64;
  controls.addEventListener('start',()=>{cameraTween=null;});
  scene.add(new THREE.HemisphereLight(0xf4f7ff,0x8c9294,2.4));
  const sun=new THREE.DirectionalLight(0xfff5e6,4);sun.position.set(-2,4,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-2,right:2,top:2.5,bottom:-2,near:.5,far:12});sun.shadow.bias=-.0003;sun.shadow.normalBias=.012;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xbdd6f0,1.5);fill.position.set(3,2,1);scene.add(fill);
  // Frontal and low fill reveal the recessed cavity and backlit cabinet interior.
  const frontFill=new THREE.DirectionalLight(0xeaf3ff,1.7);frontFill.position.set(-.4,1.15,4);frontFill.target.position.set(0,1,.15);scene.add(frontFill,frontFill.target);
  const lowFill=new THREE.DirectionalLight(0xe1edff,1.1);lowFill.position.set(0,-.35,2);lowFill.target.position.set(0,.9,.2);scene.add(lowFill,lowFill.target);
  makeRoom();makeCabinets();makeHood();rebuildStove();rebuildDuct();syncModel();
  new ResizeObserver(resize).observe(viewport);resize();
  renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0)dragStart={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!dragStart||Math.hypot(e.clientX-dragStart.x,e.clientY-dragStart.y)>5){dragStart=null;return;}
    dragStart=null;const rect=renderer.domElement.getBoundingClientRect();
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
    const hit=ray.intersectObjects(doorMeshes,false)[0];if(hit)toggleDoor(hit.object.userData.door);
  });
  renderer.domElement.addEventListener('webglcontextlost',()=>{$('render-error').hidden=false;});
  $('loading').hidden=true;document.body.dataset.ready='true';animate();
}
function resize(){
  const width=viewport.clientWidth,height=viewport.clientHeight;
  if(!width||!height)return;
  const aspect=width/height;const span=2.16*Math.max(1,1.12/aspect);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;
  camera.updateProjectionMatrix();renderer.setSize(width,height);$('dimensions').setAttribute('viewBox',`0 0 ${width} ${height}`);
}
const ns='http://www.w3.org/2000/svg';
function svgElement(tag,attrs,parent){const el=document.createElementNS(ns,tag);for(const [k,value] of Object.entries(attrs))el.setAttribute(k,value);parent.append(el);return el;}
function addDimension(name,value,start,end,offset,type){
  const startV=v(start),endV=v(end),off=v(offset);const a=startV.clone().add(off),b=endV.clone().add(off);
  const group=svgElement('g',{},$('dimensions'));const ext=svgElement('path',{class:'dim-line dim-extension',stroke:colors[type]},group);
  const line=svgElement('path',{class:'dim-line',stroke:colors[type]},group);
  const leader=svgElement('path',{class:'dim-line',stroke:colors[type],opacity:.5},group);
  const bg=svgElement('rect',{rx:4,fill:'#ffffff',stroke:colors[type],'stroke-opacity':.23,'fill-opacity':.96},group);
  const text=svgElement('text',{class:'dim-text',fill:colors[type],'text-anchor':'middle'},group);text.textContent=`${name} ${value}`;
  dimRecords.push({start:startV,end:endV,a,b,group,ext,line,leader,bg,text});
}
function rebuildDimensions(){
  $('dimensions').replaceChildren();dimRecords=[];const y=topY();
  if(state.dims==='installation'){
    addDimension('净宽','760',[-.38,1.565,.38],[.38,1.565,.38],[0,.065,.08],'measured');
    addDimension('机宽','896',[-.448,y-.192,.16],[.448,y-.192,.16],[0,-.075,.31],'product');
    addDimension('机深','470',[.448,y,0],[.448,y,.47],[.14,.045,0],'product');
    const deviceY=y-(state.reference==='bottom'?.192:0);
    addDimension('安装距离',String(installDistance()),[.38,state.stove/1000,.48],[.38,deviceY,.48],[.33,0,.03],'derived');
    addDimension('柜底缝',String(state.gap),[-.448,y,.38],[-.448,C.bottom,.38],[-.13,0,.08],'derived');
  }else if(state.dims==='cabinet'){
    addDimension('机箱宽','365',[-.1825,y+.496,.325],[.1825,y+.496,.325],[0,.04,.10],'product');
    addDimension('机箱高','496',[.1825,y,.325],[.1825,y+.496,.325],[.095,0,.07],'product');
    addDimension('柜高','700',[-.38,C.bottom,0],[-.38,C.ceiling,0],[-.19,0,.18],'measured');
    addDimension('柜深','380',[.38,1.565,0],[.38,1.565,.38],[.19,.075,0],'measured');
    addDimension('顶部余量',String(204+state.gap),[0,y+.496,.145],[0,C.ceiling,.145],[-.27,0,0],'derived');
    addDimension('收口空档','192',[-.38,.865,.38],[-.38,1.057,.38],[-.02,0,.09],'measured');
  }
}
function drawDimensions(){
  const width=viewport.clientWidth,height=viewport.clientHeight;
  const project=point=>{const p=point.clone().project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2,z:p.z};};
  const occupied=[];
  for(const d of dimRecords){
    const a=project(d.a),b=project(d.b),s=project(d.start),e=project(d.end);
    if(a.z<-1||a.z>1||b.z<-1||b.z>1){d.group.style.display='none';continue;}d.group.style.display='';
    d.ext.setAttribute('d',`M${s.x},${s.y}L${a.x},${a.y}M${e.x},${e.y}L${b.x},${b.y}`);
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);const tx=len>1?-dy/len*4:4,ty=len>1?dx/len*4:0;
    d.line.setAttribute('d',`M${a.x},${a.y}L${b.x},${b.y}M${a.x-tx},${a.y-ty}L${a.x+tx},${a.y+ty}M${b.x-tx},${b.y-ty}L${b.x+tx},${b.y+ty}`);
    const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
    const textWidth=d.text.getComputedTextLength()+16;const bw=Math.min(textWidth,width-20),bh=25;
    let cx=Math.max(bw/2+8,Math.min(width-bw/2-8,mid.x));let cy=Math.max(84,Math.min(height-47,mid.y-12));
    const collides=(x,y)=>occupied.some(o=>Math.abs(o.x-x)<(o.w+bw)/2+5&&Math.abs(o.y-y)<(o.h+bh)/2+4);
    if(collides(cx,cy)){for(const delta of [-31,31,-62,62,-93,93]){const candidate=Math.max(84,Math.min(height-47,cy+delta));if(!collides(cx,candidate)){cy=candidate;break;}}}
    occupied.push({x:cx,y:cy,w:bw,h:bh});
    d.bg.setAttribute('x',cx-bw/2);d.bg.setAttribute('y',cy-bh/2);d.bg.setAttribute('width',bw);d.bg.setAttribute('height',bh);
    d.text.setAttribute('x',cx);d.text.setAttribute('y',cy+4);
    d.leader.setAttribute('d',`M${mid.x},${mid.y}L${cx},${cy}`);
  }
}
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05);
  const smooth=reducedMotion?1:1-Math.exp(-12*dt);
  leftHinge.rotation.y+=(-THREE.MathUtils.degToRad(state.left)-leftHinge.rotation.y)*smooth;
  rightHinge.rotation.y+=(THREE.MathUtils.degToRad(state.right)-rightHinge.rotation.y)*smooth;
  if(cameraTween){const t=Math.min(1,(performance.now()-cameraTween.start)/550),q=t*t*(3-2*t);camera.position.lerpVectors(cameraTween.from,cameraTween.to,q);controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,q);if(t===1)cameraTween=null;}
  controls.update();renderer.render(scene,camera);drawDimensions();
}
bindInterface();updateUI();
try{init();}catch(error){console.error(error);$('loading').hidden=true;$('render-error').hidden=false;}
// Read-only diagnostic snapshot for dimension and interaction verification.
window.__hoodModel={get snapshot(){return {state:{...state},topMm:865-state.gap,installationMm:installDistance(),topClearanceMm:204+state.gap,leftRotation:leftHinge?.rotation.y,rightRotation:rightHinge?.rotation.y,panelVisible:panel?.visible,shelfVisible:shelf?.visible,rendererReady:!!renderer,dimensionLabels:dimRecords.map(d=>d.text.textContent)};}};
