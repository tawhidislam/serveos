import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const env=JSON.parse(execFileSync('supabase',['status','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
if(!['127.0.0.1','localhost'].includes(new URL(env.API_URL).hostname)) throw new Error('Local database only');
const backend=createClient(env.API_URL,env.SERVICE_ROLE_KEY,{auth:{persistSession:false}}), signup=createClient(env.API_URL,env.ANON_KEY,{auth:{persistSession:false}}),base=`${env.API_URL}/functions/v1/mobile-api/v1`;
const token=randomBytes(6).toString('hex'),password=randomBytes(18).toString('hex'),userIds=[],restaurants=[],uploads=[];let checks=0;
async function request(path,method='GET',body,accessToken,expected=200,headers={}) {
 const res=await fetch(base+path,{method,headers:{'content-type':'application/json',...(accessToken?{Authorization:`Bearer ${accessToken}`}:{ }),...headers},body:body?JSON.stringify(body):undefined});const json=await res.json();assert.equal(res.status,expected,`${method} ${path}: ${JSON.stringify(json)}`);checks++;return json.data;
}
const sql=s=>execFileSync('docker',['exec','supabase_db_mzwrasiyigxsbyomdazk','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',s],{stdio:['ignore','pipe','pipe']});
try{
 await request('/health');await request('/restaurants','GET',undefined,undefined,401);
 const owners=[];
 for(let n=0;n<2;n++){
  const email=`mobile-owner-${n}-${token}@example.com`;
  const {data,error}=await signup.functions.invoke('restaurant-signup',{body:{restaurantName:`Mobile API test ${n} ${token}`,slug:`mobile-${n}-${token}`,ownerEmail:email,ownerPassword:password}});if(error)throw error;
  userIds.push(data.ownerId);restaurants.push(data.restaurant.id);
  const auth=await request('/auth/login','POST',{email,password});owners.push(auth.access_token);
  if(n===0){const refreshed=await request('/auth/refresh','POST',{refresh_token:auth.refresh_token});owners[0]=refreshed.access_token;}
 }
 const rid=restaurants[0],r2=restaurants[1],owner=owners[0];
 const list=await request('/restaurants','GET',undefined,owner);assert.equal(list.length,1);
 await request(`/restaurants/${r2}`,'GET',undefined,owner,403);
 await request('/me','PATCH',{display_name:'API owner profile'},owner);
 const context=await request(`/restaurants/${rid}`,'GET',undefined,owner);assert.equal(context.role,'owner');assert.equal(context.features.operations,true);
 const capabilities=await request(`/restaurants/${rid}/capabilities`,'GET',undefined,owner);
 for(const [name,spec] of Object.entries(capabilities.resources)) await request(`/restaurants/${rid}/${name}`,'GET',undefined,owner,spec.read?200:403);
 for(const name of ['packages','addon-catalog','themes','payment-methods','subscription','capabilities']) await request(`/restaurants/${rid}/${name}`,'GET',undefined,owner);
 const branch=await request(`/restaurants/${rid}/branches`,'POST',{name:'API branch'},owner,201);
 const secondBranch=await request(`/restaurants/${rid}/branches`,'POST',{name:'API branch two'},owner,201);
 const category=await request(`/restaurants/${rid}/categories`,'POST',{name:'API category',branch_id:branch.id},owner,201);
 const item=await request(`/restaurants/${rid}/menu-items`,'POST',{name:'API dish',category_id:category.id,branch_id:branch.id,price:100},owner,201);
 const foreignBranch=await request(`/restaurants/${r2}/branches`,'POST',{name:'Foreign branch'},owners[1],201);
 const foreignCategory=await request(`/restaurants/${r2}/categories`,'POST',{name:'Foreign category',branch_id:foreignBranch.id},owners[1],201);
 await request(`/restaurants/${rid}/menu-items`,'POST',{name:'Forbidden dish',category_id:foreignCategory.id,branch_id:branch.id,price:1},owner,403);
 const table=await request(`/restaurants/${rid}/tables`,'POST',{label:'API table',capacity:4,branch_id:branch.id},owner,201);
 const staff={};
 for(const role of ['kitchen','waiter','manager']){
  const email=`mobile-${role}-${token}@example.com`,staffPassword=role==='waiter'?` ${password} `:password;
  let created;
  if(role==='waiter'){
    const res=await fetch(`${env.API_URL}/functions/v1/create-staff`,{method:'POST',headers:{Authorization:`Bearer ${owner}`,apikey:env.ANON_KEY,'content-type':'application/json'},body:JSON.stringify({restaurant_id:rid,email,password:staffPassword,display_name:`Demo ${role}`,role})});
    const result=await res.json();assert.equal(res.status,200,`Web staff wrapper: ${JSON.stringify(result)}`);created=result.user;checks++;
  }else created=await request(`/restaurants/${rid}/staff`,'POST',{email,password:staffPassword,display_name:`Demo ${role}`,role},owner,201);
  userIds.push(created.id);
  staff[role]={id:created.id,token:(await request('/auth/login','POST',{email,password:staffPassword})).access_token};
 }
 await request(`/restaurants/${rid}/staff-branches`,'POST',{user_id:staff.kitchen.id,branch_id:branch.id},owner,201);
 await request(`/restaurants/${rid}/menu-items`,'GET',undefined,staff.kitchen.token);
 await request(`/restaurants/${rid}/menu-items`,'POST',{name:'Forbidden',category_id:category.id,price:1},staff.kitchen.token,403);
 await request(`/restaurants/${rid}/staff`,'GET',undefined,staff.waiter.token,403);
 await request(`/restaurants/${r2}/orders`,'GET',undefined,staff.kitchen.token,403);
 const orderBody={branch_id:branch.id,table_id:table.id,items:[{menu_item_id:item.id,quantity:2}]},key=`order-${token}`;
 const order=await request(`/restaurants/${rid}/orders`,'POST',orderBody,staff.waiter.token,201,{'Idempotency-Key':key});assert.equal(Number(order.total_amount),220);
 await request(`/restaurants/${rid}/menu-items/${item.id}`,'PATCH',{price:200},owner);
 const repeated=await request(`/restaurants/${rid}/orders`,'POST',orderBody,staff.waiter.token,201,{'Idempotency-Key':key});assert.equal(repeated.id,order.id);
 await request(`/restaurants/${rid}/orders`,'POST',{...orderBody,items:[{menu_item_id:item.id,quantity:3}]},staff.waiter.token,409,{'Idempotency-Key':key});
 await request(`/restaurants/${rid}/orders`,'POST',{...orderBody,total_amount:1},owner,400,{'Idempotency-Key':`spoof-${token}`});
 await request(`/restaurants/${rid}/orders/${order.id}/status`,'POST',{status:'served',expected_status:'pending'},staff.kitchen.token,409);
 await request(`/restaurants/${rid}/orders/${order.id}/status`,'POST',{status:'preparing',expected_status:'pending'},staff.kitchen.token);
 await request(`/restaurants/${rid}/orders/${order.id}/status`,'POST',{status:'preparing',expected_status:'pending'},staff.kitchen.token,409);
 await request(`/restaurants/${rid}/orders/${order.id}/status`,'POST',{status:'ready',expected_status:'preparing'},staff.kitchen.token);
 await request(`/restaurants/${rid}/orders/${order.id}/status`,'POST',{status:'served',expected_status:'ready'},staff.waiter.token);
 await request(`/restaurants/${rid}/orders/${order.id}/payment`,'POST',{payment_method:'cash'},staff.waiter.token,403);
 await request(`/restaurants/${rid}/orders/${order.id}/payment`,'POST',{},owner,400);
 await request(`/restaurants/${rid}/orders/${order.id}/payment`,'POST',{payment_method:'cash'},owner);
 await request(`/restaurants/${rid}/orders/${order.id}/payment`,'POST',{payment_method:'cash'},owner,409);
 await request(`/restaurants/${rid}/orders/${order.id}/discount`,'POST',{discount_amount:10},owner,409);
 await request(`/restaurants/${rid}/orders/${order.id}`,'PATCH',{expected_updated_at:order.updated_at,notes:'Closed edit'},owner,409);
 const held=await request(`/restaurants/${rid}/orders/${order.id}`,'GET',undefined,owner);assert.equal(Number(held.total_amount),220);
 await request(`/restaurants/${rid}/orders/${order.id}/receipt`,'GET',undefined,staff.waiter.token);
 await request(`/restaurants/${rid}/orders/${order.id}/receipt`,'GET',undefined,staff.kitchen.token,403);
 await request(`/restaurants/${rid}/tables/${table.id}/qr`,'GET',undefined,owner);
 await request(`/restaurants/${rid}/tables/${table.id}/status`,'POST',{status:'occupied'},staff.waiter.token);
 await request(`/restaurants/${rid}/events?since=${encodeURIComponent(new Date(Date.now()-86400000).toISOString())}`,'GET',undefined,staff.kitchen.token);
 const kitchenOrder=await request(`/restaurants/${rid}/orders/${order.id}`,'GET',undefined,staff.kitchen.token);assert.ok(!('total_amount' in kitchenOrder));assert.ok(kitchenOrder.order_items.every(line=>!('unit_price' in line))); 
 const category2=await request(`/restaurants/${rid}/categories`,'POST',{name:'Second category',branch_id:secondBranch.id},owner,201);
 const item2=await request(`/restaurants/${rid}/menu-items`,'POST',{name:'API second branch dish',category_id:category2.id,branch_id:secondBranch.id,price:50},owner,201);
 const order2=await request(`/restaurants/${rid}/orders`,'POST',{branch_id:secondBranch.id,items:[{menu_item_id:item2.id,quantity:1}]},owner,201,{'Idempotency-Key':`second-${token}`});
 await request(`/restaurants/${rid}/orders/${order2.id}`,'GET',undefined,staff.kitchen.token,404);
 await request(`/restaurants/${rid}/orders/${order2.id}/status`,'POST',{status:'preparing',expected_status:'pending'},staff.kitchen.token,403);
 await request(`/restaurants/${rid}/orders/${order2.id}/discount`,'POST',{discount_amount:10},staff.waiter.token,403);
 const discounted=await request(`/restaurants/${rid}/orders/${order2.id}/discount`,'POST',{discount_amount:10},owner);assert.equal(Number(discounted.total_amount),45);
 const order2Detail=await request(`/restaurants/${rid}/orders/${order2.id}`,'GET',undefined,owner),lineId=order2Detail.order_items[0].id;
 await request(`/restaurants/${rid}/orders/${order2.id}`,'PATCH',{expected_updated_at:order2.updated_at,items:[{id:lineId,quantity:2}]},staff.waiter.token,409);
 let edited=await request(`/restaurants/${rid}/orders/${order2.id}`,'PATCH',{expected_updated_at:discounted.updated_at,items:[{id:lineId,quantity:2}]},staff.waiter.token);assert.equal(Number(edited.total_amount),100);
 await request(`/restaurants/${rid}/menu-items/${item2.id}`,'PATCH',{price:100},owner);
 edited=await request(`/restaurants/${rid}/orders/${order2.id}`,'PATCH',{expected_updated_at:edited.updated_at,items:[{id:lineId,quantity:2},{menu_item_id:item2.id,quantity:1}]},staff.waiter.token);assert.equal(Number(edited.total_amount),210);
 const newLine=edited.order_items.find(line=>line.id!==lineId);assert.equal(Number(newLine.unit_price),100);assert.equal(Number(edited.order_items.find(line=>line.id===lineId).unit_price),50);
 edited=await request(`/restaurants/${rid}/orders/${order2.id}`,'PATCH',{expected_updated_at:edited.updated_at,items:[{id:newLine.id,quantity:1}]},staff.waiter.token);assert.equal(Number(edited.total_amount),100);
 await request(`/restaurants/${rid}/orders/${order2.id}`,'PATCH',{expected_updated_at:edited.updated_at,items:[{id:newLine.id,quantity:0}]},owner,400);
 await request(`/restaurants/${rid}/orders/${order2.id}`,'PATCH',{expected_updated_at:edited.updated_at,items:[{id:newLine.id,quantity:1},{menu_item_id:item.id,quantity:1}]},owner,403);
 const unchanged=await request(`/restaurants/${rid}/orders/${order2.id}`,'GET',undefined,owner);assert.equal(Number(unchanged.total_amount),100);
 await request(`/restaurants/${rid}/staff-branches`,'POST',{user_id:staff.manager.id,branch_id:branch.id},owner,201);
 await request(`/restaurants/${rid}/menu-items/${item2.id}`,'PATCH',{name:'Wrong branch'},staff.manager.token,403);
 await request(`/restaurants/${rid}/menu-items/${item2.id}`,'PATCH',{branch_id:branch.id,category_id:category.id},staff.manager.token,403);
 const qr=await request(`/restaurants/${rid}/qr-short-links`,'POST',{code:`API-${token}`,table_id:table.id,label:'API QR'},owner,201);
 await request(`/restaurants/${rid}/qr-short-links/${qr.id}`,'PATCH',{is_active:false},owner);
 const audit=await request(`/restaurants/${rid}/audit`,'GET',undefined,owner);assert.ok(audit.length>0);assert.ok(audit.every(row=>(row.new_data?.restaurant_id??row.old_data?.restaurant_id)===rid));assert.ok(audit.some(row=>row.changed_by));
 await request(`/restaurants/${rid}/audit`,'GET',undefined,staff.waiter.token,403);
 const inventory=await request(`/restaurants/${rid}/inventory`,'POST',{name:'API flour',unit:'kg',branch_id:branch.id,cost_per_unit:10},owner,201);
 await request(`/restaurants/${rid}/inventory/receive`,'POST',{branch_id:branch.id,lines:[{item_id:inventory.id,quantity:5,unit_cost:10}]},owner);
 await request(`/restaurants/${rid}/inventory/adjust`,'POST',{branch_id:branch.id,reason:'cycle_count',lines:[{item_id:inventory.id,quantity_after:4}]},owner);
 const stock=await request(`/restaurants/${rid}/inventory/${inventory.id}`,'GET',undefined,owner);assert.equal(Number(stock.current_stock),4);
 await request(`/restaurants/${rid}/menu-ingredients`,'POST',{menu_item_id:item.id,inventory_item_id:inventory.id,quantity_per_unit:1,branch_id:branch.id},owner,201);
 const stockTicket=await request(`/restaurants/${rid}/orders`,'POST',{branch_id:branch.id,items:[{menu_item_id:item.id,quantity:1}]},staff.waiter.token,201,{'Idempotency-Key':`stock-${token}`});
 const stockDetail=await request(`/restaurants/${rid}/orders/${stockTicket.id}`,'GET',undefined,owner);
 let stockEdit=await request(`/restaurants/${rid}/orders/${stockTicket.id}`,'PATCH',{expected_updated_at:stockTicket.updated_at,items:[{id:stockDetail.order_items[0].id,quantity:3}]},staff.waiter.token);
 const used=await request(`/restaurants/${rid}/inventory/${inventory.id}`,'GET',undefined,owner);assert.equal(Number(used.current_stock),1);
 stockEdit=await request(`/restaurants/${rid}/orders/${stockTicket.id}`,'PATCH',{expected_updated_at:stockEdit.updated_at,items:[{id:stockDetail.order_items[0].id,quantity:1}]},staff.waiter.token);
 const restored=await request(`/restaurants/${rid}/inventory/${inventory.id}`,'GET',undefined,owner);assert.equal(Number(restored.current_stock),3);
 const support=await request(`/restaurants/${rid}/support`,'POST',{body:'Please get a human for this automated API test',category:'technical'},staff.kitchen.token);
 await backend.from('support_messages').insert({conversation_id:support.conversation_id,sender_kind:'agent',body:'Private test note',is_internal:true});
 const visible=await request(`/restaurants/${rid}/support/${support.conversation_id}/messages`,'GET',undefined,staff.kitchen.token);assert.ok(!visible.some(message=>message.body==='Private test note'));
 await request(`/restaurants/${r2}/support/${support.conversation_id}/messages`,'GET',undefined,owners[1],404);
 await request(`/restaurants/${rid}/support/${support.conversation_id}/typing`,'GET',undefined,staff.kitchen.token);
 const report=await request(`/restaurants/${rid}/reports`,'GET',undefined,owner);assert.equal(Number(report.collected),220);assert.equal(Number(report.tax_collected),20);assert.equal(report.payments_by_method[0].payment_method,'cash');
 const csvRes=await fetch(base+`/restaurants/${rid}/reports/export`,{headers:{Authorization:`Bearer ${owner}`}});assert.equal(csvRes.status,200);assert.ok(csvRes.headers.get('content-type').startsWith('text/csv'));const csv=await csvRes.text();assert.ok(csv.includes('"tax_collected","20"'));assert.ok(!csv.includes('[object Object]'));checks++;
 await request(`/restaurants/${rid}/subscription-payments`,'POST',{plan:'trial',payment_method:'bkash'},owner,400);
 await request(`/restaurants/${rid}/addon-requests`,'POST',{addon_id:'11111111-1111-1111-1111-111111111111',amount:1},owner,400);
 await request(`/restaurants/${rid}/uploads`,'POST',{kind:'menu',content_type:'image/png',base64:'eHl6'},owner,400);
 const uploaded=await request(`/restaurants/${rid}/uploads`,'POST',{kind:'menu',content_type:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1cAAAAASUVORK5CYII='},owner,201);uploads.push(uploaded);assert.ok(uploaded.path.startsWith(rid+'/'));
 const since=encodeURIComponent(new Date(Date.now()-86400000).toISOString());await request(`/restaurants/${rid}/inventory-adjustments?from=${since}`,'GET',undefined,owner);
 await request(`/restaurants/${rid}/categories?limit=999`,'GET',undefined,owner,400);
 sql(`UPDATE subscriptions SET plan='free',status='active',current_period_end=NULL WHERE restaurant_id='${rid}';`);
 await request(`/restaurants/${rid}/orders`,'GET',undefined,staff.kitchen.token,403);
 await request(`/restaurants/${rid}/staff/${staff.manager.id}`,'DELETE',undefined,owner);
 await request(`/restaurants/${rid}`,'GET',undefined,staff.manager.token,403);
 await request(`/restaurants/${rid}/inventory`,'GET',undefined,owner,403);
 sql(`UPDATE restaurants SET is_active=false WHERE id='${rid}';`);
 await request(`/restaurants/${rid}`,'GET',undefined,owner,403);
 const newPassword=randomBytes(18).toString('hex');await request('/auth/password','POST',{current_password:password,new_password:newPassword},owners[1]);
 const secondEmail=`mobile-owner-1-${token}@example.com`;await request('/auth/login','POST',{email:secondEmail,password},undefined,401);
 const newAuth=await request('/auth/login','POST',{email:secondEmail,password:newPassword});await request('/auth/logout','POST',{},newAuth.access_token);
 await request('/auth/refresh','POST',{refresh_token:newAuth.refresh_token},undefined,401);
 console.log(`PASS: ${checks} mobile API requests checked: auth, tenant isolation, roles, branch scope, CRUD, pricing, idempotency, kitchen/waiter transitions, payments, inventory, and entitlements.`);
}finally{
 for(const upload of uploads){const {error}=await backend.storage.from(upload.bucket).remove([upload.path]);if(error)throw error;}
 for(const id of restaurants){if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid test restaurant ID');sql(`DELETE FROM restaurants WHERE id='${id}';DELETE FROM audit_logs WHERE COALESCE(new_data->>'restaurant_id',old_data->>'restaurant_id')='${id}';`);}
 for(const id of userIds){const {error}=await backend.auth.admin.deleteUser(id);if(error)throw error;}
}
