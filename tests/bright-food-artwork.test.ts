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
  it('references the exact four cropped user artwork panels without substituting other dishes',()=>{
    const art=source('src/components/FoodArtwork.tsx');
    expect(art).toContain('/images/mannus-food-illustration-grid.webp');
    for(const [id,pos] of [['idly','0% 0%'],['onion-minapa-dosa','100% 0%'],['onion-pesarattu','0% 100%'],['chapathi','100% 100%']]) {
      expect(art).toContain(`'${id}': '${pos}'`);
    }
    expect(art).toContain("backgroundSize: '200% 200%'");
    expect(art).toContain('aspect-[3/2]');
    expect(art).toContain('const exactPanel = EXACT_REFERENCE_PANELS[itemId]');
  });
  it('preserves the menu/details artwork integration without changing ordering',()=>{
    expect(source('src/components/UpcomingMenuSection.tsx')).toContain('<FoodArtwork itemId={item.id}');
    expect(source('src/components/FoodDetailDialog.tsx')).toContain('<FoodArtwork itemId={item.id}');
    expect(source('src/components/UpcomingMenuSection.tsx')).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
  });
});
