import { describe, expect, it } from 'vitest';
import { createClient } from '@libsql/client';
import { DB_SCHEMA } from '../server/db/schema.ts';
import {
  buildOwnerOrderCompatibility, loadOwnerOrderCompatibility,
  renderItemizedOwnerTicket,
} from '../server/services/ownerMenuCompatibilityService.ts';

const base = {
  id: 'ORDER-1', customer_name: 'Example Customer', customer_mobile: '9000000001',
  address: 'Kollur sample address', landmark: 'Sample landmark',
  delivery_date: '2026-10-11', delivery_window: '07:00-11:00',
  created_at_ist: '10 Oct 2026 12:00 IST',
  payment_status: 'PAID', fulfillment_status: 'RECEIVED',
  provider_payment_id: 'pay_fixture', subtotal_paisa: 14000,
  delivery_charge_paisa: 0, total_amount_paisa: 14000,
  jowar_quantity: 0, chapathi_quantity: 0,
  jowar_unit_price_paisa: 3000, chapathi_unit_price_paisa: 1000,
};
const item = (id:string, quantity:number, price:number, en:string, te:string) => ({
  item_id: id, item_name_en:en, item_name_te:te, meal_period:'MORNING',
  sale_unit:'PLATE', pieces_per_unit:4, quantity,
  unit_price_paisa:price, line_total_paisa:quantity*price,
});
const holds = [
  {item_id:'idly', delivery_date:'2026-10-11', quantity_plates:2, status:'CONFIRMED'},
  {item_id:'ragi-idly', delivery_date:'2026-10-11', quantity_plates:2, status:'CONFIRMED'},
];
const lines = [item('idly',2,3000,'Idly','ఇడ్లీ'),item('ragi-idly',2,4000,'Ragi Idly','రాగి ఇడ్లీ')];

