
import React, { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  Smartphone, Search, LogIn, LogOut, Upload, Download,
  ShieldCheck, Cpu, X, RefreshCw, Clock3, HardDrive,
  PackageCheck, ChevronRight, Menu, User, Bell,
  FileQuestion, Store, Save, Send, CheckCircle,
  AlertCircle
} from "lucide-react";

const money = n => `৳${Number(n || 0).toLocaleString("en-US")}`;

const brands = [
  "All Brands", "Samsung", "Xiaomi", "Redmi", "Vivo",
  "OPPO", "Realme", "Tecno", "Infinix", "Itel", "Motorola"
];

const statusText = status => ({
  pending: "অপেক্ষমাণ",
  approved: "অনুমোদিত",
  rejected: "বাতিল",
  completed: "সম্পন্ন"
}[status] || status || "অজানা");

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [firmwares, setFirmwares] = useState([]);
  const [orders, setOrders] = useState([]);
  const [requests, setRequests] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [applications, setApplications] = useState([]);
  const [myApplication, setMyApplication] = useState(null);

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
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selected, setSelected] = useState(null);

  const [profileForm, setProfileForm] = useState({
    full_name: "", mobile: ""
  });

  const [form, setForm] = useState({
    title: "", brand: "", model: "", version: "",
    price: "0", description: "", is_free: true
  });
  const [file, setFile] = useState(null);

  const [requestForm, setRequestForm] = useState({
    brand: "", model: "", details: ""
  });

  const [resellerForm, setResellerForm] = useState({
    business_name: "", mobile: "", message: ""
  });

  const [announcementForm, setAnnouncementForm] = useState({
    title: "", content: ""
  });

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => setSession(currentSession)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!supabase) return;
    loadFirmware();
    loadAnnouncements();

    if (session?.user) {
      loadProfileAndOrders();
      loadMyApplication();
    } else {
      setProfile(null);
      setOrders([]);
      setMyApplication(null);
    }
  }, [session]);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin]);

  async function loadFirmware() {
    const { data, error } = await supabase
      .from("firmwares")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (error) setNotice(error.message);
    else setFirmwares(data || []);
  }

  async function loadAnnouncements() {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });

    if (!error) setAnnouncements(data || []);
  }

  async function loadProfileAndOrders() {
    if (!session?.user) return;

    const { data: p, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) setNotice(profileError.message);
    setProfile(p || null);

    setProfileForm({
      full_name: p?.full_name || session.user.user_metadata?.full_name || "",
      mobile: p?.mobile || session.user.user_metadata?.mobile || ""
    });

    const { data: o, error } = await supabase
      .from("orders")
      .select("*, firmwares(title,price,is_free)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) setNotice(error.message);
    else setOrders(o || []);
  }

  async function loadMyApplication() {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from("reseller_applications")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!error) {
      setMyApplication(data || null);
      if (data) {
        setResellerForm({
          business_name: data.business_name || "",
          mobile: data.mobile || "",
          message: data.message || ""
        });
      }
    }
  }

  async function loadAdminData() {
    const [orderResult, requestResult, applicationResult, announcementResult] =
      await Promise.all([
        supabase
          .from("orders")
          .select("*, profiles!orders_user_id_profiles_fkey(full_name,email), firmwares(title)")
          .order("created_at", { ascending: false }),

        supabase
          .from("firmware_requests")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("reseller_applications")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false })
      ]);

    if (orderResult.error) setNotice(orderResult.error.message);
    else setOrders(orderResult.data || []);

    if (requestResult.error) setNotice(requestResult.error.message);
    else setRequests(requestResult.data || []);

    if (applicationResult.error) setNotice(applicationResult.error.message);
    else setApplications(applicationResult.data || []);

    if (!announcementResult.error) {
      setAnnouncements(announcementResult.data || []);
    }
  }

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
      list = [...list].sort(
        (a, b) => Number(a.price) - Number(b.price)
      );
    }

    return list;
  }, [firmwares, search, brand, sort]);

  async function authenticate(e) {
    e.preventDefault();

    if (!supabase) return;

    setBusy(true);
    setNotice("");

    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, mobile }
          }
        });

        if (error) throw error;
        setNotice("রেজিস্ট্রেশন হয়েছে। ইমেইল কনফার্ম করুন।");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email, password
        });

        if (error) throw error;

        setNotice("লগইন সফল হয়েছে।");
        setTab("dashboard");
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setTab("home");
    setMobileMenu(false);
    setNotice("আপনি লগআউট করেছেন।");
  }

  async function saveProfile(e) {
    e.preventDefault();

    if (!session?.user) return;

    setBusy(true);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: profileForm.full_name,
        mobile: profileForm.mobile
      })
      .eq("id", session.user.id)
      .select()
      .maybeSingle();

    if (error) {
      setNotice(error.message);
    } else {
      setProfile(data || {
        ...profile,
        full_name: profileForm.full_name,
        mobile: profileForm.mobile
      });
      setNotice("প্রোফাইল আপডেট হয়েছে।");
    }

    setBusy(false);
  }

  async function downloadFirmware(f) {
    if (!session) {
      setNotice("ডাউনলোডের জন্য আগে লগইন করুন।");
      setTab("account");
      return;
    }

    if (!f.is_free) {
      const { data: approved, error } = await supabase
        .from("orders")
        .select("id")
        .eq("firmware_id", f.id)
        .eq("user_id", session.user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (error) {
        setNotice(error.message);
        return;
      }

      if (!approved && !isAdmin) {
        setNotice("এই Firmware Premium। পেমেন্ট ব্যবস্থা এখনো চালু হয়নি।");
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

      const upload = await supabase.storage
        .from("firmware-files")
        .upload(path, file, { upsert: false });

      if (upload.error) throw upload.error;

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
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitFirmwareRequest(e) {
    e.preventDefault();

    if (!session) {
      setNotice("Firmware Request করতে আগে লগইন করুন।");
      setTab("account");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("firmware_requests")
      .insert({
        user_id: session.user.id,
        brand: requestForm.brand,
        model: requestForm.model,
        details: requestForm.details
      });

    if (error) {
      setNotice(error.message);
    } else {
      setRequestForm({ brand: "", model: "", details: "" });
      setNotice("আপনার Firmware Request জমা হয়েছে।");
    }

    setBusy(false);
  }

  async function submitResellerApplication(e) {
    e.preventDefault();

    if (!session) {
      setNotice("Reseller আবেদন করতে আগে লগইন করুন।");
      setTab("account");
      return;
    }

    if (myApplication) {
      setNotice("আপনার একটি Reseller আবেদন আগে থেকেই জমা আছে।");
      return;
    }

    setBusy(true);

    const { error } = await supabase
      .from("reseller_applications")
      .insert({
        user_id: session.user.id,
        business_name: resellerForm.business_name,
        mobile: resellerForm.mobile,
        message: resellerForm.message
      });

    if (error) {
      setNotice(error.message);
    } else {
      setNotice("আপনার Reseller আবেদন জমা হয়েছে।");
      await loadMyApplication();
    }

    setBusy(false);
  }

  async function publishAnnouncement(e) {
    e.preventDefault();
    setBusy(true);

    const { error } = await supabase
      .from("announcements")
      .insert({
        title: announcementForm.title,
        content: announcementForm.content,
        published: true
      });

    if (error) {
      setNotice(error.message);
    } else {
      setAnnouncementForm({ title: "", content: "" });
      setNotice("Announcement প্রকাশ হয়েছে।");
      await loadAnnouncements();
    }

    setBusy(false);
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm("এই Announcement মুছে ফেলবেন?")) return;

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    setNotice(error ? error.message : "Announcement মুছে ফেলা হয়েছে।");
    await loadAnnouncements();
  }

  async function updateOrder(id, status) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    setNotice(error ? error.message : "অর্ডারের অবস্থা আপডেট হয়েছে।");
    await loadAdminData();
  }

  async function updateRequest(id, status) {
    const { error } = await supabase
      .from("firmware_requests")
      .update({ status })
      .eq("id", id);

    setNotice(error ? error.message : "Request-এর অবস্থা আপডেট হয়েছে।");
    await loadAdminData();
  }

  async function updateApplication(id, status) {
    const { error } = await supabase
      .from("reseller_applications")
      .update({ status })
      .eq("id", id);

    setNotice(error ? error.message : "Reseller আবেদনের অবস্থা আপডেট হয়েছে।");
    await loadAdminData();
  }

  async function hideFirmware(id) {
    if (!window.confirm("এই Firmware Catalog থেকে সরাবেন?")) return;

    const { error } = await supabase
      .from("firmwares")
      .update({ published: false })
      .eq("id", id);

    setNotice(error ? error.message : "Firmware Catalog থেকে সরানো হয়েছে।");
    await loadFirmware();
  }

  function goTo(nextTab) {
    setTab(nextTab);
    setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!isSupabaseConfigured) return <SetupScreen />;

  return (
    <div className="app-shell">
      <div className="top-strip">
        <span>GSMPLUS FIRMWARE DOWNLOAD CENTER</span>
        <span>বাংলাদেশের জন্য Firmware Portal</span>
      </div>

      <header className="topbar">
        <a className="brand" href="#" onClick={e => {
          e.preventDefault();
          goTo("home");
        }}>
          <span className="brand-icon"><Smartphone size={24}/></span>
          <span>GSM<span className="accent">PLUS</span>
            <small>REPAIR • FLASH • UPDATE</small>
          </span>
        </a>

        <button className="menu-toggle" onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X/> : <Menu/>}
        </button>

        <nav className={mobileMenu ? "nav-open" : ""}>
          <button onClick={() => goTo("home")}>হোম</button>
          {session && <button onClick={() => goTo("dashboard")}>ড্যাশবোর্ড</button>}
          <button onClick={() => goTo("packages")}>প্যাকেজ</button>
          <button onClick={() => goTo("request")}>Firmware Request</button>
          <button onClick={() => goTo("reseller")}>Reseller</button>
          <button onClick={() => goTo("orders")}>আমার অর্ডার</button>
          {isAdmin && (
            <button onClick={() => {
              goTo("admin");
              loadAdminData();
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
            <button className="primary small" onClick={() => goTo("account")}>
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

      {announcements.length > 0 && (
        <section className="section announcement-strip">
          <div className="eyebrow"><Bell size={15}/> GSMPLUS ঘোষণা</div>
          {announcements.slice(0, 3).map(item => (
            <div className="announcement-item" key={item.id}>
              <b>{item.title}</b>
              <p>{item.content}</p>
            </div>
          ))}
        </section>
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
                document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" })
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
                    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
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
                  {isAdmin && (
                    <button className="reject full" onClick={() => hideFirmware(f.id)}>
                      Catalog থেকে সরান
                    </button>
                  )}
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
              <button className="outline full" onClick={() => goTo("account")}>অ্যাকাউন্ট খুলুন</button>
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
              <button className="outline full" onClick={() => goTo("reseller")}>আবেদন করুন</button>
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

      {tab === "dashboard" && (
        <section className="section page-section">
          {!session ? (
            <div className="empty">
              <h2>ড্যাশবোর্ড দেখতে লগইন করুন</h2>
              <button className="primary" onClick={() => goTo("account")}>লগইন</button>
            </div>
          ) : (
            <>
              <div className="section-title">
                <div className="eyebrow">MY ACCOUNT</div>
                <h2>আমার ড্যাশবোর্ড</h2>
                <p>আপনার GSMPLUS অ্যাকাউন্টের তথ্য ও সেবা</p>
              </div>

              <div className="feature-grid">
                <div className="feature-card"><User/><h3>নাম</h3><p>{profile?.full_name || session.user.user_metadata?.full_name || "নাম দেওয়া হয়নি"}</p></div>
                <div className="feature-card"><Bell/><h3>ইমেইল</h3><p>{session.user.email}</p></div>
                <div className="feature-card"><Smartphone/><h3>মোবাইল নম্বর</h3><p>{profile?.mobile || session.user.user_metadata?.mobile || "মোবাইল দেওয়া হয়নি"}</p></div>
                <div className="feature-card"><ShieldCheck/><h3>অ্যাকাউন্টের ধরন</h3><p>{isAdmin ? "Admin" : "সাধারণ সদস্য"}</p></div>
              </div>

              <div className="admin-grid" style={{ marginTop: 20 }}>
                <div className="panel">
                  <h3>প্রোফাইল আপডেট</h3>
                  <form onSubmit={saveProfile}>
                    <label>আপনার নাম
                      <input required value={profileForm.full_name} onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}/>
                    </label>
                    <label>মোবাইল নম্বর
                      <input value={profileForm.mobile} onChange={e => setProfileForm({ ...profileForm, mobile: e.target.value })}/>
                    </label>
                    <button className="primary full" disabled={busy}><Save size={16}/> তথ্য সংরক্ষণ</button>
                  </form>
                </div>

                <div className="panel">
                  <h3>আমার অ্যাকাউন্ট</h3>
                  <p>মোট অর্ডার: {orders.length}</p>
                  <p>Firmware Request: নিজের প্রয়োজনীয় Firmware চাইতে পারবেন।</p>
                  <button className="outline full" onClick={() => goTo("orders")}>আমার অর্ডার দেখুন</button>
                  <button className="outline full" onClick={() => goTo("request")}>Firmware Request করুন</button>
                  <button className="outline full" onClick={() => goTo("reseller")}>Reseller আবেদন</button>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {tab === "request" && (
        <section className="section page-section">
          <div className="section-title">
            <div className="eyebrow"><FileQuestion size={15}/> FIRMWARE REQUEST</div>
            <h2>আপনার প্রয়োজনীয় Firmware Request করুন</h2>
            <p>আপনার ফোনের ব্র্যান্ড ও মডেল লিখে Request জমা দিন।</p>
          </div>

          <div className="panel narrow">
            <form onSubmit={submitFirmwareRequest}>
              <label>ফোনের ব্র্যান্ড
                <input required value={requestForm.brand} onChange={e => setRequestForm({ ...requestForm, brand: e.target.value })} placeholder="যেমন Samsung"/>
              </label>
              <label>ফোনের মডেল
                <input required value={requestForm.model} onChange={e => setRequestForm({ ...requestForm, model: e.target.value })} placeholder="যেমন Galaxy A12"/>
              </label>
              <label>অতিরিক্ত তথ্য
                <textarea value={requestForm.details} onChange={e => setRequestForm({ ...requestForm, details: e.target.value })} placeholder="Firmware version বা সমস্যার বিবরণ"/>
              </label>
              <button className="primary full" disabled={busy}><Send size={16}/> Request জমা দিন</button>
            </form>
          </div>
        </section>
      )}

      {tab === "reseller" && (
        <section className="section page-section">
          <div className="section-title">
            <div className="eyebrow"><Store size={15}/> RESELLER PROGRAM</div>
            <h2>GSMPLUS Reseller আবেদন</h2>
            <p>Reseller হওয়ার আগ্রহ জানাতে আবেদন জমা দিন।</p>
          </div>

          <div className="panel narrow">
            {myApplication ? (
              <>
                <h3>আপনার আবেদন জমা আছে</h3>
                <p>ব্যবসার নাম: {myApplication.business_name || "উল্লেখ করা হয়নি"}</p>
                <p>মোবাইল: {myApplication.mobile}</p>
                <p>স্ট্যাটাস: <span className="tag">{statusText(myApplication.status)}</span></p>
                <p className="muted">অ্যাডমিন আপনার আবেদন পর্যালোচনা করবেন।</p>
              </>
            ) : (
              <form onSubmit={submitResellerApplication}>
                <label>ব্যবসা বা দোকানের নাম
                  <input value={resellerForm.business_name} onChange={e => setResellerForm({ ...resellerForm, business_name: e.target.value })}/>
                </label>
                <label>মোবাইল নম্বর
                  <input required value={resellerForm.mobile} onChange={e => setResellerForm({ ...resellerForm, mobile: e.target.value })}/>
                </label>
                <label>আপনার সম্পর্কে
                  <textarea value={resellerForm.message} onChange={e => setResellerForm({ ...resellerForm, message: e.target.value })}/>
                </label>
                <button className="primary full" disabled={busy}><Send size={16}/> আবেদন জমা দিন</button>
              </form>
            )}
          </div>
        </section>
      )}

      {tab === "orders" && (
        <section className="section page-section">
          <div className="section-head">
            <div><div className="eyebrow">ACCOUNT CENTER</div><h2>আমার অর্ডার</h2></div>
            <button className="outline" onClick={loadProfileAndOrders}><RefreshCw size={15}/> রিফ্রেশ</button>
          </div>

          {!session ? (
            <div className="empty">
              অর্ডার দেখতে লগইন করুন।
              <button className="primary" onClick={() => goTo("account")}>লগইন</button>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Firmware</th><th>পরিমাণ</th><th>স্ট্যাটাস</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>{o.firmwares?.title || "Firmware"}</td>
                      <td>{money(o.amount)}</td>
                      <td><span className="tag">{statusText(o.status)}</span></td>
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

          <div className="stats">
            <div><HardDrive/><b>{firmwares.length}</b><span>প্রকাশিত Firmware</span></div>
            <div><PackageCheck/><b>{orders.length}</b><span>অর্ডার</span></div>
            <div><FileQuestion/><b>{requests.length}</b><span>Firmware Request</span></div>
            <div><Store/><b>{applications.length}</b><span>Reseller আবেদন</span></div>
          </div>

          <div className="admin-grid" style={{ marginTop: 20 }}>
            <div className="panel">
              <h3>নতুন Firmware আপলোড</h3>
              <form onSubmit={addFirmware}>
                <label>Firmware নাম<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
                <label>ব্র্যান্ড<input required value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}/></label>
                <label>মডেল<input required value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}/></label>
                <label>ভার্সন<input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })}/></label>
                <label>বর্ণনা<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
                <label className="check"><input type="checkbox" checked={form.is_free} onChange={e => setForm({ ...form, is_free: e.target.checked })}/> Free Firmware</label>
                {!form.is_free && <label>মূল্য (৳)<input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}/></label>}
                <label>Firmware ফাইল<input type="file" required onChange={e => setFile(e.target.files?.[0] || null)}/></label>
                <button className="primary full" disabled={busy}><Upload size={16}/> {busy ? "আপলোড হচ্ছে..." : "আপলোড করুন"}</button>
              </form>
            </div>

            <div className="panel">
              <h3>নতুন Announcement</h3>
              <form onSubmit={publishAnnouncement}>
                <label>শিরোনাম<input required value={announcementForm.title} onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}/></label>
                <label>বিস্তারিত<textarea required value={announcementForm.content} onChange={e => setAnnouncementForm({ ...announcementForm, content: e.target.value })}/></label>
                <button className="primary full" disabled={busy}><Send size={16}/> প্রকাশ করুন</button>
              </form>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <div className="section-head">
              <h3>অর্ডার ও পেমেন্ট যাচাই</h3>
              <button className="outline" onClick={loadAdminData}><RefreshCw size={15}/> রিফ্রেশ</button>
            </div>
            {orders.map(o => (
              <div className="order-row" key={o.id}>
                <b>{o.firmwares?.title || "Firmware"}</b>
                <small>{o.profiles?.email || o.transaction_id || "গ্রাহক"} · {money(o.amount)} · {statusText(o.status)}</small>
                <div>
                  <button className="approve" onClick={() => updateOrder(o.id, "approved")}>Approve</button>
                  <button className="reject" onClick={() => updateOrder(o.id, "rejected")}>Reject</button>
                </div>
              </div>
            ))}
            {!orders.length && <p className="empty">এখনো কোনো অর্ডার নেই।</p>}
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h3>Firmware Requests</h3>
            {requests.map(r => (
              <div className="order-row" key={r.id}>
                <b>{r.brand} {r.model}</b>
                <small>{r.details || "অতিরিক্ত তথ্য নেই"} · {statusText(r.status)}</small>
                <div>
                  <button className="approve" onClick={() => updateRequest(r.id, "approved")}>Approve</button>
                  <button className="reject" onClick={() => updateRequest(r.id, "rejected")}>Reject</button>
                </div>
              </div>
            ))}
            {!requests.length && <p className="empty">কোনো Request নেই।</p>}
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h3>Reseller Applications</h3>
            {applications.map(a => (
              <div className="order-row" key={a.id}>
                <b>{a.business_name || "ব্যবসার নাম দেওয়া হয়নি"}</b>
                <small>{a.mobile} · {a.message || "বিস্তারিত নেই"} · {statusText(a.status)}</small>
                <div>
                  <button className="approve" onClick={() => updateApplication(a.id, "approved")}>Approve</button>
                  <button className="reject" onClick={() => updateApplication(a.id, "rejected")}>Reject</button>
                </div>
              </div>
            ))}
            {!applications.length && <p className="empty">কোনো আবেদন নেই।</p>}
          </div>

          <div className="panel" style={{ marginTop: 20 }}>
            <h3>Announcements পরিচালনা</h3>
            {announcements.map(a => (
              <div className="order-row" key={a.id}>
                <b>{a.title}</b>
                <small>{a.content}</small>
                <div>
                  <button className="reject" onClick={() => deleteAnnouncement(a.id)}>মুছুন</button>
                </div>
              </div>
            ))}
            {!announcements.length && <p className="empty">কোনো Announcement নেই।</p>}
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
              const firmware = selected;
              setSelected(null);
              downloadFirmware(firmware);
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
        <small>Payment gateways are not active. Do not send money.</small>
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
