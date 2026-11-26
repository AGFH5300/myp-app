import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Isolated route-handler tests. No Supabase requests, signup OTPs, users, or emails.
const previousEnv={node:process.env.NODE_ENV,debug:process.env.NEXT_PUBLIC_SIGNUP_DEBUG};
process.env.NODE_ENV='production';
process.env.NEXT_PUBLIC_SIGNUP_DEBUG='true';
after(()=>{
  if(previousEnv.node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousEnv.node;
  if(previousEnv.debug===undefined)delete process.env.NEXT_PUBLIC_SIGNUP_DEBUG;else process.env.NEXT_PUBLIC_SIGNUP_DEBUG=previousEnv.debug;
});
const error={code:'SYNTHETIC',message:'private_schema.internal_error',details:'sensitive diagnostic fixture'};
globalThis.__mypAuthMock={rpc:async()=>({data:null,error}),auth:{signInWithOtp:async()=>{throw new Error('OTP must not be called')}}};
const injected={
  'next/server':'export const NextResponse={json:(body,init)=>({body,status:init?.status??200,headers:init?.headers??{}})};',
  '@/lib/supabase/server':'export async function createClient(){return globalThis.__mypAuthMock}',
  '@/lib/auth-email':'export function isValidEmail(value){return typeof value==="string" && value.includes("@")}',
};
registerHooks({resolve(specifier,context,nextResolve){
  if(Object.hasOwn(injected,specifier))return{url:'data:text/javascript,'+encodeURIComponent(injected[specifier]),shortCircuit:true};
  return nextResolve(specifier,context);
}});
const base=resolve('app/api/auth');
const {GET:availability}=await import(pathToFileURL(base+'/availability/route.ts').href);
const {POST:startSignup}=await import(pathToFileURL(base+'/start-signup/route.ts').href);

test('production email availability RPC failures never expose debug details despite public flag',async()=>{
  const r=await availability(new Request('https://fixture.invalid/api/auth/availability?type=email&value=student@example.invalid'));
  assert.equal(r.status,500);
  assert.equal(Object.hasOwn(r.body,'debug'),false);
  assert.equal(JSON.stringify(r.body).includes('private_schema'),false);
});
test('production signup RPC failures never expose debug details despite public flag',async()=>{
  const r=await startSignup(new Request('https://fixture.invalid/api/auth/start-signup',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:'student_123',fullName:'Synthetic Student',email:'student@example.invalid'}),
  }));
  assert.equal(r.status,500);
  assert.equal(Object.hasOwn(r.body,'debug'),false);
  assert.equal(JSON.stringify(r.body).includes('private_schema'),false);
});

test('production OTP delivery errors do not echo provider diagnostics to anonymous clients',async()=>{
  const original=globalThis.__mypAuthMock;
  globalThis.__mypAuthMock={
    rpc:async()=>({data:true,error:null}),
    auth:{signInWithOtp:async()=>({error:{message:'provider_internal_secret_fixture'}})},
  };
  try {
    const r=await startSignup(new Request('https://fixture.invalid/api/auth/start-signup',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:'student_123',fullName:'Synthetic Student',email:'student@example.invalid'}),
    }));
    assert.equal(r.status,400);
    assert.equal(JSON.stringify(r.body).includes('provider_internal_secret_fixture'),false);
    assert.equal(Object.hasOwn(r.body,'debug'),false);
  } finally {
    globalThis.__mypAuthMock=original;
  }
});