describe('read-only owner order + ticket compatibility',()=>{
  it('preserves historical legacy order prices and exact existing ticket bytes',()=>{
    const legacy=buildOwnerOrderCompatibility({
      ...base, id:'OLD', jowar_quantity:5, chapathi_quantity:5,
      subtotal_paisa:12500,total_amount_paisa:12500,
      jowar_unit_price_paisa:2000,chapathi_unit_price_paisa:500,
      ticket_text:'Historical WhatsApp ticket\nKeep unchanged!',
    },[]);
    expect(legacy.format).toBe('LEGACY');
    expect(legacy.lines.map(x=>[x.itemId,x.quantity,x.unitPricePaisa])).toEqual([
      ['jowar-roti',5,2000],['chapathi',5,500],
    ]);
    expect(legacy.ticketText).toBe('Historical WhatsApp ticket\nKeep unchanged!');
    expect(legacy.ticketStatus).toBe('LEGACY_STORED');
    expect(legacy.summaryMatchesSavedSubtotal).toBe(true);
  });
  it('uses saved multilingual snapshots and plate counts, not current menu pricing',()=>{
    const x=buildOwnerOrderCompatibility(base,lines,true,holds);
    expect(x.format).toBe('ITEMIZED');
    expect(x.ticketStatus).toBe('READY');
    expect(x.totalUnits).toBe(4);
    expect(x.summaryMatchesSavedSubtotal).toBe(true);
    expect(x.lines[0]?.nameTe).toBe('ఇడ్లీ');
    expect(x.ticketText).toContain('ఇడ్లీ');
    expect(x.ticketText).toContain('రాగి ఇడ్లీ');
    expect(x.ticketText).toContain('₹140.00');
    expect(renderItemizedOwnerTicket(x,'en')).toContain('Ragi Idly');
    expect(renderItemizedOwnerTicket(x,'en')).toContain('Verified payment');
  });
  it('never issues a paid ticket when payment proof or stock confirmation missing',()=>{
    const unpaid=buildOwnerOrderCompatibility({...base,payment_status:'PENDING'},lines,false,[]);
    expect(unpaid.ticketStatus).toBe('NOT_READY');
    expect(unpaid.ticketText).toBeNull();
    expect(()=>renderItemizedOwnerTicket(unpaid)).toThrow();
    const unverified=buildOwnerOrderCompatibility(base,lines,false,holds);
    expect(unverified.ticketBlockReason).toContain('verified payment');
    const unconfirmed=buildOwnerOrderCompatibility(base,lines,true,[]);
    expect(unconfirmed.ticketBlockReason).toContain('Stock reservation');
  });
  it('detects unbalanced saved totals, incorrect line prices and unknown IDs',()=>{
    const unbalanced=buildOwnerOrderCompatibility({...base,total_amount_paisa:15000},lines,true,holds);
    expect(unbalanced.ticketStatus).toBe('NOT_READY');
    expect(unbalanced.ticketBlockReason).toContain('reconcile');
    expect(()=>buildOwnerOrderCompatibility(base,[{...lines[0],line_total_paisa:2000}],true,holds)).toThrow('snapshot pricing');
    const unfamiliar=buildOwnerOrderCompatibility(
      {...base,subtotal_paisa:6000,total_amount_paisa:6000},
      [item('retired-id',2,3000,'Retired dish','మునుపటి వంట')],true,[]);
    expect(unfamiliar.ticketStatus).toBe('NOT_READY');
    expect(unfamiliar.ticketBlockReason).toContain('Unknown');
  });
  it('reads both legacy and itemized orders from schema without modifying data',async()=>{
    const db=createClient({url:':memory:'});
    try{
      for(const sql of DB_SCHEMA.split(';').map(x=>x.trim()).filter(Boolean))await db.execute(sql);
      const legacy={...base,id:'DB-LEGACY',jowar_quantity:5,chapathi_quantity:0,subtotal_paisa:15000,total_amount_paisa:15000,ticket_text:'Legacy original'};
      const modern={...base,id:'DB-MENU'};
      for(const o of [legacy,modern]){
        await db.execute({
          sql:[
            'INSERT INTO orders (id,public_token_hash,created_at_utc,created_at_ist,delivery_date,delivery_window,',
            'jowar_quantity,chapathi_quantity,total_items,jowar_unit_price_paisa,chapathi_unit_price_paisa,',
            'subtotal_paisa,delivery_charge_paisa,total_amount_paisa,payment_status,order_status,',
            'payment_provider,provider_payment_id,fulfillment_status,customer_name,customer_mobile,address,',
            'distance_km,created_by,updated_at,updated_by,ticket_text)',
            'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          ].join(' '),
          args:[o.id,'hash-'+o.id,'2026-10-10T00:00:00Z',o.created_at_ist,o.delivery_date,o.delivery_window,
            o.jowar_quantity,o.chapathi_quantity,o.id==='DB-LEGACY'?5:4,
            o.jowar_unit_price_paisa,o.chapathi_unit_price_paisa,
            o.subtotal_paisa,o.delivery_charge_paisa,o.total_amount_paisa,
            o.payment_status,'TICKET_GENERATED','razorpay',o.provider_payment_id,
            o.fulfillment_status,o.customer_name,o.customer_mobile,o.address,
            1,'CUSTOMER','2026-10-10','SYSTEM','ticket_text' in o ? String(o.ticket_text) : null],
        });
      }
      for(const line of lines){
        await db.execute({
          sql:[
            'INSERT INTO order_items (order_id,item_id,item_name_en,item_name_te,meal_period,sale_unit,pieces_per_unit,',
            'quantity,unit_price_paisa,line_total_paisa,created_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
          ].join(' '),
          args:['DB-MENU',line.item_id,line.item_name_en,line.item_name_te,line.meal_period,line.sale_unit,
            line.pieces_per_unit,line.quantity,line.unit_price_paisa,line.line_total_paisa,'2026-10-10'],
        });
      }
      for(const h of holds){
        await db.execute({
          sql:[
            'INSERT INTO menu_stock_reservations (order_id,item_id,delivery_date,quantity_plates,status,',
            'created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?)'
          ].join(' '),
          args:['DB-MENU',h.item_id,h.delivery_date,h.quantity_plates,h.status,'2026-10-10','2026-10-10'],
        });
      }
      await db.execute({
        sql:[
          'INSERT INTO payments (id,order_id,provider,provider_payment_id,amount_paisa,currency,status,verified_at,created_at,updated_at)',
          "VALUES (?,?,?,?,?,'INR','SUCCESS',?,?,?)",
        ].join(' '),args:['payment-1','DB-MENU','razorpay','pay_fixture',14000,'2026-10-10','2026-10-10','2026-10-10'],
      });
      const old=await loadOwnerOrderCompatibility(db,'DB-LEGACY');
      const next=await loadOwnerOrderCompatibility(db,'DB-MENU');
      expect(old?.ticketText).toBe('Legacy original');
      expect(next?.ticketStatus).toBe('READY');
      expect(next?.lines).toHaveLength(2);
      expect(await loadOwnerOrderCompatibility(db,'MISSING')).toBeNull();
      const historical=await db.execute("SELECT ticket_text FROM orders WHERE id='DB-LEGACY'");
      expect(historical.rows[0]?.ticket_text).toBe('Legacy original');
    }finally{db.close();}
  });
});