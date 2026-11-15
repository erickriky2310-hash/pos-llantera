import type {PrintModel} from './ui';
/** Presentation only: repeat the two identifying columns when a table is wide. */
export function documentColumns(group:PrintModel['groups'][number]):number[][] {
 const indices=group.headers.map((_,i)=>i);
 if(indices.length<=7)return [indices];
 const identity=indices.slice(0,2),parts:number[][]=[];
 for(let i=2;i<indices.length;i+=5)parts.push([...identity,...indices.slice(i,i+5)]);
 return parts;
}
let activeFrame:HTMLIFrameElement|undefined;
/** Print the report alone; never measure the application, modal or PNG preview. */
export async function printDocument(element:HTMLElement):Promise<void>{
 activeFrame?.remove();
 const frame=document.createElement('iframe');activeFrame=frame;
 frame.title='Documento de impresión · Carta vertical';frame.setAttribute('aria-hidden','true');
 frame.style.cssText='position:fixed;left:-10000px;top:0;width:215.9mm;height:279.4mm;border:0;';
 document.body.appendChild(frame);
 const cleanup=()=>{frame.remove();if(activeFrame===frame)activeFrame=undefined;};
 try{
  const doc=frame.contentDocument,win=frame.contentWindow;
  if(!doc||!win)throw new Error('No se pudo preparar el documento para imprimir.');
  doc.open();doc.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reporte POS Llantera</title></head><body class="print-document-body"></body></html>');doc.close();
  const base=doc.createElement('base');base.href=document.baseURI;doc.head.appendChild(base);
  const loading=Array.from(document.querySelectorAll('style,link[rel="stylesheet"]')).map(source=>{
   const copy=source.cloneNode(true) as HTMLLinkElement|HTMLStyleElement;
   if(copy.tagName==='STYLE'){doc.head.appendChild(copy);return Promise.resolve();}
   return new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('No se pudieron cargar los estilos de impresión. Intenta de nuevo.')),10000);
    copy.onload=()=>{clearTimeout(timer);resolve();};copy.onerror=()=>{clearTimeout(timer);reject(new Error('No se pudieron cargar los estilos de impresión.'));};
    doc.head.appendChild(copy);
   });
  });
  const report=element.cloneNode(true) as HTMLElement;doc.body.appendChild(report);
  await Promise.all(loading);await doc.fonts.ready;
  await new Promise<void>(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>resolve())));
  const limit=195.9*96/25.4;
  const tables=Array.from(report.querySelectorAll('table'));
  // Validate the actual print width before opening the dialog. No silent shrinking.
  const oversized=report.scrollWidth>limit+2||doc.body.scrollWidth>limit+2||tables.some(t=>t.scrollWidth>limit+2);
  if(oversized)throw new Error('Una tabla supera el ancho de Carta. No se imprimió para evitar reducir o recortar información.');
  win.addEventListener('afterprint',cleanup,{once:true});
  win.focus();win.print();
 }catch(error){cleanup();throw error;}
}
