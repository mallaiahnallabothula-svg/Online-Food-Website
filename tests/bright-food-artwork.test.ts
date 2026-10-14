import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

const source=(path:string)=>fs.readFileSync(path,'utf8');
describe('Bright menu food illustration presentation',()=>{
  it('supports every real catalog ID with unique illustrated dish rendering',()=>{
    const catalog=source('shared/menuCatalog.ts');
    const art=source('src/components/FoodArtwork.tsx');
    const ids=['idly','ragi-idly','plain-pesarattu','onion-pesarattu','plain-minapa-dosa','onion-minapa-dosa','jowar-roti','chapathi','pulka','guntha-ponganaalu','pappu-of-the-day','mixed-veg-kurma'];
    for(const id of ids){expect(catalog).toContain("id: '"+id+"'");expect(art).toContain("'"+id+"'");}
    for(const type of ['LeafPlate','Chutney','Idlies','Dosa','Roti','Ponganalu','Curry'])expect(art).toContain(type);
    expect(art).toContain('aria-hidden="true"');
    expect(art).toContain('viewBox="0 0 160 160"');
  });
  it('preserves the menu/details artwork integration without changing ordering',()=>{
    expect(source('src/components/UpcomingMenuSection.tsx')).toContain('<FoodArtwork itemId={item.id}');
    expect(source('src/components/FoodDetailDialog.tsx')).toContain('<FoodArtwork itemId={item.id}');
    expect(source('src/components/UpcomingMenuSection.tsx')).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
  });
});
