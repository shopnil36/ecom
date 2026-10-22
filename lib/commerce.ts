import { database } from './postgres';
import { identity, safeEqual } from './auth';
type Obj = Record<string, any>;
const now=()=>new Date().toISOString();
const db=()=>database;
async function all(kind:string):Promise<Obj[]>{const r=await db().prepare('SELECT data FROM records WHERE kind=?').bind(kind).all();return r.results.map((x:any)=>JSON.parse(x.data));}
async function get(kind:string,id:string):Promise<Obj|null>{const r:any=await db().prepare('SELECT data FROM records WHERE key=?').bind(`${kind}:${id}`).first();return r?JSON.parse(r.data):null;}
function statement(kind:string,value:Obj){return db().prepare('INSERT INTO records(key,kind,data) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind(`${kind}:${value.id}`,kind,JSON.stringify(value));}
async function put(kind:string,value:Obj){await statement(kind,value).run();return value;}
function fail(message:string,status=422):never{throw Object.assign(new Error(message),{status});}
const id=()=>crypto.randomUUID();
const money=(n:number)=>n.toFixed(2);
const loc={id:'dhaka',name:'Dhaka delivery zone',country_code:'BD',active:true,city:'Dhaka',x_chattrn:{type:'zone',areas:['Dhaka','Dhanmondi','Gulshan','Banani','Mirpur','Uttara'],min_order:'0.00'}};
const rate={code:'standard',title:'Standard delivery',price:'80.00',currency:'BDT',min_days:1,max_days:3,cod_available:true};
async function products():Promise<Obj[]>{const ps=await all('product');const stocks:any=await db().prepare('SELECT * FROM stock').all();return ps.map(p=>({...p,variants:p.variants.map((v:Obj)=>({...v,inventory_quantity:stocks.results.filter((s:Obj)=>s.item===String(v.inventory_item_id)).reduce((n:number,s:Obj)=>n+s.available,0)}))}));}
async function quote(input:Obj,existing?:Obj){
 const ps=await products();const lines=input.line_items;if(!Array.isArray(lines)||!lines.length)fail('Add at least one item');
 const seen=new Set();let cents=0;const items=lines.map((l:Obj)=>{const p=ps.find(p=>p.status==='active'&&p.variants.some((v:Obj)=>String(v.id)===String(l.variant_id)));const v=p?.variants.find((v:Obj)=>String(v.id)===String(l.variant_id));if(!v)fail('Variant unavailable');if(seen.has(v.id))fail('Combine duplicate variants into one line');seen.add(v.id);if(!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>999)fail('Invalid quantity');if(v.inventory_policy!=='continue'&&v.inventory_quantity<l.quantity)fail(`Insufficient stock for ${p!.title}`);cents+=Math.round(Number(v.price)*100)*l.quantity;return {id:id(),product_id:p!.id,variant_id:v.id,inventory_item_id:v.inventory_item_id,title:p!.title,variant_title:v.title,sku:v.sku,quantity:l.quantity,price:v.price};});
 const location=input.x_chattrn?.location_id||existing?.x_chattrn?.location_id||'dhaka';if(location!=='dhaka')fail('Unsupported delivery location');
 if(input.applied_discount||input.x_chattrn?.discount_code)fail('Discount codes are not configured');
 return {...existing,...input,id:existing?.id||id(),line_items:items,status:'open',order_id:null,currency:'BDT',subtotal_price:money(cents/100),total_tax:'0.00',total_price:money((cents+8000)/100),shipping_line:rate,x_chattrn:{location_id:location},updated_at:now()};
}
export async function handle(req:Request,path:string[],external=false){
 try{
 const url=new URL(req.url);const q=url.searchParams;const method=req.method;const route=path.join('/');
 const user=external?null:await identity();
 if(external){const token=process.env.CHATTRN_ACCESS_TOKEN;if(!token||!safeEqual(req.headers.get('X-Chattrn-Access-Token')||'',token))fail('Invalid access token',401);}
 const privileged=external||!!user?.isAdmin;
 if(!privileged&&route.startsWith('admin/'))fail('Admin sign in required',401);
 if(!privileged&&route.startsWith('customers/'))fail('Admin sign in required',401);
 if(!external&&method!=='GET'&&new URL(req.headers.get('origin')||'http://invalid').host!==req.headers.get('host'))fail('Invalid request origin',403);
 const own=(record:Obj|null)=>{if(!record||(!privileged&&record._session!==user?.guest))fail('Resource not found',404);return record;};
 const isWriteRoute=(route.startsWith('admin/')&&route!=='admin/inventory-history')||route==='draft_orders.json'||route.startsWith('draft_orders/')||route.endsWith('/cancel.json');
 const expected=route==='admin/inventory'||route.includes('/complete.json')||(/^draft_orders\/[^/]+\.json$/.test(route))?'PUT':'POST';
 if(isWriteRoute && !(route==='admin/products'?['POST','PUT'].includes(method):method===expected))fail('Method not allowed',405);
 if(!isWriteRoute && method!=='GET')fail('Method not allowed',405);
 if(external&&route.startsWith('admin/'))fail('Forbidden',403);
 const body:Obj=method==='GET'?{}:await req.json().catch(()=>({})) as Obj;
 const reply=(value:Obj,status=200,headers:Obj={})=>Response.json(JSON.parse(JSON.stringify(value,(key,val)=>key==='_session'||(!user?.isAdmin&&['cost_price','reorder_point'].includes(key))?undefined:val)),{status,headers:{'Cache-Control':'no-store',...headers}});
 if(route==='store.json')return reply({store:{name:'Chattrn Supply',domain:url.host,currency:'BDT',country_code:'BD',iana_timezone:'Asia/Dhaka',api_version:'2026-10',delivery_mode:'zone',product_url_template:`${process.env.RENDER_EXTERNAL_URL||url.origin}/?product={handle}`,capabilities:{products:true,product_search:true,inventory_levels:true,locations_resolve:true,customers_search:true,orders_read:true,orders_cancel:true,draft_orders:true,draft_orders_complete:true,delivery_rates:true}}});
 if(route==='admin/seed'&&method==='POST'){
 if(external)fail('Forbidden',403);if((await all('product')).length)fail('Catalog already contains products');
 const seeds=[['Everyday Carry Tote','Accessories','2490.00','photo-1553062407-98eeb64c6a62'],['Studio Headphones','Electronics','6990.00','photo-1546435770-a3e426bf472b'],['Minimal Desk Lamp','Home & Living','3490.00','photo-1507473885765-e6ed057f782c'],['Classic Analog Watch','Accessories','4290.00','photo-1524805444758-089113d48a6d'],['Portable Speaker','Electronics','2990.00','photo-1608043152269-423dbba4e7e1'],['Everyday Sneakers','Lifestyle','5490.00','photo-1542291026-7eec264c27ff']];
 const stmts=[];for(const [title,category,price,photo] of seeds){const pid=id(),vid=id();const p={id:pid,title,handle:title.toLowerCase().replaceAll(' ','-'),body_html:`Thoughtfully designed ${title.toLowerCase()} for your everyday.`,vendor:'Chattrn',product_type:category,status:'active',tags:'essentials',created_at:now(),updated_at:now(),options:[{name:'Title',position:1,values:['Default']}],variants:[{id:vid,product_id:pid,title:'Default',price,sku:`CH-${title.slice(0,3).toUpperCase()}`,inventory_item_id:vid,inventory_management:'shopify',inventory_policy:'deny'}],images:[{id:id(),src:`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=900&q=85`,alt:title}]};stmts.push(statement('product',p),db().prepare('INSERT INTO stock(key,item,location,available) VALUES(?,?,?,?)').bind(`${vid}:dhaka`,vid,'dhaka',24));}await db().batch(stmts);return reply({ok:true},201);
 }
 if(route==='admin/inventory-history'){return reply({movements:(await all('movement')).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,100)});}
 if(route==='admin/products'&&['POST','PUT'].includes(method)){
 if(external)fail('Forbidden',403);const p=body.product||{};const old=p.id?await get('product',String(p.id)):null;
 if(method==='PUT'&&!old)fail('Product not found',404);
 if(old&&p.expected_updated_at&&p.expected_updated_at!==old.updated_at)fail('Product changed. Refresh before saving.',409);
 if(typeof p.title!=='string'||!p.title.trim())fail('Product title is required');if(!['active','draft','archived'].includes(p.status))fail('Invalid product status');if(!Array.isArray(p.variants)||!p.variants.length||p.variants.length>100)fail('Provide between 1 and 100 variants');
 const decimal=(value:any,label:string,optional=false)=>{if(optional&&(value==null||value===''))return null;if(!/^\d+(\.\d{1,2})?$/.test(String(value))||Number(value)>999999999)fail(label+' must be a nonnegative decimal with up to two decimals');return money(Number(value));};
 const pid=old?.id||id();const stockUpdates:Obj[]=[];const ids=new Set();
 const variants=p.variants.map((v:Obj)=>{const prior=old?.variants.find((x:Obj)=>x.id===v.id);if(v.id&&!prior)fail('Variant does not belong to this product');const vid=prior?.id||id();if(ids.has(vid))fail('Duplicate variant');ids.add(vid);const selling=decimal(v.price,'Selling price');const cost=decimal(v.x_chattrn&&Object.hasOwn(v.x_chattrn,'cost_price')?v.x_chattrn.cost_price:prior?.x_chattrn?.cost_price,'Cost price',true);const compare=decimal(v.compare_at_price,'Compare-at price',true);const threshold=Number(v.x_chattrn?.reorder_point??prior?.x_chattrn?.reorder_point??5);if(!Number.isInteger(threshold)||threshold<0)fail('Invalid low-stock threshold');if(v.weight!==undefined&&v.weight!==''&&(!Number.isFinite(Number(v.weight))||Number(v.weight)<0))fail('Invalid weight');if(v.weight_unit&&!['g','kg','lb','oz'].includes(v.weight_unit))fail('Invalid weight unit');const item=prior?.inventory_item_id||vid;
 if(v.stock_update){const update=v.stock_update;if(!Number.isInteger(update.available)||update.available<0||update.available>100000000||!Number.isInteger(update.expected_available)||update.expected_available<0)fail('Invalid stock adjustment');stockUpdates.push({...update,item,new:!prior});}
 const {stock_update,inventory_quantity,cost_price,...clean}=v;return {...clean,id:vid,product_id:pid,title:String(v.title||'Default'),price:selling,compare_at_price:compare,weight:Number(v.weight||0),weight_unit:v.weight_unit||'g',x_chattrn:{...prior?.x_chattrn,...v.x_chattrn,cost_price:cost,reorder_point:threshold},inventory_item_id:item,inventory_policy:'deny',inventory_management:'shopify'};});
 if(old?.variants.some((v:Obj)=>!ids.has(v.id)))fail('Existing variants must be preserved; archive the product to hide it');
 const handle=p.handle||p.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))fail('Invalid URL handle');if((await all('product')).some(x=>x.handle===handle&&x.id!==pid))fail('This URL handle is already used');
 const {expected_updated_at,...cleanProduct}=p;
 const value={...cleanProduct,id:pid,title:p.title.trim(),handle,variants,images:(p.images||[]).map((im:Obj,i:number)=>{let parsed;try{parsed=new URL(im.src);}catch{fail('Invalid image URL');}if(parsed!.protocol!=='https:')fail('Images require HTTPS URLs');return {...im,id:im.id||id(),position:i+1};}),created_at:old?.created_at||now(),updated_at:now()};
 const stmts=[old?db().prepare('UPDATE records SET data=? WHERE key=? AND data=?').bind(JSON.stringify(value),`product:${pid}`,JSON.stringify(old)).requireChange():statement('product',value),...variants.map((v:Obj)=>db().prepare('INSERT OR IGNORE INTO stock(key,item,location,available) VALUES(?,?,?,0)').bind(`${v.inventory_item_id}:dhaka`,String(v.inventory_item_id),'dhaka'))];
 for(const change of stockUpdates){stmts.push(db().prepare('UPDATE stock SET available=? WHERE key=? AND available=?').bind(change.available,`${change.item}:dhaka`,change.new?0:change.expected_available).requireChange(),statement('movement',{id:id(),inventory_item_id:change.item,product_id:pid,product_title:value.title,location_id:'dhaka',before:change.expected_available,after:change.available,reason:change.reason||'Product editor',created_at:now()}));}
 await db().batch(stmts);return reply({product:(await products()).find(p=>p.id===pid)},old?200:201);
 }
 if(route==='admin/inventory'&&method==='PUT'){
 if(external)fail('Forbidden',403);if(!Number.isInteger(body.available)||body.available<0||body.available>100000000)fail('Stock must be a nonnegative integer');const existing=await db().prepare('SELECT * FROM stock WHERE key=?').bind(`${body.inventory_item_id}:dhaka`).first();if(!existing)fail('Inventory item not found',404);const expected=body.expected_available??existing.available;if(!Number.isInteger(expected)||expected<0)fail('Invalid expected stock');await db().batch([db().prepare('UPDATE stock SET available=? WHERE key=? AND available=?').bind(body.available,`${body.inventory_item_id}:dhaka`,expected).requireChange(),statement('movement',{id:id(),inventory_item_id:body.inventory_item_id,location_id:'dhaka',before:expected,after:body.available,reason:body.reason||'Inventory correction',created_at:now()})]);return reply({ok:true});
 }
 if(route==='admin/fulfill'&&method==='POST'){if(external)fail('Forbidden',403);const o=await get('order',body.id);if(!o)fail('Order not found',404);if(o.cancelled_at)fail('Order is cancelled');if(!body.tracking_number)fail('Tracking number required');o.fulfillment_status='fulfilled';o.fulfillments=[{id:id(),order_id:o.id,status:'success',tracking_company:body.tracking_company||'Merchant delivery',tracking_number:body.tracking_number,shipment_status:'in_transit',created_at:now()}];try{await db().batch([db().prepare('INSERT INTO completions(draft,order_id) VALUES(?,?)').bind(`finalize:${o.id}`,o.id),statement('order',o)]);}catch{fail('Order has already been fulfilled or cancelled');}return reply({order:o});}
 if(route==='products/count.json')return reply({count:(await products()).filter(p=>privileged||p.status==='active').length});
 if(route==='products.json'||route==='products/search.json'){
 let ps=(await products()).filter(p=>privileged||p.status==='active');if(route.includes('search')){const term=q.get('q');if(!term)fail('q is required');ps=ps.filter(p=>`${p.title} ${p.tags} ${p.product_type}`.toLowerCase().includes(term.toLowerCase()));}
 if(q.has('updated_at_min')){if(Number.isNaN(Date.parse(q.get('updated_at_min')!)))fail('Invalid timestamp');ps=ps.filter(p=>p.updated_at>=q.get('updated_at_min')!);}
 ps.sort((a,b)=>String(a.id).localeCompare(String(b.id)));if(q.has('since_id'))ps=ps.filter(p=>String(p.id)>q.get('since_id')!);
 const limit=Number(q.get('limit')||50);if(!Number.isInteger(limit)||limit<1||limit>250)fail('limit must be 1–250');let start=0;if(q.has('page_info')){start=ps.findIndex(p=>p.id===q.get('page_info'));if(start<0)fail('Invalid page cursor');start++;}
 const page=ps.slice(start,start+limit);let link='';if(start+limit<ps.length){const next=new URL(url);next.searchParams.set('page_info',page.at(-1)!.id);link=`<${next}>; rel="next"`;}
 const fields=q.get('fields')?.split(',');return reply({products:fields?page.map(p=>Object.fromEntries(fields.filter(k=>k in p).map(k=>[k,p[k]]))):page},200,link?{Link:link}:{});
 }
 if(/^products\/[^/]+\.json$/.test(route)){const pid=path[1].replace('.json','');const p=(await products()).find(p=>String(p.id)===pid);if(!p||(!privileged&&p.status!=='active'))fail('Product not found',404);return reply({product:p});}
 if(route==='locations.json')return reply({locations:[loc]});
 if(route==='locations/resolve.json'){const area=q.get('area');if(!area)fail('area is required');const match=loc.x_chattrn.areas.some(a=>area.toLowerCase().includes(a.toLowerCase()));return reply({resolution:{query:area,serviceable:match,matches:match?[{location_id:loc.id,name:loc.name,confidence:1}]:[]}});}
 if(route==='locations/dhaka.json')return reply({location:loc});
 if(route==='delivery/rates.json'){if(q.get('location_id')!=='dhaka')fail('Unknown location');return reply({delivery_rates:[rate]});}
 if(route==='inventory_levels.json'){const items=q.get('inventory_item_ids')?.split(','),locations=q.get('location_ids')?.split(',');if(!items&&!locations)fail('Provide inventory_item_ids or location_ids');if((items?.length||0)>50||(locations?.length||0)>50)fail('Maximum 50 IDs per filter');const r:any=await db().prepare('SELECT * FROM stock').all();return reply({inventory_levels:r.results.filter((s:Obj)=>(!items||items.includes(s.item))&&(!locations||locations.includes(s.location))).map((s:Obj)=>({inventory_item_id:s.item,location_id:s.location,available:s.available,updated_at:now()}))});}
 if(route==='draft_orders.json'&&method==='POST')return reply({draft_order:await put('draft',await quote({...body.draft_order,_session:user?.guest||'integration'}))},201);
 if(/^draft_orders\/[^/]+\.json$/.test(route)&&method==='PUT'){const d=await get('draft',path[1].replace('.json',''));if(!d)fail('Draft not found',404);own(d);if(d.status==='completed')fail('Draft is completed');return reply({draft_order:await put('draft',await quote({...body.draft_order,_session:d!._session},d!))});}
 if(/^draft_orders\/[^/]+\/complete.json$/.test(route)&&method==='PUT'){
 if(q.get('payment_pending')!=='true')fail('payment_pending=true is required');const d=await get('draft',path[1]);if(!d)fail('Draft not found',404);own(d);const done:any=await db().prepare('SELECT order_id FROM completions WHERE draft=?').bind(d.id).first();if(done)return reply({draft_order:{...d,status:'completed',order_id:done.order_id}});
 const address=d.shipping_address;if(!address?.first_name||!address?.address1||!address?.city||!/^\+[1-9]\d{6,14}$/.test(d.phone||address.phone||''))fail('Name, address, city and international phone number are required');
 const fresh=await quote(d,d);const oid=id();const orderNumber=Date.now();const phone=d.phone||address.phone;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(phone));const cid='customer-'+Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24);const customer={id:cid,phone:d.phone||address.phone,email:d.email||'',first_name:address.first_name,last_name:address.last_name||'',orders_count:1,total_spent:fresh.total_price,default_address:address,created_at:now()};
 const o={...fresh,id:oid,name:`#${orderNumber}`,order_number:orderNumber,created_at:now(),financial_status:'pending',fulfillment_status:null,cancelled_at:null,cancel_reason:null,customer,phone:customer.phone,shipping_address:address,payment_gateway_names:['Cash on Delivery'],shipping_lines:[rate],fulfillments:[],total_discounts:'0.00'};
 const stmts=[db().prepare('INSERT INTO completions(draft,order_id) VALUES(?,?)').bind(d.id,oid)];
 for(const l of fresh.line_items)stmts.push(db().prepare('UPDATE stock SET available=available-? WHERE key=?').bind(l.quantity,`${l.inventory_item_id}:dhaka`));
 // The CHECK constraint makes insufficient-stock errors roll back this whole atomic batch.
 stmts.push(statement('order',o),statement('customer',customer),statement('draft',{...fresh,status:'completed',order_id:oid}));
 try{await db().batch(stmts);}catch(e){const existing:any=await db().prepare('SELECT order_id FROM completions WHERE draft=?').bind(d.id).first();if(existing)return reply({draft_order:{...d,status:'completed',order_id:existing.order_id}});fail('Stock changed. Refresh your cart and retry.');}
 return reply({draft_order:{...fresh,status:'completed',order_id:oid}});
 }
 if(route==='orders.json'){let orders=(await all('order')).filter(o=>privileged||o._session===user?.guest);if(q.has('name'))orders=orders.filter(o=>o.name===q.get('name'));const status=q.get('status')||'any';if(status==='open')orders=orders.filter(o=>!o.cancelled_at&&o.fulfillment_status!=='fulfilled');else if(status==='closed')orders=orders.filter(o=>o.fulfillment_status==='fulfilled');else if(status==='cancelled')orders=orders.filter(o=>o.cancelled_at);return reply({orders:orders.sort((a,b)=>b.created_at.localeCompare(a.created_at))});}
 if(path[0]==='orders'){
 const oid=path[1]?.replace('.json','');const o=await get('order',oid);if(!o)fail('Order not found',404);own(o);
 if(path[2]==='cancel.json'&&method==='POST'){if(o.fulfillment_status==='fulfilled')fail('A shipped order cannot be cancelled');if(!['customer','fraud','inventory','declined','other'].includes(body.reason))fail('Invalid cancellation reason');if(o.cancelled_at)return reply({order:o});
 // Cancellation is serialized by a unique completion marker to prevent repeated restocking.
 try{await db().batch([db().prepare('INSERT INTO completions(draft,order_id) VALUES(?,?)').bind(`finalize:${oid}`,oid),...o.line_items.map((l:Obj)=>db().prepare('UPDATE stock SET available=available+? WHERE key=?').bind(l.quantity,`${l.inventory_item_id}:dhaka`)),statement('order',{...o,cancelled_at:now(),cancel_reason:body.reason,financial_status:'voided'})]);}catch{const updated=await get('order',oid);if(!updated?.cancelled_at)fail('Could not cancel order');}return reply({order:await get('order',oid)});}
 if(path[2]==='fulfillments.json')return reply({fulfillments:o.fulfillments});return reply({order:o});
 }
 if(route==='customers/search.json'){const query=q.get('query')||'';const [key,...rest]=query.split(':');if(!['email','phone'].includes(key)||!rest.join(':'))fail('Use query=phone:... or email:...');const orders=await all('order');return reply({customers:(await all('customer')).filter(c=>c[key]===rest.join(':')).map(c=>({...c,orders_count:orders.filter(o=>o.customer.id===c.id).length,total_spent:money(orders.filter(o=>o.customer.id===c.id&&!o.cancelled_at).reduce((n,o)=>n+Number(o.total_price),0))}))});}
 if(path[0]==='customers'&&path[2]==='orders.json')return reply({orders:(await all('order')).filter(o=>String(o.customer?.id)===path[1])});
 return reply({errors:'Endpoint not found'},404);
 }catch(e:any){if(!e.status)console.error('Commerce request failed',e.message);return Response.json({errors:e.status?e.message:'Unable to process request'},{status:e.status||500});}
}
