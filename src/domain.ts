export type InventoryMode='owned'|'external';
export type Profile='perfil-a'|'perfil-b'|'other';
export type Vehicle='truck'|'light'|'unclassified';
export type BrandClass='china'|'recognized'|'unclassified';
export interface Contact {id:string;name:string;phone:string;rfc:string;address:string;profile?:Profile}
export interface Product {inventoryMode?:InventoryMode;id:string;sku:string;name:string;size:string;position:string;brand:string;plies:string;supplierId:string;cost:number;price:number;stock:number;minimum:number;vehicle:Vehicle;brandClass:BrandClass}
export interface SupplierCost {id:string;productId:string;supplierId:string;cost:number;updatedAt:string}
export interface Line {inventoryMode?:InventoryMode;id:string;productId:string;description:string;size:string;brand:string;application:string;vehicle:Vehicle;brandClass:BrandClass;supplierId:string;supplierName:string;profile:Profile;quantity:number;cost:number;netCost:number;included:number;addition:number;suggestedPrice:number;suggestedCommission:number;price:number;commission:number;legacy?:boolean}
export interface QuoteOption {id:string;name:string;lines:Line[]}
export interface Fulfillment {name:string;supplierId?:string}
export interface Document {suppliedBySupplierId?:string;id:string;folio:number;kind:'quote'|'order'|'sale';sourceId?:string;customerId:string;customerName:string;createdAt:string;dueDate:string;notes:string;suppliedBy:string;commission:number;lines:Line[];options:QuoteOption[];selectedOptionId?:string;total:number;status:'active'|'converted'|'cancelled';legacy?:boolean}
export type PaymentStatus='pending'|'confirmed'|'not_found';
export interface Attachment {id:string;name:string;type:string;size:number;dataUrl:string}
export interface Allocation {invoiceId:string;amount:number}
export interface Payment {id:string;saleId:string;amount:number;date:string;depositDate:string;confirmedAt:string;method:string;reference:string;status:PaymentStatus;attachment?:Attachment;allocations:Allocation[];legacy?:boolean}
export interface PaymentEvent {id:string;paymentId:string;from:string;to:PaymentStatus;at:string;confirmationDate:string;note:string}
export interface Invoice {id:string;saleId:string;number:string;date:string;amount:number;dueDate?:string;attachment?:Attachment}
export interface Settlement {id:string;saleId:string;supplierId:string;amount:number;paidDate:string;reference:string;method?:'Efectivo'|'Transferencia'|'Otro';createdAt?:string;legacy?:boolean}
export interface Movement {source?:'manual'|'sale';orderId?:string;id:string;productId:string;quantity:number;date:string;reason:string}
export interface Settings {id:string;name:string;phone:string;address:string;footer:string}
export interface Archive {id:string;createdAt:string;reason:string;json:string}
export interface Snapshot {products:Product[];customers:Contact[];suppliers:Contact[];documents:Document[];payments:Payment[];movements:Movement[];settings:Settings[];supplierCosts:SupplierCost[];invoices:Invoice[];settlements:Settlement[];paymentEvents:PaymentEvent[];archives:Archive[];reminders:Reminder[];followUps:FollowUp[];adjustments:Adjustment[];reportReferences:ReportReference[]}
export const uid=()=>crypto.randomUUID();
export const today=()=>new Date().toLocaleDateString('en-CA');
export const cents=(n:string|number)=>Math.round(Number(n)*100);
export const money=(n:number)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n/100);
export const total=(lines:Line[])=>lines.reduce((n,l)=>n+l.quantity*l.price,0);
export const commissionTotal=(lines:Line[])=>lines.reduce((n,l)=>n+l.commission,0);
export const folio=(d:Document)=>`${{quote:'COT',order:'PED',sale:'VTA'}[d.kind]}-${String(d.folio).padStart(5,'0')}`;
export function assert(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(message)}
export const validMoney=(n:number)=>Number.isSafeInteger(n)&&n>=0;
export const validDate=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export const profileFromName=(name:string):Profile=>{const n=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /\bperfil[ -]a\b/.test(n)?'perfil-a':/\bperfil[ -]b\b/.test(n)?'perfil-b':'other'};
export function suggest(cost:number,vehicle:Vehicle,brandClass:BrandClass,profile:Profile){
 assert(validMoney(cost),'Costo inválido.');assert(vehicle!=='unclassified','Clasifica el producto como camión o auto/camioneta.');
 let included=0,addition=20000,commission=20000;
 if(vehicle==='truck'){commission=30000;if(profile==='perfil-a')addition=30000;else if(profile==='perfil-b'){assert(brandClass!=='unclassified','Para Perfil B, indica si la marca es china o reconocida.');included=brandClass==='china'?10000:20000;addition=30000-included;}else throw new Error('Para este proveedor de camión usa la regla especial manual en la operación.');}
 assert(cost>=included,'El costo capturado es menor que la comisión que ya incluye.');return {included,addition,commission,netCost:cost-included,price:cost+addition};
}
export function makeLine(p:Product,s:Contact,cost:number,quantity:number,manualTruck=false):Line{
 const profile=s.profile||profileFromName(s.name);const rule=manualTruck&&p.vehicle==='truck'&&profile==='other'?{included:0,addition:30000,commission:30000,netCost:cost,price:cost+30000}:suggest(cost,p.vehicle,p.brandClass,profile);
 assert(Number.isSafeInteger(quantity)&&quantity>0,'La cantidad debe ser entera y positiva.');return {inventoryMode:p.inventoryMode??'owned',id:uid(),productId:p.id,description:p.name,size:p.size,brand:p.brand,application:p.position,vehicle:p.vehicle,brandClass:p.brandClass,supplierId:s.id,supplierName:s.name,profile,quantity,cost,netCost:rule.netCost,included:rule.included,addition:rule.addition,suggestedPrice:rule.price,suggestedCommission:rule.commission,price:rule.price,commission:rule.commission*quantity};
}
export function allocateCommission(lines:Line[],amount:number):Line[]{assert(validMoney(amount)&&lines.length,'Comisión inválida.');const weight=lines.reduce((n,l)=>n+l.suggestedCommission*l.quantity,0);const count=lines.reduce((n,l)=>n+l.quantity,0);let used=0;return lines.map((l,i)=>{const commission=i===lines.length-1?amount-used:Math.floor(amount*(weight?l.suggestedCommission*l.quantity:l.quantity)/(weight||count));used+=commission;return {...l,commission};});}
export const paidConfirmed=(saleId:string,payments:Payment[])=>payments.filter(p=>p.saleId===saleId&&p.status==='confirmed').reduce((n,p)=>n+p.amount,0);
export const paidReserved=(saleId:string,payments:Payment[])=>payments.filter(p=>p.saleId===saleId&&p.status!=='not_found').reduce((n,p)=>n+p.amount,0);
export function isCleared(d:Document,payments:Payment[]){return d.kind==='sale'&&paidConfirmed(d.id,payments)===d.total&&!payments.some(p=>p.saleId===d.id&&p.status==='pending');}
export function commissionState(d:Document,supplierId:string,payments:Payment[],settlements:Settlement[]):'paid'|'ready'|'pending'{if(!supplierId)return 'pending';return collectedCommission(d.id,supplierId,settlements)>=commissionTotal(d.lines.filter(l=>l.supplierId===supplierId))&&settlements.some(s=>s.saleId===d.id&&s.supplierId===supplierId)?'paid':isCleared(d,payments)?'ready':'pending';}
// Explicit public projections: never export internal descriptions, names or notes.
export function customerCard(d:Document){return {folio:folio(d),options:d.options.map((o,i)=>({name:`Opción ${i+1}`,lines:o.lines.map(l=>({size:l.size,brand:l.brand,application:l.application,quantity:l.quantity,unitPrice:l.price})),total:total(o.lines)}))};}
export function commissionReport(docs:Document[],supplierId:string,payments:Payment[]){
 assert(supplierId,'Selecciona un proveedor.');const selected=docs.filter(d=>d.kind==='sale'&&d.lines.some(l=>l.supplierId===supplierId));assert(selected.length,'No hay ventas para este reporte.');assert(selected.every(d=>isCleared(d,payments)),'Solo se reportan ventas completamente liquidadas y confirmadas.');
 return selected.flatMap(d=>d.lines.filter(l=>l.supplierId===supplierId).map(l=>({folio:folio(d),customer:d.customerName,size:l.size,brand:l.brand,application:l.application,quantity:l.quantity,unitCost:l.cost,totalCost:l.cost*l.quantity,unitPrice:l.price,totalSold:l.price*l.quantity,commission:l.commission})));
}
export async function readAttachment(file:File):Promise<Attachment>{assert(['image/png','image/jpeg','image/webp','application/pdf'].includes(file.type),'Usa PNG, JPG, WEBP o PDF.');assert(file.size<=10*1024*1024,'El archivo supera 10 MB.');const dataUrl=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('No se pudo leer el archivo.'));r.readAsDataURL(file);});return {id:uid(),name:file.name,type:file.type,size:file.size,dataUrl};}



