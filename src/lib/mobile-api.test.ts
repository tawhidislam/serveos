import { describe, expect, it } from 'vitest';
import { ApiError, RESOURCES, canonicalJson, kitchenOrder, pagination, requireUuid, validateOrderItems, validateResourceBody } from '../../supabase/functions/_shared/mobile-api';
describe('mobile request boundaries',()=>{
  it('rejects tenant/role/status injection in ordinary resource payloads',()=>{
    expect(()=>validateResourceBody(RESOURCES['menu-items'],{name:'Dish',category_id:'11111111-1111-1111-1111-111111111111',price:100,restaurant_id:'foreign'},true)).toThrow('Unsupported fields');
    expect(()=>validateResourceBody(RESOURCES.inventory,{name:'Rice',current_stock:100},true)).toThrow('Unsupported fields');
  });
  it('checks IDs, required fields, finite money, and boolean inputs',()=>{
    expect(()=>requireUuid('not-a-uuid')).toThrow(ApiError);
    expect(()=>validateResourceBody(RESOURCES.expenses,{amount:-1,expense_date:'2026-10-14'},true)).toThrow();
    expect(()=>validateResourceBody(RESOURCES['menu-items'],{name:'Dish',price:100},true)).toThrow('category_id');
    expect(()=>validateResourceBody(RESOURCES['menu-items'],{is_available:'yes'},false)).toThrow('boolean');
  });
  it('caps pagination and makes order hashes independent of object key ordering',()=>{
    expect(pagination(new URLSearchParams('limit=20&offset=40'))).toEqual({limit:20,offset:40});
    expect(()=>pagination(new URLSearchParams('limit=999'))).toThrow();
    expect(canonicalJson({b:2,a:{z:1,y:2}})).toBe(canonicalJson({a:{y:2,z:1},b:2}));
  });
  it('allows removing existing lines while rejecting price overrides and zero-quantity new lines',()=>{
    const id='11111111-1111-1111-1111-111111111111';
    expect(()=>validateOrderItems([{id,quantity:0}],true)).not.toThrow();
    expect(()=>validateOrderItems([{id,quantity:2,unit_price:1}],true)).toThrow('Unsupported fields');
    expect(()=>validateOrderItems([{menu_item_id:id,quantity:0}],true)).toThrow('Quantity');
    expect(()=>validateOrderItems([{id,quantity:1,menu_item_id:id}],true)).toThrow('Unsupported fields');
  });
  it('keeps kitchen preparation details while omitting prices and customer contact data',()=>{
    const output=kitchenOrder({id:'ticket',status:'preparing',total_amount:500,customer_phone:'secret',order_items:[{id:'line',quantity:2,unit_price:250,notes:'No salt',selected_addons:[{option_id:'option',name:'Large',addon_name:'Size',price_modifier:50}]}]});
    expect(output).not.toHaveProperty('total_amount');expect(output).not.toHaveProperty('customer_phone');
    expect(output.order_items).toEqual([{id:'line',quantity:2,notes:'No salt',selected_addons:[{option_id:'option',name:'Large',addon_name:'Size'}]}]);
  });
});
