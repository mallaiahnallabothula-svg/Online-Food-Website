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
  'pappu-of-the-day': '66.667% 100%',
  'mixed-veg-kurma': '100% 100%',
};
const textFree = { 'pulka': '100% 50%' } as const;
describe('Bright menu illustrations',()=>{
  it('maps all 12 real items to unique illustrated local image panels',()=>{
    const catalog=source('shared/menuCatalog.ts');
    const art=source('src/components/FoodArtwork.tsx');
    for(const id of ids)expect(catalog).toContain("id: '"+id+"'");
    expect(new Set([...Object.keys(four),...Object.keys(eight),...Object.keys(textFree),'guntha-ponganaalu']).size).toBe(12);
    for(const [id,pos] of Object.entries(four))expect(art).toContain(`'${id}': '${pos}'`);
    for(const [id,pos] of Object.entries(eight))expect(art).toContain(`'${id}': '${pos}'`);
    for(const [id,pos] of Object.entries(textFree))expect(art).toContain(`'${id}': '${pos}'`);
    expect(art).toContain("'punugulu': '0% 50%'");
    expect(catalog).not.toContain("id: 'punugulu'");
    expect(art).toContain("textFreePanel ? '200% 100%'");
    expect(art).toContain('aspect-square h-full max-w-full');
    expect(art).toContain('data-exact-artwork={itemId}');
    expect(art).toContain("if (itemId === 'guntha-ponganaalu')");
    expect(art).toContain('data-guntha-artwork="true"');
    expect(art).toContain('src="/images/mannus-guntha-ponganaalu.webp"');
    expect(art).toContain('object-contain');
    expect(art).toContain('aspect-[3/2]');
    expect(art).toContain("'200% 200%' : '400% 200%'");
  });
  it('ships local sprite and standalone food assets as valid optimized WebP files',()=>{
    for(const asset of ['public/images/mannus-food-illustration-grid.webp','public/images/mannus-eight-additional-illustrations.webp','public/images/mannus-guntha-ponganaalu.webp','public/images/mannus-punugulu-pulka-text-free.webp']){
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
