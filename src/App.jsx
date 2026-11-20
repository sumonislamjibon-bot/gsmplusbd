import React, { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import { Smartphone, Search, LogIn, LogOut, Upload, Download, ShieldCheck, Cpu, Menu, X, RefreshCw } from "lucide-react";

const money = n => `৳${Number(n || 0).toLocaleString("en-US")}`;

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [firmwares, setFirmwares] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("home");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [selected, setSelected] = useState(null);
  const [trx, setTrx] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("বিকাশ");
  const [form, setForm] = useState({ title:"", brand:"", model:"", version:"", price:"0", description:"", is_free:true });
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    loadFirmware();
    if (session?.user) loadProfileAndOrders();
    else { setProfile(null); setOrders([]); }
  }, [session]);

  async function loadFirmware() {
    const { data, error } = await supabase.from("firmwares").select("*").eq("published", true).order("created_at", { ascending:false });
    if (error) setNotice(error.message); else setFirmwares(data || []);
  }
  async function loadProfileAndOrders() {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
    setProfile(p);
    const { data: o } = await supabase.from("orders").select("*, firmwares(title,price,is_free)").eq("user_id", session.user.id).order("created_at", { ascending:false });
    setOrders(o || []);
  }
  const isAdmin = profile?.role === "admin";
  const filtered = useMemo(() => firmwares.filter(f => [f.title,f.brand,f.model,f.version].join(" ").toLowerCase().includes(search.toLowerCase())), [firmwares,search]);

  async function authenticate(e) {
    e.preventDefault(); setBusy(true); setNotice("");
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options:{ data:{ full_name:fullName, mobile } } });
        if (error) throw error;
        setNotice("রেজিস্ট্রেশন হয়েছে। ইমেইল কনফার্মেশন চালু থাকলে ইনবক্স দেখে নিশ্চিত করুন।");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setNotice("লগইন সফল হয়েছে।");
      }
    } catch(e) { setNotice(e.message); }
    finally { setBusy(false); }
  }
  async function signOut() { await supabase.auth.signOut(); setTab("home"); }
  async function requestOrder(f) {
    if (!session) { setNotice("অর্ডার করতে আগে লগইন করুন।"); setTab("account"); return; }
    if (f.is_free) { await downloadFirmware(f); return; }
    setSelected(f); setTrx(""); setTab("payment");
  }
  async function submitOrder(e) {
    e.preventDefault(); if (!selected || !trx.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("orders").insert({
      user_id:session.user.id, firmware_id:selected.id, payment_method:paymentMethod,
      transaction_id:trx.trim(), amount:selected.price, status:"pending"
    });
    setBusy(false);
    if (error) setNotice(error.message);
    else { setNotice("অর্ডার জমা হয়েছে। অ্যাডমিন পেমেন্ট যাচাই করলে ডাউনলোড চালু হবে।"); setSelected(null); setTab("orders"); loadProfileAndOrders(); }
  }
  async function downloadFirmware(f) {
    if (!session) { setNotice("ডাউনলোডের জন্য আগে লগইন করুন।"); setTab("account"); return; }
    if (!f.is_free) {
      const { data: approved } = await supabase.from("orders").select("id").eq("firmware_id",f.id).eq("user_id",session.user.id).eq("status","approved").maybeSingle();
      if (!approved && !isAdmin) { setNotice("এই ফার্মওয়্যারটি পেইড। আগে অর্ডার ও পেমেন্ট সম্পন্ন করুন।"); return; }
    }
    const { data, error } = await supabase.storage.from("firmware-files").createSignedUrl(f.storage_path, 90);
    if (error) setNotice(error.message); else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }
  async function addFirmware(e) {
    e.preventDefault();
    if (!file) { setNotice("প্রথমে firmware ফাইল নির্বাচন করুন।"); return; }
    setBusy(true); setNotice("");
    try {
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
      const path = `${session.user.id}/${safeName}`;
      const up = await supabase.storage.from("firmware-files").upload(path,file,{ upsert:false });
      if (up.error) throw up.error;
      const { error } = await supabase.from("firmwares").insert({
        title:form.title, brand:form.brand, model:form.model, version:form.version,
        price:form.is_free ? 0 : Number(form.price), is_free:form.is_free,
        description:form.description, storage_path:path, uploaded_by:session.user.id, published:true
      });
      if (error) throw error;
      setForm({title:"",brand:"",model:"",version:"",price:"0",description:"",is_free:true}); setFile(null);
      setNotice("Firmware যোগ হয়েছে।"); loadFirmware();
    } catch(e) { setNotice(e.message); }
    finally { setBusy(false); }
  }
  async function updateOrder(id,status) {
    const { error } = await supabase.from("orders").update({status}).eq("id",id);
    setNotice(error ? error.message : "অর্ডারের অবস্থা আপডেট হয়েছে।"); loadAdminOrders();
  }
  async function loadAdminOrders() {
    const { data,error } = await supabase.from("orders").select("*, profiles(full_name,email), firmwares(title)").order("created_at",{ascending:false});
    if (error) setNotice(error.message); else setOrders(data || []);
  }

  if (!isSupabaseConfigured) return <SetupScreen />;
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={()=>setTab("home")}><span className="brand-icon"><Smartphone size={23}/></span><span>GSM<span className="accent">PLUS</span><small>FIRMWARE & MOBILE SERVICE</small></span></a>
      <nav><button onClick={()=>setTab("home")}>হোম</button><button onClick={()=>setTab("orders")}>আমার অর্ডার</button>{isAdmin && <button onClick={()=>{setTab("admin");loadAdminOrders();}}>অ্যাডমিন</button>}</nav>
      <div className="head-actions">{session ? <><span className="user-email">{session.user.email}</span><button className="outline" onClick={signOut}><LogOut size={16}/> লগআউট</button></> : <button className="primary small" onClick={()=>setTab("account")}><LogIn size={16}/> লগইন</button>}</div>
    </header>
    <main>
      <section className="hero"><div><div className="eyebrow"><Cpu size={15}/> SMARTPHONE FIRMWARE PORTAL</div><h1>আপনার ফোনের জন্য<br/><span>সঠিক Firmware</span></h1><p>বিশ্বস্ত ফার্মওয়্যার, সহজ অর্ডার এবং নিরাপদ ডাউনলোড—এক জায়গায়।</p><button className="primary" onClick={()=>document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"})}>Firmware দেখুন <Download size={17}/></button></div><div className="hero-art"><div className="chip"><Cpu size={88}/><b>GSMPLUS</b><small>REPAIR • FLASH • UPDATE</small></div></div></section>
      {notice && <div className="notice"><span>{notice}</span><button onClick={()=>setNotice("")}><X size={16}/></button></div>}
      {tab === "home" && <section id="catalog" className="section"><div className="section-head"><div><div className="eyebrow">DOWNLOAD CENTER</div><h2>Firmware Catalog</h2><p>ব্র্যান্ড, মডেল অথবা ভার্সন দিয়ে খুঁজুন।</p></div><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="যেমন: Samsung A12"/></div></div>
        <div className="cards">{filtered.map(f=><article className="firmware-card" key={f.id}><div className="card-top"><span className="tag">{f.brand || "Mobile"}</span><span className={f.is_free?"free":"paid"}>{f.is_free?"FREE":money(f.price)}</span></div><h3>{f.title}</h3><p className="muted">{f.model} {f.version && `• ${f.version}`}</p><p>{f.description || "Firmware details এখানে দেখুন।"}</p><button className="primary full" onClick={()=>requestOrder(f)}>{f.is_free?"ডাউনলোড":"অর্ডার করুন"} {f.is_free?<Download size={16}/>:<span>→</span>}</button></article>)}</div>
        {!filtered.length && <div className="empty"><Cpu size={35}/><h3>এখনো কোনো Firmware যোগ করা হয়নি</h3><p>অ্যাডমিন লগইন করে প্রথম ফাইলটি আপলোড করতে পারবেন।</p></div>}
      </section>}
      {tab === "account" && <section className="panel narrow"><div className="eyebrow">CUSTOMER ACCOUNT</div><h2>{authMode==="login"?"লগইন করুন":"নতুন অ্যাকাউন্ট খুলুন"}</h2><form onSubmit={authenticate}>{authMode==="signup" && <><label>আপনার নাম<input required value={fullName} onChange={e=>setFullName(e.target.value)}/></label><label>মোবাইল নম্বর<input value={mobile} onChange={e=>setMobile(e.target.value)} placeholder="01XXXXXXXXX"/></label></>}<label>ইমেইল<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>পাসওয়ার্ড<input type="password" minLength="6" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary full" disabled={busy}>{busy?"অপেক্ষা করুন...":authMode==="login"?"লগইন":"রেজিস্ট্রেশন"}</button></form><button className="text-button" onClick={()=>setAuthMode(authMode==="login"?"signup":"login")}>{authMode==="login"?"নতুন অ্যাকাউন্ট খুলুন":"আগে থেকেই অ্যাকাউন্ট আছে? লগইন"}</button></section>}
      {tab === "payment" && selected && <section className="panel narrow"><div className="eyebrow">MANUAL PAYMENT</div><h2>পেমেন্ট তথ্য জমা দিন</h2><p>{selected.title} — <b>{money(selected.price)}</b></p><div className="payment-note">বিকাশ / নগদ / রকেট নম্বর ওয়েবসাইটের মালিকের কাছ থেকে নিশ্চিত করে নিন। টাকা পাঠানোর পর Transaction ID দিন।</div><form onSubmit={submitOrder}><label>পেমেন্ট মাধ্যম<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>বিকাশ</option><option>নগদ</option><option>রকেট</option></select></label><label>Transaction ID<input required value={trx} onChange={e=>setTrx(e.target.value)} placeholder="TrxID"/></label><button className="primary full" disabled={busy}>অর্ডার জমা দিন</button></form></section>}
      {tab === "orders" && <section className="section"><div className="section-head"><div><div className="eyebrow">ORDER HISTORY</div><h2>আমার অর্ডার</h2></div><button className="outline" onClick={loadProfileAndOrders}><RefreshCw size={15}/> রিফ্রেশ</button></div>{!session?<p className="empty">অর্ডার দেখতে লগইন করুন।</p>:<div className="table-wrap"><table><thead><tr><th>Firmware</th><th>পরিমাণ</th><th>স্ট্যাটাস</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.firmwares?.title || "Firmware"}</td><td>{money(o.amount)}</td><td><span className="tag">{o.status}</span></td></tr>)}</tbody></table></div>}</section>}
      {tab === "admin" && isAdmin && <section className="section"><div className="section-head"><div><div className="eyebrow">CONTROL CENTER</div><h2>Admin Dashboard</h2></div><span className="admin-pill"><ShieldCheck size={16}/> ADMIN</span></div><div className="admin-grid"><div className="panel"><h3>নতুন Firmware আপলোড</h3><form onSubmit={addFirmware}><label>Firmware নাম<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>ব্র্যান্ড<input value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})}/></label><label>মডেল<input value={form.model} onChange={e=>setForm({...form,model:e.target.value})}/></label><label>ভার্সন<input value={form.version} onChange={e=>setForm({...form,version:e.target.value})}/></label><label>বর্ণনা<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><label className="check"><input type="checkbox" checked={form.is_free} onChange={e=>setForm({...form,is_free:e.target.checked})}/> Free Firmware</label>{!form.is_free && <label>মূল্য (৳)<input type="number" min="0" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>}<label>Firmware ফাইল<input type="file" required onChange={e=>setFile(e.target.files?.[0] || null)}/></label><button className="primary full" disabled={busy}><Upload size={16}/> আপলোড করুন</button></form></div><div className="panel"><h3>পেমেন্ট যাচাই</h3><p className="muted">কাস্টমারের Transaction ID যাচাই করে Approve বা Reject করুন।</p>{orders.map(o=><div className="order-row" key={o.id}><b>{o.firmwares?.title || "Firmware"}</b><small>{o.transaction_id} · {o.status}</small><div><button className="approve" onClick={()=>updateOrder(o.id,"approved")}>Approve</button><button className="reject" onClick={()=>updateOrder(o.id,"rejected")}>Reject</button></div></div>)}</div></div></section>}
    </main>
    <footer><div className="brand"><span className="brand-icon"><Smartphone size={20}/></span><b>GSM<span className="accent">PLUS</span></b></div><p>© {new Date().getFullYear()} GSMPLUS. All rights reserved.</p><small>Firmware files are provided for legitimate device servicing only.</small></footer>
  </div>;
}

function SetupScreen() {
  return <div className="setup"><div className="setup-card"><div className="brand-icon"><Smartphone size={25}/></div><h1>GSM<span className="accent">PLUS</span></h1><h2>Supabase সংযোগ বাকি</h2><p>Netlify Environment Variables-এ নিচের দুটি নাম ও মান সঠিকভাবে যোগ করে নতুন Deploy করুন।</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code><p className="muted">Deploy-এর আগে Supabase SQL সেটআপও সম্পন্ন করতে হবে। বিস্তারিত README.md ফাইলে আছে।</p></div></div>;
}
