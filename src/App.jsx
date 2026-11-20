
import React, { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  Smartphone, Search, LogIn, LogOut, Upload, Download,
  ShieldCheck, Cpu, X, RefreshCw, Star, Clock3,
  HardDrive, PackageCheck, ChevronRight, Menu
} from "lucide-react";

const money = n => `৳${Number(n || 0).toLocaleString("en-US")}`;

const brands = [
  "All Brands", "Samsung", "Xiaomi", "Redmi", "Vivo",
  "OPPO", "Realme", "Tecno", "Infinix", "Itel", "Motorola"
];

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [firmwares, setFirmwares] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("home");
  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState("All Brands");
  const [sort, setSort] = useState("new");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [form, setForm] = useState({
    title: "", brand: "", model: "", version: "",
    price: "0", description: "", is_free: true
  });
  const [file, setFile] = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s)
    );
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    loadFirmware();
    if (session?.user) loadProfileAndOrders();
    else {
      setProfile(null);
      setOrders([]);
    }
  }, [session]);

  async function loadFirmware() {
    const { data, error } = await supabase
      .from("firmwares")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) setNotice(error.message);
    else setFirmwares(data || []);
  }

  async function loadProfileAndOrders() {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    setProfile(p);

    const { data: o, error } = await supabase
      .from("orders")
      .select("*, firmwares(title,price,is_free)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) setNotice(error.message);
    else setOrders(o || []);
  }

  const isAdmin = profile?.role === "admin";

  const filtered = useMemo(() => {
    let list = firmwares.filter(f => {
      const text = [f.title, f.brand, f.model, f.version]
        .join(" ").toLowerCase();
      const matchesSearch = text.includes(search.toLowerCase());
      const matchesBrand =
        brand === "All Brands" ||
        (f.brand || "").toLowerCase() === brand.toLowerCase();
      return matchesSearch && matchesBrand;
    });

    if (sort === "old") list = [...list].reverse();
    if (sort === "price") {
      list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    }
    return list;
  }, [firmwares, search, brand, sort]);

  async function authenticate(e) {
    e.preventDefault();
    setBusy(true);
    setNotice("");

    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, mobile } }
        });
        if (error) throw error;
        setNotice("রেজিস্ট্রেশন হয়েছে। ইমেইল কনফার্ম করুন।");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email, password
        });
        if (error) throw error;
        setNotice("লগইন সফল হয়েছে।");
        setTab("home");
      }
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTab("home");
  }

  async function downloadFirmware(f) {
    if (!session) {
      setNotice("ডাউনলোডের জন্য আগে লগইন করুন।");
      setTab("account");
      return;
    }

    if (!f.is_free) {
      const { data: approved } = await supabase
        .from("orders")
        .select("id")
        .eq("firmware_id", f.id)
        .eq("user_id", session.user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (!approved && !isAdmin) {
        setNotice("এই Firmware Premium। পেমেন্ট ব্যবস্থা শিগগিরই চালু হবে।");
        setTab("packages");
        return;
      }
    }

    const { data, error } = await supabase.storage
      .from("firmware-files")
      .createSignedUrl(f.storage_path, 90);

    if (error) setNotice(error.message);
    else window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function addFirmware(e) {
    e.preventDefault();

    if (!file) {
      setNotice("প্রথমে Firmware ফাইল নির্বাচন করুন।");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const safeName =
        `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const path = `${session.user.id}/${safeName}`;

      const up = await supabase.storage
        .from("firmware-files")
        .upload(path, file, { upsert: false });

      if (up.error) throw up.error;

      const { error } = await supabase.from("firmwares").insert({
        title: form.title,
        brand: form.brand,
        model: form.model,
        version: form.version,
        price: form.is_free ? 0 : Number(form.price),
        is_free: form.is_free,
        description: form.description,
        storage_path: path,
        uploaded_by: session.user.id,
        published: true
      });

      if (error) throw error;

      setForm({
        title: "", brand: "", model: "", version: "",
        price: "0", description: "", is_free: true
      });
      setFile(null);
      setNotice("Firmware সফলভাবে আপলোড হয়েছে।");
      await loadFirmware();
    } catch (e) {
      setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function loadAdminOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*, profiles!orders_user_id_profiles_fkey(full_name,email), firmwares(title)")
      .order("created_at", { ascending: false });

    if (error) setNotice(error.message);
    else setOrders(data || []);
  }

  async function updateOrder(id, status) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    setNotice(error ? error.message : "অর্ডারের অবস্থা আপডেট হয়েছে।");
    loadAdminOrders();
  }

  if (!isSupabaseConfigured) return <SetupScreen />;

  return (
    <div className="app-shell">
      <div className="top-strip">
        <span>GSMPLUS FIRMWARE DOWNLOAD CENTER</span>
        <span>বাংলাদেশের জন্য Firmware Portal</span>
      </div>

      <header className="topbar">
        <a className="brand" href="#" onClick={() => setTab("home")}>
          <span className="brand-icon"><Smartphone size={24}/></span>
          <span>GSM<span className="accent">PLUS</span>
            <small>REPAIR • FLASH • UPDATE</small>
          </span>
        </a>

        <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X/> : <Menu/>}
        </button>

        <nav className={mobileMenu ? "nav-open" : ""}>
          <button onClick={() => {setTab("home");setMobileMenu(false);}}>হোম</button>
          <button onClick={() => {setTab("packages");setMobileMenu(false);}}>প্যাকেজ</button>
          <button onClick={() => {setTab("orders");setMobileMenu(false);}}>আমার অর্ডার</button>
          {isAdmin && (
            <button onClick={() => {
              setTab("admin");
              setMobileMenu(false);
              loadAdminOrders();
            }}>অ্যাডমিন</button>
          )}
        </nav>

        <div className="head-actions">
          {session ? (
            <>
              <span className="user-email">{session.user.email}</span>
              <button className="outline" onClick={signOut}>
                <LogOut size={16}/> লগআউট
              </button>
            </>
          ) : (
            <button className="primary small" onClick={() => setTab("account")}>
              <LogIn size={16}/> লগইন
            </button>
          )}
        </div>
      </header>

      {notice && (
        <div className="notice">
          <span>{notice}</span>
          <button onClick={() => setNotice("")}><X size={16}/></button>
        </div>
      )}

      {tab === "home" && (
        <>
          <section className="hero">
            <div className="hero-content">
              <div className="eyebrow"><Cpu size={15}/> SMARTPHONE FIRMWARE PORTAL</div>
              <h1>আপনার ফোনের জন্য<br/><span>সঠিক Firmware</span></h1>
              <p>
                বিশ্বস্ত ফার্মওয়্যার, সহজ সার্চ এবং নিরাপদ ডাউনলোড।
                আপনার মোবাইল সার্ভিসিংয়ের প্রয়োজনীয় সবকিছু এক জায়গায়।
              </p>
              <button className="primary" onClick={() =>
                document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"})
              }>
                Firmware খুঁজুন <ChevronRight size={18}/>
              </button>
              <div className="hero-points">
                <span><ShieldCheck size={16}/> নিরাপদ ডাউনলোড</span>
                <span><PackageCheck size={16}/> Free Firmware</span>
              </div>
            </div>
            <div className="hero-art">
              <div className="hero-device">
                <Smartphone size={105}/>
                <b>GSMPLUS</b>
                <small>DOWNLOAD CENTER</small>
              </div>
            </div>
          </section>

          <section className="stats section">
            <div><HardDrive/><b>{firmwares.length}+</b><span>Firmware Files</span></div>
            <div><PackageCheck/><b>Free & Premium</b><span>Download Options</span></div>
            <div><ShieldCheck/><b>Secure</b><span>Protected Downloads</span></div>
          </section>

          <section className="section brand-section">
            <div className="section-title">
              <div className="eyebrow">BROWSE BY BRAND</div>
              <h2>আপনার ফোনের ব্র্যান্ড নির্বাচন করুন</h2>
            </div>
            <div className="brand-list">
              {brands.map(b => (
                <button
                  key={b}
                  className={brand === b ? "brand-chip active" : "brand-chip"}
                  onClick={() => {
                    setBrand(b);
                    document.getElementById("catalog")?.scrollIntoView({behavior:"smooth"});
                  }}
                >{b}</button>
              ))}
            </div>
          </section>

          <section id="catalog" className="section catalog-section">
            <div className="section-head">
              <div>
                <div className="eyebrow">DOWNLOAD CENTER</div>
                <h2>Firmware Catalog</h2>
                <p>ব্র্যান্ড, মডেল অথবা ভার্সন দিয়ে খুঁজুন।</p>
              </div>
              <div className="catalog-tools">
                <div className="search">
                  <Search size={18}/>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Samsung A12 খুঁজুন..."
                  />
                </div>
                <select value={sort} onChange={e => setSort(e.target.value)}>
                  <option value="new">নতুন আগে</option>
                  <option value="old">পুরোনো আগে</option>
                  <option value="price">কম দাম আগে</option>
                </select>
              </div>
            </div>

            <div className="active-filter">
              <span>{brand === "All Brands" ? "সব ব্র্যান্ড" : brand}</span>
              <button onClick={() => setBrand("All Brands")}>সব দেখুন</button>
            </div>

            <div className="cards">
              {filtered.map(f => (
                <article className="firmware-card" key={f.id}>
                  <div className="card-top">
                    <span className="tag">{f.brand || "Mobile"}</span>
                    <span className={f.is_free ? "free" : "paid"}>
                      {f.is_free ? "FREE" : money(f.price)}
                    </span>
                  </div>
                  <div className="firmware-icon"><Smartphone size={30}/></div>
                  <h3>{f.title}</h3>
                  <p className="muted">{f.model} {f.version && `• ${f.version}`}</p>
                  <p>{f.description || "Firmware details এখানে দেখুন।"}</p>
                  <button className="outline full" onClick={() => setSelected(f)}>
                    বিস্তারিত দেখুন
                  </button>
                  <button className="primary full" onClick={() => downloadFirmware(f)}>
                    {f.is_free ? "ডাউনলোড করুন" : "Premium Download"}
                    <Download size={16}/>
                  </button>
                </article>
              ))}
            </div>

            {!filtered.length && (
              <div className="empty">
                <Cpu size={40}/>
                <h3>এখনো কোনো Firmware পাওয়া যায়নি</h3>
                <p>অ্যাডমিন নতুন Firmware আপলোড করলে এখানে দেখা যাবে।</p>
              </div>
            )}
          </section>

          <section className="section feature-section">
            <div className="section-title">
              <div className="eyebrow">WHY GSMPLUS</div>
              <h2>GSMPLUS-এর সুবিধা</h2>
            </div>
            <div className="feature-grid">
              <div className="feature-card"><ShieldCheck/><h3>নিরাপদ ডাউনলোড</h3><p>সুরক্ষিত ফাইল লিংকের মাধ্যমে ডাউনলোড।</p></div>
              <div className="feature-card"><Search/><h3>সহজ সার্চ</h3><p>ব্র্যান্ড, মডেল ও ভার্সন দিয়ে Firmware খুঁজুন।</p></div>
              <div className="feature-card"><Clock3/><h3>নতুন আপডেট</h3><p>সর্বশেষ আপলোড করা Firmware এক জায়গায়।</p></div>
            </div>
          </section>
        </>
      )}

      {tab === "packages" && (
        <section className="section page-section">
          <div className="section-title">
            <div className="eyebrow">MEMBERSHIP & PRICING</div>
            <h2>GSMPLUS Packages</h2>
            <p>Free ও Premium সুবিধা। পেমেন্ট ব্যবস্থা পরে চালু হবে।</p>
          </div>
          <div className="package-grid">
            <div className="package-card">
              <span className="tag">FREE</span>
              <h2>Free Member</h2>
              <h3>৳০</h3>
              <p>ফ্রি Firmware ডাউনলোড</p>
              <p>সাধারণ User Account</p>
              <button className="outline full" onClick={() => setTab("account")}>অ্যাকাউন্ট খুলুন</button>
            </div>
            <div className="package-card popular">
              <span className="paid">PREMIUM</span>
              <h2>Premium Member</h2>
              <h3>শিগগিরই আসছে</h3>
              <p>Premium Firmware Access</p>
              <p>দ্রুত Download সুবিধা</p>
              <button className="primary full" onClick={() => setNotice("Premium পেমেন্ট ব্যবস্থা পরে চালু হবে।")}>Coming Soon</button>
            </div>
            <div className="package-card">
              <span className="tag">RESELLER</span>
              <h2>Reseller Plan</h2>
              <h3>শিগগিরই আসছে</h3>
              <p>Technician সুবিধা</p>
              <p>বিশেষ Download Access</p>
              <button className="outline full" onClick={() => setNotice("Reseller ব্যবস্থা পরে চালু হবে।")}>Coming Soon</button>
            </div>
          </div>
          <div className="payment-placeholder">
            <h3>Payment Methods</h3>
            <p>এই পেমেন্ট মাধ্যমগুলো ভবিষ্যতে চালু করা হবে। এখন কোনো টাকা পাঠাবেন না।</p>
            <div className="payment-methods">
              <span className="bkash">bKash</span>
              <span className="nagad">Nagad</span>
              <span className="rocket">Rocket</span>
            </div>
          </div>
        </section>
      )}

      {tab === "account" && (
        <section className="panel narrow page-section">
          <div className="eyebrow">CUSTOMER ACCOUNT</div>
          <h2>{authMode === "login" ? "লগইন করুন" : "নতুন অ্যাকাউন্ট খুলুন"}</h2>
          <form onSubmit={authenticate}>
            {authMode === "signup" && <>
              <label>আপনার নাম<input required value={fullName} onChange={e => setFullName(e.target.value)}/></label>
              <label>মোবাইল নম্বর<input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="01XXXXXXXXX"/></label>
            </>}
            <label>ইমেইল<input type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
            <label>পাসওয়ার্ড<input type="password" minLength="6" required value={password} onChange={e => setPassword(e.target.value)}/></label>
            <button className="primary full" disabled={busy}>
              {busy ? "অপেক্ষা করুন..." : authMode === "login" ? "লগইন" : "রেজিস্ট্রেশন"}
            </button>
          </form>
          <button className="text-button" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
            {authMode === "login" ? "নতুন অ্যাকাউন্ট খুলুন" : "আগে থেকেই অ্যাকাউন্ট আছে? লগইন"}
          </button>
        </section>
      )}

      {tab === "orders" && (
        <section className="section page-section">
          <div className="section-head">
            <div><div className="eyebrow">ACCOUNT CENTER</div><h2>আমার অর্ডার</h2></div>
            <button className="outline" onClick={loadProfileAndOrders}><RefreshCw size={15}/> রিফ্রেশ</button>
          </div>
          {!session ? <div className="empty">অর্ডার দেখতে লগইন করুন।</div> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Firmware</th><th>পরিমাণ</th><th>স্ট্যাটাস</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>{o.firmwares?.title || "Firmware"}</td>
                      <td>{money(o.amount)}</td>
                      <td><span className="tag">{o.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!orders.length && <p className="empty">এখনো কোনো অর্ডার নেই।</p>}
            </div>
          )}
        </section>
      )}

      {tab === "admin" && isAdmin && (
        <section className="section page-section">
          <div className="section-head">
            <div><div className="eyebrow">CONTROL CENTER</div><h2>Admin Dashboard</h2></div>
            <span className="admin-pill"><ShieldCheck size={16}/> ADMIN</span>
          </div>
          <div className="admin-grid">
            <div className="panel">
              <h3>নতুন Firmware আপলোড</h3>
              <form onSubmit={addFirmware}>
                <label>Firmware নাম<input required value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></label>
                <label>ব্র্যান্ড<input value={form.brand} onChange={e => setForm({...form,brand:e.target.value})}/></label>
                <label>মডেল<input value={form.model} onChange={e => setForm({...form,model:e.target.value})}/></label>
                <label>ভার্সন<input value={form.version} onChange={e => setForm({...form,version:e.target.value})}/></label>
                <label>বর্ণনা<textarea value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></label>
                <label className="check"><input type="checkbox" checked={form.is_free} onChange={e => setForm({...form,is_free:e.target.checked})}/> Free Firmware</label>
                {!form.is_free && <label>মূল্য (৳)<input type="number" min="0" value={form.price} onChange={e => setForm({...form,price:e.target.value})}/></label>}
                <label>Firmware ফাইল<input type="file" required onChange={e => setFile(e.target.files?.[0] || null)}/></label>
                <button className="primary full" disabled={busy}><Upload size={16}/> {busy ? "আপলোড হচ্ছে..." : "আপলোড করুন"}</button>
              </form>
            </div>
            <div className="panel">
              <h3>পেমেন্ট যাচাই</h3>
              <p className="muted">আগের জমা দেওয়া অর্ডার এখানে দেখা যাবে।</p>
              {orders.map(o => (
                <div className="order-row" key={o.id}>
                  <b>{o.firmwares?.title || "Firmware"}</b>
                  <small>{o.profiles?.email || o.transaction_id} · {o.status}</small>
                  <div>
                    <button className="approve" onClick={() => updateOrder(o.id,"approved")}>Approve</button>
                    <button className="reject" onClick={() => updateOrder(o.id,"rejected")}>Reject</button>
                  </div>
                </div>
              ))}
              {!orders.length && <p className="empty">এখনো কোনো পেমেন্ট অর্ডার নেই।</p>}
            </div>
          </div>
        </section>
      )}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="detail-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelected(null)}><X/></button>
            <div className="eyebrow">FIRMWARE DETAILS</div>
            <h2>{selected.title}</h2>
            <p><b>Brand:</b> {selected.brand}</p>
            <p><b>Model:</b> {selected.model}</p>
            <p><b>Version:</b> {selected.version}</p>
            <p><b>Type:</b> {selected.is_free ? "Free" : "Premium"}</p>
            <p>{selected.description}</p>
            <button className="primary full" onClick={() => {
              const f = selected;
              setSelected(null);
              downloadFirmware(f);
            }}>Download <Download size={16}/></button>
          </div>
        </div>
      )}

      <footer>
        <div className="brand">
          <span className="brand-icon"><Smartphone size={20}/></span>
          <b>GSM<span className="accent">PLUS</span></b>
        </div>
        <p>© {new Date().getFullYear()} GSMPLUS. All rights reserved.</p>
        <small>Firmware files are provided for legitimate device servicing only.</small>
      </footer>
    </div>
  );
}

function SetupScreen() {
  return (
    <div className="setup">
      <div className="setup-card">
        <div className="brand-icon"><Smartphone size={25}/></div>
        <h1>GSM<span className="accent">PLUS</span></h1>
        <h2>Supabase সংযোগ বাকি</h2>
        <p>Netlify Environment Variables-এ VITE_SUPABASE_URL এবং VITE_SUPABASE_ANON_KEY সঠিকভাবে যোগ করুন।</p>
      </div>
    </div>
  );
}
