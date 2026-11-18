import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {parse,blocks,plain,convert} from './convert.mjs';
import {formula} from './src/formula.mjs';
assert.equal(formula('\\frac{a}{b} \\times 2'),'(a) / (b) × 2');
assert.throws(()=>formula('\\unknown{x}'));
assert.throws(()=>parse('no heading'));
assert.throws(()=>parse(''));
assert.throws(()=>parse('## A\n## B'));
assert.throws(()=>parse('## A\n### 讲解 notes\nX\n### 讲解 notes\nY'));
assert.equal(parse('\uFEFF# 测试\r\n## 第一页\r\n正文')[0].title,'第一页');
assert.throws(()=>blocks('![bad](image.png) trailing text'));
assert.throws(()=>blocks('$$\nx'));
assert.throws(()=>blocks('|a|b|\n|---|---|\n|1|'));
assert.equal(blocks('|a|b|\n|---|---|\n|x\\|y|z|')[0].rows[1][0],'x|y');
assert.equal(blocks('![说明](图 (1).png)')[0].src,'图 (1).png');
assert.equal(blocks('|a|b|\n|---|---|\n|1|2|')[0].rows.length,2);
assert.deepEqual(blocks('|a|b|c|\n|---|:---:|---:|\n|x|y|z|')[0].aligns,['left','center','right']);
assert.throws(()=>blocks('|a|b|\n|x|y|'));
const source=new URL('./examples/minimal.md',import.meta.url);
const slides=parse(fs.readFileSync(source,'utf8'));
assert.equal(slides.length,3);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'md2pptx-test-'));
try {
 const output=path.join(tmp,'test.pptx');const audit=await convert(fileURLToPath(source),output);
 assert.ok(audit.every(a=>a.contentBottom<=6.601));
 const original=fs.readFileSync(output);
 await assert.rejects(()=>convert(fileURLToPath(source),output),/已存在/);
 assert.deepEqual(fs.readFileSync(output),original);
 const bad=path.join(tmp,'missing.md');fs.writeFileSync(bad,'## 图片\n![缺图](missing.png)');
 await assert.rejects(()=>convert(bad,path.join(tmp,'missing.pptx')),/缺少图片/);
 assert.ok(!fs.existsSync(path.join(tmp,'missing.pptx')));
 fs.writeFileSync(bad,'## '+ '超长标题'.repeat(50));
 await assert.rejects(()=>convert(bad,path.join(tmp,'long.pptx')),/标题过长/);
 const zip=await JSZip.loadAsync(fs.readFileSync(output));
 assert.equal(Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).length,3);
 const unescape=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
 const texts=x=>[...x.matchAll(/<a:t>([^]*?)<\/a:t>/g)].map(m=>unescape(m[1])).join('');
 const compact=s=>s.replace(/\s/g,'');
 let images=0,embeddedImages=0;
 for(let i=0;i<slides.length;i++){
  const xml=await zip.file(`ppt/slides/slide${i+1}.xml`).async('string');const visible=compact(texts(xml));
  embeddedImages+=(xml.match(/<p:pic>/g)||[]).length;
  assert.ok(xml.includes('sz="2600"'),'fixed title font');
  assert.ok(visible.includes(compact(slides[i].title)));
  for(const b of blocks(slides[i].body)){
   if(b.type==='image'){images++;continue;}
   const parts=b.type==='table'?b.rows.flat():[b.text];for(const s of parts)assert.ok(visible.includes(compact(plain(s))),`page ${i+1}: ${s}`);
  }
  const notes=await zip.file(`ppt/notesSlides/notesSlide${i+1}.xml`).async('string');assert.ok(compact(texts(notes)).includes(compact(slides[i].notes)),`notes ${i+1}`);
 }
 assert.equal(images,0);assert.equal(embeddedImages,0);
 const imageSource=new URL('./examples/images.md',import.meta.url);
 const imageOutput=path.join(tmp,'images.pptx');
 const imageAudit=await convert(fileURLToPath(imageSource),imageOutput);
 assert.equal(imageAudit.length,2);
 const imageZip=await JSZip.loadAsync(fs.readFileSync(imageOutput));
 const expectedImage=fs.readFileSync(new URL('./examples/assets/workflow.png',import.meta.url));
 let imageCount=0;
 for (let i=1;i<=2;i++) {
  const xml=await imageZip.file(`ppt/slides/slide${i}.xml`).async('string');
  imageCount+=(xml.match(/<p:pic>/g)||[]).length;
 }
 assert.equal(imageCount,2);
 const media=Object.keys(imageZip.files).filter(n=>n.startsWith('ppt/media/')&&!imageZip.files[n].dir);
 assert.ok(media.length>0);
 for (const name of media) assert.deepEqual(await imageZip.file(name).async('nodebuffer'),expectedImage);
 console.log('PASS: 3 text/table/formula slides, 2 image slides, text/notes, original image bytes, bounds and failure cases');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