export interface Reminder {id:string;saleId:string;invoiceId:string;offsetDays:number;customDate:string;status:'active'|'done'|'cancelled';createdAt:string;updatedAt:string}
export interface FollowUp {id:string;saleId:string;invoiceId:string;reminderId:string;at:string;date:string;note:string;previousDate:string;nextDate:string}
export interface Adjustment {id:string;documentId:string;optionId:string;lineId:string;field:'price'|'commission';before:number;after:number;at:string;reason:string}
export interface ReportReference {id:string;saleId:string;supplierId:string;reference:string;updatedAt:string}
export type SnapshotV2=Omit<Snapshot,'reminders'|'followUps'|'adjustments'|'reportReferences'>;
export const collectedCommission=(saleId:string,supplierId:string,rows:Settlement[])=>rows.filter(s=>s.saleId===saleId&&s.supplierId===supplierId).reduce((n,s)=>n+s.amount,0);
export function invoiceBalance(i:Invoice,payments:Payment[],excludePaymentId=''){return i.amount-payments.filter(p=>p.id!==excludePaymentId&&p.status==='confirmed').flatMap(p=>p.allocations).filter(a=>a.invoiceId===i.id).reduce((n,a)=>n+a.amount,0);}
export function invoiceAvailable(i:Invoice,payments:Payment[],excludePaymentId=''){return i.amount-payments.filter(p=>p.id!==excludePaymentId&&p.status!=='not_found').flatMap(p=>p.allocations).filter(a=>a.invoiceId===i.id).reduce((n,a)=>n+a.amount,0);}
export function addDays(date:string,offset:number){assert(validDate(date)&&Number.isSafeInteger(offset),'Fecha o días inválidos.');const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);assert(Number.isFinite(d.getTime()),'La fecha está fuera de rango.');return d.toISOString().slice(0,10);}
export function reminderView(r:Reminder,s:Snapshot,now=today()){const sale=s.documents.find(d=>d.id===r.saleId);const invoice=r.invoiceId?s.invoices.find(i=>i.id===r.invoiceId):undefined;const dueDate=invoice?.dueDate||sale?.dueDate||'';const balance=invoice?invoiceBalance(invoice,s.payments):sale?sale.total-paidConfirmed(sale.id,s.payments):0;const date=r.customDate||(dueDate?addDays(dueDate,r.offsetDays):'');const state=balance<=0?'settled':r.status==='cancelled'?'cancelled':r.status==='done'?'done':!date?'unscheduled':date<=now?'due':'scheduled';return {reminder:r,sale,invoice,dueDate,balance,date,state};}

