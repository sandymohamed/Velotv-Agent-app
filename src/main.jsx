import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Activity,Users,Wallet,ArrowRightLeft,LogOut,RefreshCw,Plus} from 'lucide-react';
import {request} from './api';
import {money,timestamp} from './commerce';
import './base.css';
import './style.css';

const sessionKey='velotv-agent-session';
const base='/api/agent/';
function stored(){try{return JSON.parse(sessionStorage.getItem(sessionKey));}catch{return null;}}
function Brand(){return <div className="brand"><div className="brand-icon"><Activity size={22}/></div><div>VeloTV<span>Sales agent workspace</span></div></div>;}
function Login({onLogin}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{const data=await request(base+'login',{body:Object.fromEntries(new FormData(event.currentTarget))});
      if(data.payload?.role!=='agent')throw new Error('Sales agent account required.');onLogin({token:data.result,name:data.payload.username});
    }catch(err){setError(err.message);}finally{setBusy(false);}}
  return <main className="login"><section className="login-brand"><Brand/><div className="login-intro"><h1>Grow your<br/>reseller network.</h1><p>Invite resellers, fund their wallets and track your own sales.</p></div></section>
    <section className="login-form"><form className="panel form" onSubmit={submit}><h2>Sales agent sign in</h2>
      <label>Email or username<input name="username" required autoComplete="username" maxLength="255"/></label>
      <label>Password<input name="password" type="password" required autoComplete="current-password" maxLength="72"/></label>
      {error&&<p className="notice error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Signing in…':'Sign in'}</button>
    </form></section></main>;
}
function Dialog({title,busy,close,children}){
  const ref=useRef(null);useEffect(()=>{const node=ref.current;node.showModal();return()=>node.close();},[]);
  return <dialog ref={ref} className="panel agent-modal" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)close();}}><div className="section-head"><h2>{title}</h2><button className="secondary" disabled={busy} onClick={close}>Close</button></div>{children}</dialog>;
}
function AddReseller({api,close,done}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event){event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{const result=await api('resellers',{body:Object.fromEntries(new FormData(event.currentTarget))});
      done(result.invitation_delivery==='sent'?'Reseller created. A private setup link was emailed to the reseller.':'Reseller created with setup pending. Contact the administrator to deliver a private invitation.');
    }catch(err){setError(err.message);}finally{setBusy(false);}}
  return <Dialog title="Add reseller" busy={busy} close={close}><form className="form dialog-form" onSubmit={submit}><fieldset disabled={busy}>
    <p className="muted">The reseller chooses their own password using a private invitation. Their plan is assigned by the administrator.</p>
    <label>Username<input name="username" required minLength="2" maxLength="120"/></label>
    <label>Reseller email<input name="email" required type="email" maxLength="255" autoComplete="off"/></label>
    <label>Phone<input name="phone" maxLength="50"/></label>
    {error&&<p className="notice error" role="alert">{error}</p>}<button className="primary">{busy?'Creating…':'Create reseller'}</button>
  </fieldset></form></Dialog>;
}
function FundReseller({row,api,close,done}){
  const [amount,setAmount]=useState(''),[quote,setQuote]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const operation=useRef(null);
  async function preview(event){event.preventDefault();if(busy)return;setBusy(true);setError('');
    try{setQuote(await api('transfers/quote',{body:{reseller_id:row.id,amount}}));}catch(err){setError(err.message);}finally{setBusy(false);}}
  async function confirm(event){event.preventDefault();if(busy||!quote)return;setBusy(true);setError('');operation.current??=crypto.randomUUID();
    try{const result=await api('transfers',{key:operation.current,body:{reseller_id:row.id,amount:quote.face_amount,expected_cost:quote.cost_amount,expected_margin_bps:quote.margin_bps}});
      done(`${money(result.face_amount)} added to ${row.username}. Your wallet was charged ${money(result.cost_amount)}. Margin: ${money(result.margin_amount)}.`);
    }catch(err){setError(err.message+' If the response was lost, retry here with the same operation or review Transfers before starting another.');}finally{setBusy(false);}}
  return <Dialog title={'Fund '+row.username} busy={busy} close={close}>{!quote?<form className="form dialog-form" onSubmit={preview}>
    <label>Reseller wallet credit (EUR)<input value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0.01" max="99999.99" step="0.01" required/></label>
    <p className="muted">Credit comes from your prepaid balance. Your margin applies only to transfers you sell yourself.</p>
    {error&&<p className="notice error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Calculating…':'Review transfer'}</button>
  </form>:<form className="form dialog-form" onSubmit={confirm}><div className="transfer-summary">
    <p>Reseller receives <strong>{money(quote.face_amount)}</strong></p><p>Your wallet cost <strong>{money(quote.cost_amount)}</strong></p>
    <p>Sales margin <strong>{money(quote.margin_amount)} · {quote.margin_bps/100}%</strong></p><p>Your remaining balance <strong>{money(quote.agent_balance_after)}</strong></p>
    </div><p className="muted">The margin assumes you collect the listed credit value from the reseller. There is no separate commission payout.</p>
    {error&&<p className="notice error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Transferring…':'Confirm transfer'}</button>
  </form>}</Dialog>;
}
const sections=[['overview','Overview',Activity],['resellers','My resellers',Users],['transfers','Transfers',ArrowRightLeft],['wallet','Wallet',Wallet]];
function App(){
  const [session,setSession]=useState(stored),[section,setSection]=useState('overview'),[page,setPage]=useState(0),[search,setSearch]=useState('');
  const [revision,refresh]=useState(0),[state,setState]=useState({loading:true,value:null,error:''}),[summary,setSummary]=useState(null),[modal,setModal]=useState(null),[notice,setNotice]=useState('');
  const [resending,setResending]=useState(null);
  const changeSession=useCallback(value=>{if(value)sessionStorage.setItem(sessionKey,JSON.stringify(value));else sessionStorage.removeItem(sessionKey);setSession(value);setModal(null);setSummary(null);setNotice('');},[]);
  const api=useCallback((path,options={})=>request(base+path,{token:session?.token,...options}).catch(err=>{if(err.status===401)changeSession(null);throw err;}),[session?.token,changeSession]);
  useEffect(()=>{
    if(!session)return;const controller=new AbortController();setState({loading:true,value:null,error:''});
    const path=section==='resellers'?'resellers?'+new URLSearchParams({page,search}):section==='overview'?'overview':section+'?'+new URLSearchParams({page});
    Promise.all([api(path,{signal:controller.signal}),api('overview',{signal:controller.signal})]).then(([value,profile])=>{if(!controller.signal.aborted){setState({loading:false,value,error:''});setSummary(profile);}})
      .catch(err=>{if(!controller.signal.aborted)setState({loading:false,value:null,error:err.message});});
    return()=>controller.abort();
  },[api,session,section,page,search,revision]);
  async function resend(row){if(resending!==null)return;setResending(row.id);setNotice('');try{const data=await api('resellers/'+row.id+'/invitation',{body:{}});setNotice(data.delivery==='sent'?'Invitation emailed to the reseller.':'Invitation delivery needs administrator assistance.');}catch(err){setNotice(err.message);}finally{setResending(null);}}
  if(!session)return <Login onLogin={changeSession}/>;
  const value=state.value,done=message=>{setModal(null);setNotice(message);refresh(x=>x+1);};
  return <div className="shell agent-shell"><aside className="sidebar"><Brand/><nav aria-label="Agent navigation">{sections.map(([id,label,Icon])=><button key={id} className={section===id?'current':''} onClick={()=>{setSection(id);setPage(0);setSearch('');setNotice('');}}><Icon size={18}/>{label}</button>)}</nav>
    <div className="sidebar-foot"><p>{session.name}</p><button onClick={()=>changeSession(null)}><LogOut size={18}/>Sign out</button></div></aside>
    <main className="main"><header className="topbar"><span>Prepaid sales agent · {(summary?.margin_bps??1000)/100}% margin</span><span>{money(summary?.balance)} <button className="icon-button" aria-label="Refresh" onClick={()=>refresh(x=>x+1)}><RefreshCw size={17}/></button></span></header>
      <div className="content"><div className="page-head"><h1>{sections.find(s=>s[0]===section)[1]}</h1>{section==='resellers'&&<button className="primary" onClick={()=>setModal({type:'create'})}><Plus size={16}/>Add reseller</button>}</div>
        {notice&&<p className="notice" role="status">{notice}</p>}{state.error&&<p className="notice error" role="alert">{state.error}</p>}{state.loading&&<p role="status">Loading…</p>}
        {value&&section==='overview'&&<><div className="metrics">{[['Prepaid balance',money(value.balance)],['Resellers',value.reseller_count],['Credit sold',money(value.sales_total)],['Gross sales margin',money(value.margin_total)]].map(([label,total])=><div className="panel metric" key={label}><p>{label}</p><strong>{total}</strong></div>)}</div>
          <section className="panel section"><h2>Sell credits, keep your margin</h2><p>For a €20 reseller credit transfer, your prepaid wallet is charged €18 and your listed sales margin is €2.</p>
            <p className="muted">Direct admin and PayPal top-ups do not earn an agent margin. Ask the administrator to fund your prepaid wallet after your payment.</p>
            <button className="primary" onClick={()=>setSection('resellers')}>Manage my resellers</button></section></>}
        {value&&section==='resellers'&&<section className="panel section"><form className="toolbar" onSubmit={e=>{e.preventDefault();setSearch(new FormData(e.currentTarget).get('search'));setPage(0);}}>
          <input name="search" maxLength="120" aria-label="Search resellers" placeholder="Name, email or phone"/><button className="secondary">Search</button></form>
          <p className="muted">Spending and device counts are aggregate totals. Device identities, packages and playlists are private to the reseller.</p>
          <Table rows={value.rows} headers={['Reseller','Status','Wallet','Total spent','Device count','Actions']} render={r=><tr key={r.id}><td><strong>{r.username}</strong><small>#{r.id} · {r.email}</small></td><td>{r.state}</td><td>{money(r.wallet_balance)}</td><td>{money(r.spent_total)}</td><td>{r.device_count}</td>
            <td><div className="actions"><button className="text-button" disabled={r.state!=='active'} onClick={()=>setModal({type:'fund',row:r})}>Add credit</button>{Number(r.onboarding_pending)===1&&<button className="text-button" disabled={resending!==null} onClick={()=>resend(r)}>Resend invitation</button>}</div></td></tr>}/><Pager page={page} count={value.count} size={50} setPage={setPage}/>
        </section>}
        {value&&section==='transfers'&&<section className="panel section"><h2>Your credit sales</h2><Table rows={value.rows} headers={['Date','Reseller ID','Credit value','Your cost','Margin','Remaining balance','Reference']} render={r=><tr key={r.id}><td>{timestamp(r.created_at)}</td><td>#{r.reseller_id}</td><td>{money(r.face_amount)}</td><td>{money(r.cost_amount)}</td><td>{money(r.margin_amount)}</td><td>{money(r.agent_balance_after)}</td><td>{r.reference}</td></tr>}/><Pager page={page} count={value.count} size={100} setPage={setPage}/></section>}
        {value&&section==='wallet'&&<section className="panel section"><h2>Prepaid wallet history</h2><p className="muted">Funding is recorded by the administrator after payment. Transfers debit your own balance.</p><Table rows={value.rows} headers={['Date','Operation','Change','Previous','New balance']} render={r=><tr key={r.id}><td>{timestamp(r.created_at)}</td><td>{r.kind}</td><td>{money(r.delta)}</td><td>{money(r.old_balance)}</td><td>{money(r.new_balance)}</td></tr>}/><Pager page={page} count={value.count} size={100} setPage={setPage}/></section>}
      </div></main>
    {modal?.type==='create'&&<AddReseller api={api} close={()=>setModal(null)} done={done}/>}{modal?.type==='fund'&&<FundReseller row={modal.row} api={api} close={()=>setModal(null)} done={done}/>}
  </div>;
}
function Table({rows,headers,render}){return rows?.length?<div className="table-scroll" tabIndex="0" role="region" aria-label="Results"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(render)}</tbody></table></div>:<p className="table-message">No records yet.</p>;}
function Pager({page,count,size,setPage}){return <div className="pagination"><span>{count} results · Page {page+1}</span><button className="secondary" disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><button className="secondary" disabled={(page+1)*size>=count} onClick={()=>setPage(page+1)}>Next</button></div>;}
createRoot(document.getElementById('root')).render(<App/>);
