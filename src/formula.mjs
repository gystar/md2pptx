// Deliberately supports the report's formula subset, rejects unknown commands.
export function formula(source) {
  let i=0;
  function group(end=false){let out='';while(i<source.length){let c=source[i++];if(c==='}') {if(end)return out;throw Error('公式花括号不匹配');}if(c==='{'){out+=group(true);continue;}if(c!=='\\'){out+=c;continue;}
    const m=source.slice(i).match(/^[A-Za-z]+/);const name=m?m[0]:source[i];i+=name.length;
    if(name==='mathrm'){if(source[i++]!=='{')throw Error('公式分组错误');out+=group(true);}
    else if(name==='frac'){if(source[i++]!=='{')throw Error('公式分组错误');const a=group(true);if(source[i++]!=='{')throw Error('公式分组错误');out+='('+a+') / ('+group(true)+')';}
    else {const symbols={times:'×',approx:'≈',mu:'μ',quad:'    ',qquad:'        ', ',':' ', ' ':' '};if(!(name in symbols))throw Error('尚不支持公式命令：'+name);out+=symbols[name];}
  }if(end)throw Error('公式花括号不匹配');return out;}
  return group().replace(/\s*\n\s*/g,' ');
}
