import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
const source = (path:string) => fs.readFileSync(path,'utf8');
const ids = ['idly','ragi-idly','plain-pesarattu','onion-pesarattu','plain-minapa-dosa','onion-minapa-dosa','jowar-roti','chapathi','pulka','guntha-ponganaalu','pappu-of-the-day','mixed-veg-kurma'] as const;
const four = {
  'idly': '0% 0%',
  'onion-minapa-dosa': '100% 0%',
  'onion-pesarattu': '0% 100%',
  'chapathi': '100% 100%',
};
const eight = {
  'ragi-idly': '0% 0%',
  'plain-pesarattu': '33.333% 0%',
  'plain-minapa-dosa': '66.667% 0%',
  'jowar-roti': '100% 0%',
  'pulka': '0% 100%',
  'guntha-ponganaalu': '33.333% 100%',
  'pappu-of-the-day': '66.667% 100%',
  'mixed-veg-kurma': '100% 100%',
};
describe('Bright menu illustrations',()=>{
  it('maps all 12 real items to unique illustrated local image panels',()=>{
    const catalog=source('shared/menuCatalog.ts');
    const art=source('src/components/FoodArtwork.tsx');
    for(const id of ids)expect(catalog).toContain("id: '"+id+"'");
    expect(new Set([...Object.keys(four),...Object.keys(eight)]).size).toBe(12);
    for(const [id,pos] of Object.entries(four))expect(art).toContain(`'${id}': '${pos}'`);
    for(const [id,pos] of Object.entries(eight))expect(art).toContain(`'${id}': '${pos}'`);
    expect(art).toContain('data-exact-artwork={itemId}');
    expect(art).toContain('aspect-[3/2]');
    expect(art).toContain("'200% 200%' : '400% 200%'");
  });
  it('ships both local sprite assets as valid optimized WebP files',()=>{
    for(const asset of ['public/images/mannus-food-illustration-grid.webp','public/images/mannus-eight-additional-illustrations.webp']){
      const bytes=fs.readFileSync(asset);
      expect(bytes.subarray(0,4).toString()).toBe('RIFF');
      expect(bytes.subarray(8,12).toString()).toBe('WEBP');
      expect(bytes.byteLength).toBeLessThan(120000);
    }
  });
  it('uses same artwork in menu and details without changing ordering',()=>{
    expect(source('src/components/UpcomingMenuSection.tsx')).toContain('<FoodArtwork itemId={item.id}');
    expect(source('src/components/FoodDetailDialog.tsx')).toContain('<FoodArtwork itemId={item.id}');
    expect(source('src/components/UpcomingMenuSection.tsx')).toContain('onCheckout?.({ period, lines: selected, subtotalPaisa })');
  });
});
