import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCorners, getSurfacePath, isRoundShape } from '../src/ui/squircle.ts';
test('card, button, tab bar and top-rounded sheet have closed smooth finite contours',()=>{
 for(const [w,h,s] of [[351,112,{borderRadius:20}],[327,52,{borderRadius:16}],[351,64,{borderRadius:24}],[375,758,{borderTopLeftRadius:32,borderTopRightRadius:32}]]){
  const d=getSurfacePath(w,h,s);assert.match(d,/[cC]/);assert.ok(d.trim().toLowerCase().endsWith('z'));assert.ok(!/NaN|Infinity/.test(d));
 }
});
test('bottom corners of a sheet remain square',()=>assert.deepEqual(getCorners({borderTopLeftRadius:32,borderTopRightRadius:32},375,758),{topLeft:32,topRight:32,bottomLeft:0,bottomRight:0}));
test('circles stay circular; short rectangular buttons remain smooth',()=>{
 assert.equal(isRoundShape({borderRadius:16},32,32),true);assert.equal(isRoundShape({borderRadius:16},120,32),false);assert.equal(isRoundShape({borderRadius:999},32,32),true);
 assert.deepEqual(getCorners({borderRadius:24},20,10),{topLeft:5,topRight:5,bottomLeft:5,bottomRight:5});
});
test('resize and border inset regenerate the contour; invalid dimensions cannot produce a path',()=>{
 assert.notEqual(getSurfacePath(351,112,{borderRadius:20}),getSurfacePath(390,112,{borderRadius:20}));
 assert.notEqual(getSurfacePath(351,112,{borderRadius:20}),getSurfacePath(351,112,{borderRadius:20},1));
 assert.equal(getSurfacePath(0,112,{borderRadius:20}),'');assert.equal(getSurfacePath(NaN,112,{borderRadius:20}),'');assert.equal(getSurfacePath(10,10,{borderRadius:20},6),'');
});
