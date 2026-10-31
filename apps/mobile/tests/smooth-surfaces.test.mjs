import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import ts from 'typescript';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'../src/ui');
// RN host mocks expose paths/masks and native callbacks. This does not replace
// visual/device testing; it verifies our component and layout adapter logic.
function ui(platform){
 const cache=new Map();let focused=0;
 const flatten=s=>Array.isArray(s)?Object.assign({},...s.map(flatten)):s??{};
 const View=React.forwardRef((p,r)=>React.createElement('View',{...p,ref:r},p.children));
 const Input=React.forwardRef((p,r)=>{React.useImperativeHandle(r,()=>({focus:()=>focused++}),[]);return React.createElement('Input',p);});
 const Pressable=React.forwardRef(({style,children,onPressIn,...p},r)=>{
  const [pressed,setPressed]=React.useState(false),state={pressed};
  return React.createElement('Pressable',{...p,ref:r,style:typeof style==='function'?style(state):style,onPressIn:()=>{setPressed(true);onPressIn?.();}},typeof children==='function'?children(state):children);
 });
 const rn={View,Pressable,Text:'Text',TextInput:Input,ScrollView:'ScrollView',StyleSheet:{flatten,create:s=>s,absoluteFill:{position:'absolute',top:0,right:0,bottom:0,left:0}},Platform:{OS:platform,select:o=>o[platform]??o.default},Animated:{createAnimatedComponent:c=>c}};
 function load(file){
  if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const local=name=>{
   if(name==='react-native')return rn;if(name==='react-native-svg')return {__esModule:true,default:'Svg',Path:'Path',G:'G',Defs:'Defs',ClipPath:'ClipPath'};
   if(name==='@react-native-masked-view/masked-view')return {__esModule:true,default:p=>React.createElement('MaskedView',p,p.children)};
   if(name.startsWith('.')){const base=path.resolve(path.dirname(file),name);return load([...(platform==='web'?[base+'.web.tsx']:[]),base+'.tsx',base+'.ts'].find(f=>fs.existsSync(f)));}
   return require(name);
  };
  new Function('require','module','exports',code)(local,m,m.exports);return m.exports;
 }
 return {surface:load(root+'/Surface.tsx'),text:load(root+'/Text.tsx'),focused:()=>focused};
}
for(const platform of ['web','android']){
 test(`${platform}: one SVG contour controls paint, stroke and child clipping; resize preserves padding`,async()=>{
  const {surface}=ui(platform);let r;await act(()=>{r=TestRenderer.create(React.createElement(surface.View,{testID:'card',style:{width:351,height:112,borderRadius:20,backgroundColor:'#262629',borderWidth:2,borderColor:'blue',padding:16,gap:12,overflow:'hidden'}},React.createElement('Image',{testID:'photo'})));});
  const paths=[r.root.findByProps({testID:'surface-fill'}),r.root.findByProps({testID:'surface-border'})],host=r.root.findAllByType('View').find(n=>n.props.testID==='card');
  assert.ok(paths.length>=2);assert.equal(paths[0].props.fill,'#262629');assert.equal(paths[1].props.strokeWidth,4);assert.equal(host.props.style.backgroundColor,'transparent');
  assert.equal(r.root.findByProps({testID:'photo'}).type,'Image');
  if(platform==='web'){assert.equal(host.props.style.clipPath,`path('${paths[0].props.d}')`);assert.equal(host.props.style.paddingTop,18);assert.equal(host.props.style.paddingLeft,18);assert.equal(host.props.style.borderWidth,0);assert.equal(r.root.findAllByType('MaskedView').length,0);}
  else{const mask=r.root.findByType('MaskedView');assert.equal(mask.props.androidRenderingMode,'software');assert.equal(mask.props.maskElement.props.children.props.d,paths[0].props.d);assert.equal(host.props.style.padding,undefined);const inside=mask.findAllByType('View')[0];assert.equal(inside.props.style[1].padding,16);assert.equal(inside.props.style[1].gap,12);}
  const before=paths[0].props.d;await act(()=>host.props.onLayout({nativeEvent:{layout:{x:0,y:0,width:390,height:112}}}));assert.notEqual(r.root.findAllByType('Path')[0].props.d,before);await act(()=>r.unmount());
 });
 test(`${platform}: press feedback, click and onLayout callbacks still work`,async()=>{
  const {surface}=ui(platform);let r,count=0,measured=0;await act(()=>{r=TestRenderer.create(React.createElement(surface.Pressable,{onPress:()=>count++,onLayout:()=>measured++,style:({pressed})=>({width:327,height:52,borderRadius:16,backgroundColor:pressed?'#333333':'#4D5CFF'})},React.createElement('Label',null,'Купить')));});
  const host=r.root.findByType('Pressable');await act(()=>host.props.onPressIn());assert.equal(r.root.findByProps({testID:'surface-fill'}).props.fill,'#333333');await act(()=>host.props.onPress());assert.equal(count,1);await act(()=>host.props.onLayout({nativeEvent:{layout:{x:0,y:0,width:327,height:52}}}));assert.equal(measured,1);await act(()=>r.unmount());
 });
 test(`${platform}: flags stay circular and an input keeps its focus ref and editing`,async()=>{
  const {surface,text,focused}=ui(platform);let r,value='';const ref=React.createRef();await act(()=>{r=TestRenderer.create(React.createElement(surface.View,null,React.createElement(surface.View,{testID:'flag',style:{width:32,height:32,borderRadius:16,backgroundColor:'white'}}),React.createElement(text.TextInput,{ref,testID:'email',onChangeText:v=>value=v,style:{height:56,borderRadius:16,paddingHorizontal:18,borderWidth:2,borderColor:'blue',backgroundColor:'#262629',fontSize:17}})));});
  const flag=r.root.findAllByType('View').find(n=>n.props.testID==='flag');assert.equal(flag.props.style.backgroundColor,'white');assert.equal(flag.findAllByType('Svg').length,0);
  await act(()=>ref.current.focus());assert.equal(focused(),1);const input=r.root.findByType('Input');await act(()=>input.props.onChangeText('next@example.com'));assert.equal(value,'next@example.com');assert.equal(input.props.testID,'email');assert.equal(r.root.findAllByType('View').find(n=>n.props.testID==='email-surface').props.style.height,56);await act(()=>r.unmount());
 });
}

