import {imageSize} from 'image-size';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pptxgen from 'pptxgenjs';
import {formula} from './src/formula.mjs';

export function parse(md) {
  md=md.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  if(!md.trim())throw Error('Markdown 为空');
  return md.replace(/<!--[^]*?-->/g,'').split(/^---[ \t]*$/m).filter(s=>s.trim()).map((s,i)=>{
    const [body,...notes]=s.split(/^### 讲解 notes\s*$/m);
    if(notes.length>1)throw Error(`第 ${i+1} 页重复备注标记`);
    if((body.match(/^## /mg)||[]).length!==1)throw Error(`第 ${i+1} 页必须恰有一个 ## 标题`);
    const title=body.match(/^## (.+)$/m)?.[1];
    if(!title)throw Error(`第 ${i+1} 页缺少 ## 标题`);
    return {title,body:body.replace(/^# .*$/mg,'').replace(/^## .*$/m,'').trim(),notes:notes.join('\n').trim()};
  });
}
export const plain=s=>s.replace(/\*\*(.+?)\*\*/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)');
export function blocks(body){
  const lines=body.split('\n'), out=[];
  for(let i=0;i<lines.length;i++){
    const s=lines[i].trim();if(!s)continue;
    if(s==='$$'){let math='';while(++i<lines.length&&lines[i].trim()!=='$$')math+=lines[i]+'\n';if(i===lines.length)throw Error('公式缺少结束 $$');out.push({type:'text',text:formula(math)});continue;}
    if(s.startsWith('```')||s.startsWith('<'))throw Error('暂不支持代码块或 HTML，请转换为普通段落');
    if(s.startsWith('|')){
      const rows=[];let aligns=null, raw=0;
      while(i<lines.length&&lines[i].trim().startsWith('|')){
        const row=lines[i++].trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,'|'));
        if(raw===1){
          if(!row.every(x=>/^:?-{3,}:?$/.test(x)))throw Error('表格第二行必须为 --- 分隔行');
          aligns=row.map(x=>x.startsWith(':')&&x.endsWith(':')?'center':x.endsWith(':')?'right':'left');
        }else rows.push(row);
        raw++;
      }
      i--;if(!aligns||rows.some(r=>r.length!==aligns.length))throw Error('表格列数不一致或缺少分隔行');
      out.push({type:'table',rows,aligns});continue;
    }
    const image=s.match(/^!\[([^\]]*)\]\((.+)\)$/);
    if(image){out.push({type:'image',alt:image[1],src:image[2]});continue;}
    if(s.startsWith('!['))throw Error('图片必须独占一行：'+s);
    out.push({type:'text',text:s.replace(/^[-*] /,'• ').replace(/^### /,'')});
  }return out;
}
const widthUnits=s=>[...plain(s)].reduce((n,c)=>n+(/[^\x00-\xff]/.test(c)?1:0.56),0);
const lineCount=(s,size,w)=>s.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(widthUnits(line)*size/(w*72*0.88))),0);
const runs=s=>s.split(/(\*\*[^]*?\*\*)/g).filter(Boolean).map(t=>({text:plain(t),options:{bold:t.startsWith('**')}}));
function layout(items,size){return items.map(b=>{
  if(b.type==='image')return {...b,h:0};
  if(b.type==='text')return {...b,h:lineCount(b.text,size,11.65)*size/72*1.35+0.09};
  const count=b.rows[0].length;
  const weights=Array.from({length:count},(_,j)=>Math.max(...b.rows.map(r=>Math.min(55,widthUnits(r[j]))))+4);
  const cols=weights.map(w=>w/weights.reduce((a,b)=>a+b)*11.65);
  const rows=b.rows.map(r=>Math.max(...r.map((c,j)=>lineCount(c,size,cols[j]-0.15)))*size/72*1.3+0.12);
  return {...b,cols,heights:rows,h:rows.reduce((a,b)=>a+b)+0.13};
});}
export async function convert(input,output){
  if(!/\.pptx$/i.test(output))throw Error('输出扩展名必须为 .pptx');
  if(fs.existsSync(output))throw Error('输出已存在，请使用新路径');
  const source=fs.readFileSync(input,'utf8'), slides=parse(source);
  const ppt=new pptxgen();ppt.defineLayout({name:'REFERENCE',width:12191695/914400,height:7.5});ppt.layout='REFERENCE';
  const font=process.env.PPTX_FONT_SANS||(process.platform==='win32'?'Microsoft YaHei':'Noto Sans CJK SC');
  ppt.author='';ppt.subject='Markdown direct conversion';ppt.title=source.match(/^# (.+)$/m)?.[1]||path.basename(input,'.md');ppt.lang='zh-CN';
  ppt.theme={headFontFace:font,bodyFontFace:font,lang:'zh-CN'};
  const audit=[];
  for(const [index,data] of slides.entries()){
    const dark=data.title.startsWith('研究内容');
    const top=dark?2.8:1.633, bottom=6.60, available=bottom-top;
    if(lineCount(data.title,26,11.65)>1)throw Error(`第 ${index+1} 页标题过长（固定 26 pt 单行），请调整分页或标题格式`);
    const items=blocks(data.body);for(const b of items)if(b.type==='image'){b.src=path.resolve(path.dirname(input),b.src);if(!fs.existsSync(b.src))throw Error('缺少图片：'+b.src);}
    let size=dark?18:14, plan;const images=items.filter(b=>b.type==='image').length;
    for(;size>=10;size--){plan=layout(items,size);if(plan.reduce((n,b)=>n+b.h,0)+images*1.65<=available)break;}
    if(size<10)throw Error(`第 ${index+1} 页内容过多，请用 --- 拆页`);
    const total=plan.reduce((n,b)=>n+b.h,0);if(images)plan.forEach(b=>{if(b.type==='image')b.h=(available-total)/images;});
    const slide=ppt.addSlide();slide.background={color:dark?'141414':'FFFFFF'};
    const color=dark?'F5F5F5':'111111';
    const text=(s,x,y,w,h,extra={})=>slide.addText(runs(s),{x,y,w,h,fontFace:font,fontSize:size,color,margin:0,breakLine:false,paraSpaceAfter:0,valign:'top',...extra});
    text(ppt.title,0.8333,0.581,11.65,0.25,{fontSize:12,color:dark?'5FA3A6':'0D7377',bold:true,charSpacing:1.4});
    text(data.title,0.8333,0.8702,11.65,0.65,{fontSize:26,bold:true});
    let y=top;
    for(const b of plan){
      if(b.type==='text')text(b.text,0.84,y,11.65,b.h);
      if(b.type==='image'){const dim=imageSize(fs.readFileSync(b.src));const scale=Math.min(11.65/dim.width,(b.h-0.08)/dim.height);const w=dim.width*scale,h=dim.height*scale;slide.addImage({path:b.src,x:0.84+(11.65-w)/2,y:y+(b.h-h)/2,w,h,altText:b.alt});}
      if(b.type==='table'){
        let ty=y;
        b.rows.forEach((row,j)=>{let tx=0.84;row.forEach((cell,k)=>{
          text(cell,tx+0.06,ty+0.04,b.cols[k]-0.12,b.heights[j]-0.06,{bold:j===0||k===0,color:j===0||k===0?color:(dark?'BDBDBD':'5C5C5C'),align:b.aligns[k]});
          tx+=b.cols[k];
        });ty+=b.heights[j];slide.addShape(ppt.ShapeType.line,{x:0.84,y:ty,w:11.65,h:0,line:{color:j===b.rows.length-1?color:'E5E8E8',width:j===b.rows.length-1?1:0.5}});});
        slide.addShape(ppt.ShapeType.line,{x:0.84,y,w:11.65,h:0,line:{color,width:1}});
      }
      y+=b.h;
    }
    if(y>bottom+0.001)throw Error(`第 ${index+1} 页内容越界`);
    slide.addShape(ppt.ShapeType.line,{x:0.8333,y:6.854,w:11.666,h:0,line:{color:dark?'3A3A3A':'E5E8E8',width:0.5}});
    text(ppt.title,0.8333,6.994,10,0.22,{fontSize:10,color:'767676'});text(String(index+1),12,6.994,0.48,0.22,{fontSize:10,color:'767676',bold:true,align:'right'});
    slide.addNotes(data.notes);
    audit.push({page:index+1,title:data.title,fontSize:size,images,tableCount:items.filter(b=>b.type==='table').length,contentBottom:y,notesCharacters:data.notes.length});
  }
  const buffer=await ppt.write({outputType:'nodebuffer'});
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,buffer,{flag:'wx'});
  fs.writeFileSync(output.replace(/\.pptx$/i,'.audit.json'),JSON.stringify({input:path.resolve(input),slides:audit,font,rendering:'native PPTX; no HTML or browser'},null,2));
  return audit;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2), oi=args.indexOf('--out');
 if(!args[0]||args[0].startsWith('--')||!(args.length===1||(args.length===3&&oi===1&&!args[2].startsWith('--')))){console.error('node convert.mjs input.md [--out output.pptx]');process.exitCode=1;}
 else convert(path.resolve(args[0]),path.resolve(oi>=0?args[oi+1]:path.join('output',path.basename(args[0],'.md')+'.pptx'))).then(a=>console.log(`完成：${a.length} 页`)).catch(e=>{console.error(e.message);process.exitCode=1;});
}
