// @vitest-environment jsdom
/** Browser-side owner controls; intercepted fetch only, no persistent DB/network. */
import { afterEach,describe,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { SmartMenuControls } from '../src/components/OwnerPortal/SmartMenuControls.tsx';

const date = new Date(Date.now()+330*60_000).toISOString().slice(0,10);
const empty = {
  holidayClosed:false,holidayReason:'',
  morningCutoffIst:null,eveningCutoffIst:null,
  curryName:'',curryNameTe:'',pauses:[]
};
const response=(json:unknown,status=200)=>({
  ok:status>=200&&status<300,status,json:async()=>json,
}) as Response;

afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('Stage 2B Smart Menu owner browser acceptance',()=>{
  it('loads saved date; owner edits curry, holiday, cutoff and shortage; sends exact CSRF-protected PUT',async()=>{
    const writes:unknown[]=[];
    const fetcher=vi.fn(async(url:string,opts?:RequestInit)=>{
      if(url.endsWith('/options'))return response({options:['Tomato Curry','Palakura Curry']});
      if(opts?.method==='PUT'){
        expect(opts.credentials).toBe('include');
        expect((opts.headers as Record<string,string>)['X-Requested-With']).toBe('XMLHttpRequest');
        writes.push(JSON.parse(String(opts.body)));
        return response({saved:true,date});
      }
      return response({...empty,date,curryName:'Tomato Curry'});
    });
    vi.stubGlobal('fetch',fetcher);
    render(<SmartMenuControls/>);
    fireEvent.click(screen.getByText('Smart Menu Availability · Owner Controls'));
    const save=screen.getByRole('button',{name:'Save availability settings'});
    await waitFor(()=>expect(save.hasAttribute('disabled')).toBe(false));
    expect((screen.getByLabelText(/Curry name \(required/) as HTMLInputElement).value).toBe('Tomato Curry');
    fireEvent.change(screen.getByLabelText(/Curry name \(required/),{target:{value:'Palakura Curry'}});
    fireEvent.change(screen.getByLabelText('Telugu name (optional)'),{target:{value:'పాలకూర కూర'}});
    fireEvent.click(screen.getByLabelText('Special holiday — stop new orders for both sessions'));
    fireEvent.change(screen.getByLabelText('Holiday reason'),{target:{value:'Private holiday'}});
    fireEvent.change(screen.getByLabelText('Morning (latest 10:30)'),{target:{value:'09:45'}});
    fireEvent.change(screen.getByLabelText('Availability for Idly'),{target:{value:'INGREDIENT_SHORTAGE'}});
    fireEvent.click(save);
    await waitFor(()=>expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      curryName:'Palakura Curry',curryNameTe:'పాలకూర కూర',
      holidayClosed:true,holidayReason:'Private holiday',morningCutoffIst:'09:45',
      pauses:[{itemId:'idly',reason:'INGREDIENT_SHORTAGE'}]
    });
    expect(await screen.findByText(/Only new orders use these controls/)).toBeTruthy();
  });
  it('fails closed on GET error; stale or blank data cannot be saved',async()=>{
    const fetcher=vi.fn(async(url:string)=>{
      if(url.endsWith('/options'))return response({options:[]});
      return response({error:'unavailable'},503);
    });
    vi.stubGlobal('fetch',fetcher);
    render(<SmartMenuControls/>);
    fireEvent.click(screen.getByText('Smart Menu Availability · Owner Controls'));
    await screen.findByText('Cannot load menu controls for this date');
    expect(screen.queryByRole('button',{name:'Save availability settings'})).toBeNull();
    expect(fetcher.mock.calls.every(([url])=>!String(url).includes('PUT'))).toBe(true);
  });
  it('failed save preserves owner input for safe retry; no fake saved confirmation',async()=>{
    let saveCount=0;
    const fetcher=vi.fn(async(url:string,opts?:RequestInit)=>{
      if(url.endsWith('/options'))return response({options:[]});
      if(opts?.method==='PUT'){
        saveCount++;
        if(saveCount===1)return response({error:'Isolated database unavailable'},503);
        return response({saved:true,date});
      }
      return response({...empty,date});
    });
    vi.stubGlobal('fetch',fetcher);
    render(<SmartMenuControls/>);
    fireEvent.click(screen.getByText('Smart Menu Availability · Owner Controls'));
    const save=screen.getByRole('button',{name:'Save availability settings'});
    await waitFor(()=>expect(save.hasAttribute('disabled')).toBe(false));
    const input=screen.getByLabelText(/Curry name \(required/) as HTMLInputElement;
    fireEvent.change(input,{target:{value:'Dal Curry'}});
    fireEvent.click(save);
    await screen.findByText('Isolated database unavailable');
    expect(input.value).toBe('Dal Curry');
    expect(screen.queryByText(/Only new orders use these controls/)).toBeNull();
    fireEvent.click(save);
    await screen.findByText(/Only new orders use these controls/);
    expect(saveCount).toBe(2);
  });
});