test('web: a tab bar shadow follows the painted contour, without a rectangular host shadow',async()=>{
 const {surface}=ui('web');let r;
 await act(()=>{r=TestRenderer.create(React.createElement(surface.View,{testID:'bar',style:{width:351,height:64,padding:6,borderRadius:24,backgroundColor:'#212124',boxShadow:'0px -2px 10px rgba(0, 0, 0, 0.4)'}}));});
 const host=r.root.findAllByType('View').find(n=>n.props.testID==='bar');
 assert.equal(host.props.style.backgroundColor,'transparent');assert.equal(host.props.style.boxShadow,undefined);
 const svg=r.root.findByType('Svg');assert.equal(svg.props.style.top,0);assert.equal(svg.props.style.left,0);
 assert.equal(svg.props.style.filter,'drop-shadow(0px -2px 10px rgba(0, 0, 0, 0.4))');
 await act(()=>r.unmount());
});
test('web: active tariff border and fill use precisely the same viewport and clipping path',async()=>{
 const {surface}=ui('web');let r;
 await act(()=>{r=TestRenderer.create(React.createElement(surface.Pressable,{testID:'tariff',style:{width:365,height:74,borderRadius:20,borderWidth:2,borderColor:'#4D5CFF',padding:14,paddingTop:12,paddingBottom:8,backgroundColor:'#262629',overflow:'hidden'}},React.createElement('Label',null,'5 ГБ')));});
 const host=r.root.findByType('Pressable'),svg=r.root.findByType('Svg'),fill=r.root.findByProps({testID:'surface-fill'}),border=r.root.findByProps({testID:'surface-border'}),clip=r.root.findByType('ClipPath');
 assert.equal(svg.props.style.top,0);assert.equal(svg.props.style.left,0);
 assert.equal(host.props.style.borderWidth,0);assert.equal(host.props.style.paddingTop,14);assert.equal(host.props.style.paddingBottom,10);assert.equal(host.props.style.paddingLeft,16);
 assert.equal(fill.props.d,border.props.d);assert.equal(clip.props.children.props.d,fill.props.d);
 assert.equal(border.props.clipPath,`url(#${clip.props.id})`);assert.equal(host.props.style.clipPath,`path('${fill.props.d}')`);
 assert.equal(border.props.strokeWidth,4);await act(()=>r.unmount());
});
