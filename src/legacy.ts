import Dexie, { liveQuery, type Table } from 'dexie';
export interface Contact { id:string; name:string; phone:string; rfc:string; address:string }
export interface Product { id:string; sku:string; name:string; size:string; position:string; brand:string; plies:string; supplierId:string; cost:number; price:number; stock:number; minimum:number }
export interface Line { productId:string; description:string; quantity:number; price:number; cost:number }
export interface Document { id:string; folio:number; kind:'quote'|'order'|'sale'; sourceId?:string; customerId:string; customerName:string; createdAt:string; dueDate:string; notes:string; suppliedBy:string; commission:number; lines:Line[]; total:number; status:'active'|'converted'|'cancelled' }
export interface Payment { id:string; saleId:string; amount:number; date:string; method:string; reference:string }
export interface Movement { id:string; productId:string; quantity:number; date:string; reason:string }
export interface Settings { id:string; name:string; phone:string; address:string; footer:string }
export interface Snapshot { products:Product[]; customers:Contact[]; suppliers:Contact[]; documents:Document[]; payments:Payment[]; movements:Movement[]; settings:Settings[] }
export const uid=()=>crypto.randomUUID();
export const today=()=>new Date().toLocaleDateString('en-CA');
export const money=(n:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n/100);
export const cents=(n:string|number)=>Math.round(Number(n)*100);
export const total=(lines:Line[])=>lines.reduce((n,l)=>n+l.quantity*l.price,0);
export const folio=(d:Document)=>`${{quote:'COT',order:'PED',sale:'VTA'}[d.kind]}-${String(d.folio).padStart(5,'0')}`;
class Database extends Dexie {
 products!:Table<Product,string>; customers!:Table<Contact,string>; suppliers!:Table<Contact,string>; documents!:Table<Document,string>; payments!:Table<Payment,string>; movements!:Table<Movement,string>; settings!:Table<Settings,string>;
 constructor(name='pos-llantera-v1'){super(name);this.version(1).stores({products:'id,&sku,name',customers:'id,name',suppliers:'id,name',documents:'id,kind,sourceId',payments:'id,saleId',movements:'id,productId',settings:'id'});}
}
export const db=new Database();
function requireValue(ok:unknown,message:string):asserts ok {if(!ok)throw new Error(message);}
function validAmount(n:number){return Number.isSafeInteger(n)&&n>=0;}
function checkLines(lines:Line[]){requireValue(lines.length>0,'Añade al menos un producto.');for(const l of lines)requireValue(l.productId&&Number.isSafeInteger(l.quantity)&&l.quantity>0&&validAmount(l.price)&&validAmount(l.cost),'Revisa cantidades y precios.');requireValue(validAmount(total(lines)),'El total excede el límite permitido.');}
export interface PosRepository {
 watch(callback:(data:Snapshot)=>void,onError:(error:unknown)=>void):()=>void;
 saveSettings(settings:Settings):Promise<void>;
 saveContact(kind:'customers'|'suppliers',contact:Contact):Promise<void>;
 saveProduct(product:Product):Promise<void>;
 adjustStock(id:string,quantity:number,reason:string):Promise<void>;
 saveQuote(input:Omit<Document,'id'|'folio'|'createdAt'|'status'|'kind'|'total'>,id?:string):Promise<string>;
 convert(id:string):Promise<string>;
 cancel(id:string):Promise<void>;
 pay(saleId:string,amount:number,date:string,method:string,reference:string):Promise<void>;
 backup():Promise<Snapshot>;
 restore(value:unknown):Promise<void>;
}
export class DexieRepository implements PosRepository {
 database:Database;
 constructor(database=db){this.database=database;}
 watch(callback:(data:Snapshot)=>void,onError:(error:unknown)=>void){const subscription=liveQuery(()=>this.backup()).subscribe({next:callback,error:onError});return ()=>subscription.unsubscribe();}
 async saveSettings(settings:Settings){requireValue(settings.name.trim(),'Escribe el nombre comercial.');await this.database.settings.put(settings);}
 async saveContact(kind:'customers'|'suppliers',c:Contact){requireValue(c.name.trim(),'Escribe el nombre.');await this.database[kind].put({...c,name:c.name.trim()});}
 async saveProduct(p:Product){requireValue(p.sku.trim()&&p.name.trim(),'Código y descripción son obligatorios.');requireValue(validAmount(p.cost)&&validAmount(p.price)&&Number.isSafeInteger(p.minimum)&&p.minimum>=0&&Number.isSafeInteger(p.stock)&&p.stock>=0,'Revisa precio, costo y existencias.');await this.database.transaction('rw',this.database.products,this.database.movements,async()=>{const old=await this.database.products.get(p.id);requireValue(!old||old.stock===p.stock,'Las existencias cambiaron. Abre de nuevo el producto.');await this.database.products.put({...p,sku:p.sku.trim().toUpperCase()});if(!old&&p.stock)await this.database.movements.add({id:uid(),productId:p.id,quantity:p.stock,date:new Date().toISOString(),reason:'Existencia inicial'});});}
 async adjustStock(id:string,q:number,reason:string){requireValue(Number.isSafeInteger(q)&&q!==0&&reason.trim(),'Indica un movimiento entero distinto de cero y su motivo.');await this.database.transaction('rw',this.database.products,this.database.movements,async()=>{const p=await this.database.products.get(id);requireValue(p,'Producto no encontrado.');requireValue(p.stock+q>=0,'El movimiento dejaría existencias negativas.');await this.database.products.update(id,{stock:p.stock+q});await this.database.movements.add({id:uid(),productId:id,quantity:q,date:new Date().toISOString(),reason:reason.trim()});});}
 async saveQuote(input:Omit<Document,'id'|'folio'|'createdAt'|'status'|'kind'|'total'>,id?:string){checkLines(input.lines);requireValue(validAmount(input.commission),'Comisión inválida.');return this.database.transaction('rw',this.database.documents,this.database.customers,this.database.products,async()=>{const customer=await this.database.customers.get(input.customerId);requireValue(customer,'Selecciona un cliente registrado.');for(const l of input.lines)requireValue(await this.database.products.get(l.productId),'Un producto ya no existe.');const old=id?await this.database.documents.get(id):undefined;requireValue(!id||(old?.kind==='quote'&&old.status==='active'),'La cotización ya no se puede editar.');const key=id||uid();const docs=await this.database.documents.toArray();await this.database.documents.put({...input,customerName:customer.name,id:key,folio:old?.folio??Math.max(0,...docs.filter(d=>d.kind==='quote').map(d=>d.folio))+1,createdAt:old?.createdAt??new Date().toISOString(),kind:'quote',status:'active',total:total(input.lines)});return key;});}
 async convert(id:string){return this.database.transaction('rw',this.database.documents,this.database.products,this.database.movements,async()=>{const d=await this.database.documents.get(id);requireValue(d&&d.status==='active'&&d.kind!=='sale','Este documento ya fue procesado.');const kind=d.kind==='quote'?'order':'sale';if(kind==='sale'){const required=new Map<string,number>();for(const l of d.lines)required.set(l.productId,(required.get(l.productId)||0)+l.quantity);for(const [pid,q] of required){const p=await this.database.products.get(pid);requireValue(p&&p.stock>=q,`Existencias insuficientes: ${d.lines.find(l=>l.productId===pid)?.description}. Registra la recepción en Inventario.`);await this.database.products.update(pid,{stock:p.stock-q});await this.database.movements.add({id:uid(),productId:pid,quantity:-q,date:new Date().toISOString(),reason:`Venta de ${folio(d)}`});}}
 const docs=await this.database.documents.toArray();const key=uid();await this.database.documents.add({...d,id:key,kind,folio:Math.max(0,...docs.filter(x=>x.kind===kind).map(x=>x.folio))+1,sourceId:d.id,createdAt:new Date().toISOString(),status:'active'});await this.database.documents.update(id,{status:'converted'});return key;});}
 async cancel(id:string){await this.database.transaction('rw',this.database.documents,async()=>{const d=await this.database.documents.get(id);requireValue(d&&d.status==='active'&&d.kind!=='sale','Solo se cancelan cotizaciones o pedidos activos.');await this.database.documents.update(id,{status:'cancelled'});});}
 async pay(saleId:string,amount:number,date:string,method:string,reference:string){requireValue(validAmount(amount)&&amount>0&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=today(),'Indica un importe positivo y una fecha válida hasta hoy.');await this.database.transaction('rw',this.database.documents,this.database.payments,async()=>{const sale=await this.database.documents.get(saleId);requireValue(sale?.kind==='sale','Venta no encontrada.');const paid=(await this.database.payments.where('saleId').equals(saleId).toArray()).reduce((s,p)=>s+p.amount,0);requireValue(amount<=sale.total-paid,'El abono supera el saldo pendiente.');await this.database.payments.add({id:uid(),saleId,amount,date,method,reference});});}
 async backup(){const d=this.database;return d.transaction('r',d.tables,async()=>({products:await d.products.toArray(),customers:await d.customers.toArray(),suppliers:await d.suppliers.toArray(),documents:await d.documents.toArray(),payments:await d.payments.toArray(),movements:await d.movements.toArray(),settings:await d.settings.toArray()}));}
 async restore(value:unknown){const s=validateBackup(value);await this.database.transaction('rw',this.database.tables,async()=>{for(const [key,rows] of Object.entries(s)){const t=this.database.table(key);await t.clear();await t.bulkAdd(rows);}});}
}
export function validateBackup(value:unknown):Snapshot {
 const v=value as {format?:string;version?:number;data?:Snapshot};requireValue(v?.format==='pos-llantera'&&v.version===1&&v.data,'El archivo no es un respaldo de POS Llantera versión 1.');const s=v.data;
 for(const key of ['products','customers','suppliers','documents','payments','movements','settings'] as const){requireValue(Array.isArray(s[key]),`Falta ${key}.`);const ids=new Set();for(const row of s[key]){requireValue(row&&typeof row.id==='string'&&!ids.has(row.id),'Identificadores inválidos o duplicados.');ids.add(row.id);}}
 const text=(o:object,keys:string[])=>keys.every(k=>typeof (o as Record<string,unknown>)[k]==='string');
 const products=new Set(s.products.map(p=>p.id)),customers=new Set(s.customers.map(c=>c.id)),suppliers=new Set(s.suppliers.map(c=>c.id));
 for(const c of [...s.customers,...s.suppliers])requireValue(text(c,['name','phone','rfc','address'])&&c.name.trim(),'Contacto inválido.');
 const skus=new Set();for(const p of s.products){requireValue(text(p,['sku','name','size','position','brand','plies','supplierId'])&&p.sku&&p.name&&!skus.has(p.sku)&&(!p.supplierId||suppliers.has(p.supplierId))&&validAmount(p.price)&&validAmount(p.cost)&&validAmount(p.stock)&&validAmount(p.minimum),'Producto inválido.');skus.add(p.sku);}
 const docs=new Map(s.documents.map(d=>[d.id,d]));const folios=new Set();for(const d of s.documents){requireValue(text(d,['customerName','createdAt','dueDate','notes','suppliedBy'])&&customers.has(d.customerId)&&['quote','order','sale'].includes(d.kind)&&['active','converted','cancelled'].includes(d.status)&&Number.isSafeInteger(d.folio)&&d.folio>0&&validAmount(d.commission),'Documento inválido.');checkLines(d.lines);requireValue(d.lines.every(l=>products.has(l.productId)&&typeof l.description==='string')&&d.total===total(d.lines),'Total o producto inválido.');requireValue(!folios.has(d.kind+d.folio),'Folio duplicado.');folios.add(d.kind+d.folio);if(d.sourceId){const source=docs.get(d.sourceId);requireValue(source&&source.status==='converted'&&((d.kind==='order'&&source.kind==='quote')||(d.kind==='sale'&&source.kind==='order')),'Origen inválido.');}}
 const paid=new Map<string,number>();for(const p of s.payments){requireValue(text(p,['saleId','date','method','reference'])&&docs.get(p.saleId)?.kind==='sale'&&validAmount(p.amount)&&p.amount>0&&/^\d{4}-\d{2}-\d{2}$/.test(p.date),'Pago inválido.');paid.set(p.saleId,(paid.get(p.saleId)||0)+p.amount);requireValue(paid.get(p.saleId)!<=docs.get(p.saleId)!.total,'Pagos superiores al total.');}
 for(const m of s.movements)requireValue(text(m,['date','reason'])&&products.has(m.productId)&&Number.isSafeInteger(m.quantity),'Movimiento inválido.');for(const c of s.settings)requireValue(c.id==='business'&&text(c,['name','phone','address','footer']),'Configuración inválida.');
 return s;
}
export const repository:PosRepository=new DexieRepository();