export function parseMoneyInput(value:string){const v=value.trim();if(!/^\d+(?:[.,]\d{1,2})?$/.test(v))throw new Error('Escribe un importe válido, con hasta dos decimales y sin separadores de miles.');const [whole,fraction='']=v.replace(',','.').split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<0)throw new Error('Importe fuera de rango.');return n;}
export function commissionStatement(docs:Document[],supplierId:string,payments:Payment[],settlements:Settlement[],references:ReportReference[]){const selected=[...new Map(docs.filter(d=>d.kind==='sale'&&d.lines.some(l=>l.supplierId===supplierId)).map(d=>[d.id,d])).values()];commissionReport(selected,supplierId,payments);const supplier=selected[0].lines.find(l=>l.supplierId===supplierId)!.supplierName;const collections=selected.flatMap(d=>settlements.filter(c=>c.saleId===d.id&&c.supplierId===supplierId).map(c=>({folio:folio(d),date:c.paidDate,method:c.method||'No registrado (v0.2)',amount:c.amount,reference:c.reference||'Sin referencia'})));return {supplier,sales:selected.map(d=>{const received=settlements.filter(c=>c.saleId===d.id&&c.supplierId===supplierId);return {folio:folio(d),customer:d.customerName,date:new Date(d.createdAt).toLocaleDateString('en-CA'),reference:received.length?received.map(c=>c.reference||'Sin referencia').join(' · '):references.find(r=>r.saleId===d.id&&r.supplierId===supplierId)?.reference||'Sin referencia propia'};}),lines:selected.flatMap(d=>d.lines.filter(l=>l.supplierId===supplierId).map(l=>({folio:folio(d),size:l.size,brand:l.brand,application:l.application,quantity:l.quantity,unitCost:l.cost,baseCost:l.netCost,included:l.included*l.quantity,addition:l.addition*l.quantity,adjustment:l.commission-(l.included+l.addition)*l.quantity,unitPrice:l.price,totalSold:l.price*l.quantity,commission:l.commission}))),collections};}

// Identity/capture helpers do not alter financial calculations or currency formatting.
export const normalizeIdentity=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es-MX');
export const normalizeSku=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,'');
export const productIdentity=(p:Product)=>[normalizeIdentity(p.name),p.size.replace(/\s+/g,'').toUpperCase(),normalizeIdentity(p.brand),normalizeIdentity(p.position),normalizeIdentity(p.plies),p.vehicle].join('|');
export function parseIntegerInput(value:string){const s=value.trim();assert(/^[+-]?\d+$/.test(s),'Escribe una cantidad entera, sin decimales.');const n=Number(s);assert(Number.isSafeInteger(n),'La cantidad está fuera de rango.');return n;}
export function checkProductCapture(p:Product){assert(typeof p.sku==='string'&&p.sku.trim()&&typeof p.name==='string'&&p.name.trim(),'Código y descripción son obligatorios.');assert(['size','position','brand','plies','supplierId'].every(k=>typeof p[k as keyof Product]==='string'),'Revisa los campos del producto.');assert([p.cost,p.price,p.stock,p.minimum].every(validMoney),'Revisa precios, costos y existencias enteras.');assert(!p.inventoryMode||['owned','external'].includes(p.inventoryMode),'Modalidad de inventario inválida.');if(p.inventoryMode){assert(p.size.trim()&&p.brand.trim()&&p.vehicle!=='unclassified','Indica medida, marca y tipo de vehículo.');if(p.inventoryMode==='external')assert(p.supplierId,'Selecciona el proveedor predeterminado del producto externo.');}}
