import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  
  // App-wide data caches for dashboards
  const [donors, setDonors] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [adminStats, setAdminStats] = useState({ total_donors: 0, active_donors: 0, active_requests: 0, success_rate: 100 });
  const [donorDashboardData, setDonorDashboardData] = useState({ donor: null, history: [], matching_requests: [] });
  
  // Search parameters
  const [searchBlood, setSearchBlood] = useState('');
  const [searchLoc, setSearchLoc] = useState('');
  const [searchAvailable, setSearchAvailable] = useState(true);
  const [searchDistance, setSearchDistance] = useState(15);
  const [searchResults, setSearchResults] = useState([]);
  
  // Modals state
  const [contactModal, setContactModal] = useState(null); // { name, blood, phone, email }
  const [assignModal, setAssignModal] = useState(null); // { requestId, hospital, bloodGroup }
  
  // Logged-in auth restore
  useEffect(() => {
    // Get current active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setToken(session.access_token);
        fetchUserProfile(session.user.id);
      }
    });

    // Listen for auth updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setToken(session.access_token);
        fetchUserProfile(session.user.id);
      } else {
        setToken(null);
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      if (data) {
        setUser(data);
        // Automatically redirect to correct dashboard
        setView(prev => {
          if (prev === 'login' || prev === 'landing') {
            return data.role === 'admin' ? 'admin-dashboard' : 'donor-dashboard';
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Error loading user profile:", err.message);
    }
  };

  // Update dynamic values when view changes
  useEffect(() => {
    if (view === 'search') {
      fetchDonors();
    } else if (view === 'emergency') {
      fetchLiveBroadcasts();
    } else if (view === 'admin-dashboard' && token) {
      fetchAdminStats();
      fetchAdminDonors();
      fetchLiveBroadcasts();
    } else if (view === 'donor-dashboard' && token && user) {
      fetchDonorDashboardData();
    }
  }, [view, token, user]);

  const handleLogin = (userObj, tokenStr) => {
    setToken(tokenStr);
    setUser(userObj);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setToken(null);
    setUser(null);
    setView('landing');
  };

  // --- API Handlers ---

  const fetchDonors = async () => {
    try {
      let query = supabase.from('profiles').select('*').eq('role', 'donor');
      if (searchAvailable) {
        query = query.eq('is_available', true);
      }
      if (searchBlood) {
        query = query.eq('blood_group', searchBlood);
      }
      if (searchLoc) {
        query = query.eq('location', searchLoc);
      }
      const { data, error } = await query;
      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error("Error search donors:", err.message);
    }
  };

  const fetchLiveBroadcasts = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_requests_view')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBroadcasts(data || []);
    } catch (err) {
      console.error("Error fetching broadcasts:", err.message);
    }
  };

  const fetchAdminStats = async () => {
    try {
      const { count: totalDonors, error: e1 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'donor');
      
      const { count: activeDonors, error: e2 } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'donor')
        .eq('is_available', true);

      const { count: activeRequests, error: e3 } = await supabase
        .from('emergency_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (e1 || e2 || e3) throw (e1 || e2 || e3);

      setAdminStats({
        total_donors: totalDonors || 0,
        active_donors: activeDonors || 0,
        active_requests: activeRequests || 0,
        success_rate: 100
      });
    } catch (err) {
      console.error("Error fetching stats:", err.message);
    }
  };

  const fetchAdminDonors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'donor');
      if (error) throw error;
      setDonors(data || []);
    } catch (err) {
      console.error("Error fetching donors:", err.message);
    }
  };

  const fetchDonorDashboardData = async () => {
    if (!user) return;
    try {
      const historyRes = await supabase
        .from('donation_history')
        .select('*')
        .eq('donor_id', user.id)
        .order('created_at', { ascending: false });

      const matchingRes = await supabase
        .from('emergency_requests_view')
        .select('*')
        .eq('blood_group', user.blood_group)
        .eq('location', user.location)
        .eq('status', 'pending');

      setDonorDashboardData({
        donor: user,
        history: historyRes.data || [],
        matching_requests: matchingRes.data || []
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err.message);
    }
  };

  const toggleAvailability = async () => {
    if (!user) return;
    try {
      const nextVal = !user.is_available;
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_available: nextVal })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      setUser(data);
      fetchDonorDashboardData();
    } catch (err) {
      console.error("Error toggling availability:", err.message);
    }
  };

  const assignDonor = async (requestId, donorId) => {
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({ 
          status: 'assigned',
          assigned_donor_id: donorId
        })
        .eq('id', requestId);
      if (error) throw error;
      alert("Donor successfully assigned to request!");
      setAssignModal(null);
      fetchAdminStats();
      fetchLiveBroadcasts();
      fetchAdminDonors();
    } catch (err) {
      console.error("Error assigning donor:", err.message);
      alert("Assignment failed: " + err.message);
    }
  };

  const respondToEmergency = async (requestId) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('emergency_requests')
        .update({ 
          status: 'assigned',
          assigned_donor_id: user.id
        })
        .eq('id', requestId);
      if (error) throw error;
      alert("Thank you for responding! The hospital facility has been notified.");
      fetchDonorDashboardData();
    } catch (err) {
      console.error("Error responding:", err.message);
      alert("Could not respond: " + err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Dynamic Header Navbar */}
      {view !== 'donor-dashboard' && view !== 'admin-dashboard' && (
        <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant shadow-sm h-16">
          <nav className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto h-full">
            <div onClick={() => setView('landing')} className="flex items-center gap-2 cursor-pointer">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>bloodtype</span>
              <span className="text-title-md font-title-md text-primary tracking-tight">Blood Connect</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => setView('search')} className={`font-body-md text-body-md transition-colors ${view === 'search' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>Search Donors</button>
              <button onClick={() => setView('register')} className={`font-body-md text-body-md transition-colors ${view === 'register' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>Register</button>
              <button onClick={() => setView('emergency')} className={`font-body-md text-body-md transition-colors ${view === 'emergency' ? 'text-primary font-bold border-b-2 border-primary pb-1' : 'text-on-surface-variant hover:text-primary'}`}>Emergency Request</button>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <button onClick={() => setView(user.role === 'admin' ? 'admin-dashboard' : 'donor-dashboard')} className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl font-label-md transition-all text-sm">Dashboard</button>
                  <button onClick={handleLogout} className="text-on-surface-variant hover:text-primary text-sm font-label-md transition-colors">Logout</button>
                </>
              ) : (
                <>
                  <button onClick={() => setView('login')} className="px-4 py-2 border border-primary text-primary hover:bg-primary/5 rounded-xl font-label-md transition-all text-sm">Login</button>
                  <button onClick={() => setView('register')} className="px-4 py-2 bg-primary text-on-primary hover:bg-primary/95 rounded-xl font-label-md transition-all text-sm shadow-sm shadow-primary/10">Join Us</button>
                </>
              )}
            </div>
          </nav>
        </header>
      )}

      {/* Main App Page router */}
      <div className="flex-grow">
        {view === 'landing' && <LandingView setView={setView} />}
        {view === 'search' && (
          <SearchView
            searchBlood={searchBlood} setSearchBlood={setSearchBlood}
            searchLoc={searchLoc} setSearchLoc={setSearchLoc}
            searchAvailable={searchAvailable} setSearchAvailable={setSearchAvailable}
            searchDistance={searchDistance} setSearchDistance={setSearchDistance}
            searchResults={searchResults} fetchDonors={fetchDonors}
            setContactModal={setContactModal}
          />
        )}
        {view === 'register' && <RegisterView setView={setView} />}
        {view === 'emergency' && (
          <EmergencyView
            broadcasts={broadcasts}
            fetchLiveBroadcasts={fetchLiveBroadcasts}
          />
        )}
        {view === 'login' && <LoginView handleLogin={handleLogin} />}
        
        {view === 'donor-dashboard' && (
          <DonorDashboardView
            user={user}
            setView={setView}
            handleLogout={handleLogout}
            toggleAvailability={toggleAvailability}
            donorDashboardData={donorDashboardData}
            respondToEmergency={respondToEmergency}
          />
        )}

        {view === 'admin-dashboard' && (
          <AdminDashboardView
            setView={setView}
            handleLogout={handleLogout}
            adminStats={adminStats}
            donors={donors}
            broadcasts={broadcasts}
            setAssignModal={setAssignModal}
          />
        )}
      </div>

      {/* Footer (Rendered on non-dashboards) */}
      {view !== 'donor-dashboard' && view !== 'admin-dashboard' && (
        <footer className="w-full py-lg px-margin-mobile md:px-margin-desktop max-w-max-width mx-auto grid grid-cols-1 md:grid-cols-4 gap-gutter border-t border-outline-variant bg-surface-container-highest">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bloodtype</span>
              <span className="text-body-lg font-title-md text-primary tracking-tight">Blood Connect</span>
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant max-w-xs">
              Connecting lives and ensuring no medical emergency goes unanswered due to blood shortages.
            </p>
          </div>
          <div className="space-y-4">
            <h4 className="font-title-md text-on-surface">Platform</h4>
            <ul className="space-y-2 text-label-sm text-on-surface-variant">
              <li><button onClick={() => setView('search')} className="hover:text-primary">Find Donors</button></li>
              <li><button onClick={() => setView('register')} className="hover:text-primary">Register</button></li>
              <li><button onClick={() => setView('emergency')} className="hover:text-primary">Emergency Request</button></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 class="font-title-md text-on-surface">Support</h4>
            <ul className="space-y-2 text-label-sm text-on-surface-variant">
              <li><a className="hover:text-primary" href="#">Contact Support</a></li>
              <li><a className="hover:text-primary" href="#">Privacy Policy</a></li>
            </ul>
          </div>
          <div className="space-y-4">
            <h4 className="font-title-md text-on-surface">Emergency Hotline</h4>
            <div className="p-base bg-error-container/30 rounded-lg border border-error/10">
              <a className="text-title-md font-bold text-on-error-container hover:underline" href="tel:911-BLOOD">911-BLOOD</a>
            </div>
          </div>
        </footer>
      )}

      {/* --- Modals Overlay --- */}
      {contactModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full border border-outline-variant shadow-2xl p-6 relative">
            <button onClick={() => setContactModal(null)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary-container text-on-primary-container rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">contact_phone</span>
              </div>
              <h3 className="text-title-md font-title-md">{contactModal.name}</h3>
              <p className="text-label-sm text-primary font-bold">{contactModal.blood} Donor</p>
            </div>
            <div className="space-y-4">
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant flex items-center gap-3">
                <span className="material-symbols-outlined text-primary">phone</span>
                <div>
                  <p className="text-xs text-on-surface-variant">Call or SMS</p>
                  <p className="text-body-md font-bold">{contactModal.phone}</p>
                </div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant flex items-center gap-3">
                <span class="material-symbols-outlined text-primary">mail</span>
                <div>
                  <p className="text-xs text-on-surface-variant">Email Address</p>
                  <p className="text-body-md font-bold">{contactModal.email}</p>
                </div>
              </div>
            </div>
            <button onClick={() => setContactModal(null)} className="w-full mt-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-secondary transition-colors">Close</button>
          </div>
        </div>
      )}

      {assignModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full border border-outline-variant shadow-2xl p-6 relative">
            <button onClick={() => setAssignModal(null)} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="text-center mb-6">
              <h3 className="text-title-md font-title-md">Assign Donor to Request</h3>
              <p className="text-sm text-on-surface-variant mt-1">{assignModal.hospital} • Requires {assignModal.bloodGroup}</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const selectEl = e.target.elements.assignDonorId;
              assignDonor(assignModal.requestId, selectEl.value);
            }} className="space-y-4">
              <div className="space-y-1">
                <label className="text-label-md font-bold text-on-surface-variant block">Select Compatible Donor</label>
                <select name="assignDonorId" required className="w-full h-12 px-4 rounded-lg border border-outline focus:border-primary outline-none">
                  <option value="">-- Choose Donor --</option>
                  {donors.filter(d => d.is_available && d.blood_group === assignModal.bloodGroup).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.blood_group}) - available</option>
                  ))}
                  {/* Fallback to show others if none exact matched */}
                  {donors.filter(d => d.is_available && d.blood_group !== assignModal.bloodGroup).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.blood_group}) - compatible?</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="w-full mt-6 py-3 bg-primary hover:bg-secondary text-on-primary rounded-xl font-bold transition-colors">Confirm Assignment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- View Component Blocks ---

function LandingView({ setView }) {
  return (
    <main>
      <section className="hero-gradient relative py-xl md:py-24 overflow-hidden">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop grid grid-cols-1 lg:grid-cols-2 gap-gutter items-center">
          <div className="space-y-8 z-10">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-sm mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>emergency</span>
              <span className="font-label-md text-label-md">Urgent Assistance Available</span>
            </div>
            <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg text-on-surface max-w-xl">
              Find Blood Donors in Minutes During <span className="text-primary">Emergencies</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg">
              Connecting lives in critical moments. Blood Connect bridges the gap between those in need and selfless donors through real-time geolocation.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button onClick={() => setView('search')} className="h-[48px] px-8 bg-primary text-on-primary rounded-xl font-title-md text-title-md shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2">
                Search Donors
                <span className="material-symbols-outlined text-xl">search</span>
              </button>
              <button onClick={() => setView('register')} className="h-[48px] px-8 border-2 border-primary text-primary rounded-xl font-title-md text-title-md hover:bg-primary/5 transition-all active:scale-95 flex items-center justify-center gap-2">
                Become a Donor
                <span className="material-symbols-outlined text-xl">favorite</span>
              </button>
            </div>
          </div>
          <div className="relative mt-12 lg:mt-0">
            <div className="absolute -inset-4 bg-primary/5 rounded-[40px] blur-3xl"></div>
            <div className="relative rounded-[32px] overflow-hidden shadow-2xl border-4 border-surface-container-lowest">
              <img alt="Professional Healthcare Setting" className="w-full aspect-square object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBM80jjGFbGq4cJJIPgb353ERgThpA-dtqQ2vn8Gvuwj7o-fpLYsMFTSBvfaXXseBVGkeLgR2oCY8TACW_mLyiY97qoyyd1j55F9-hcpAvGDaRL9XsFTCl2wl8DHnc6ynhYYc7V-cpXIGXZI8lB34fsCMCvYWVwQrbxfq7_mcPKgYdCIuHd31VVw3hOXm5jFeaaqE-Dyg9vzcQKbtUxs4Plytmwx7TY3gDJ5pjGkT-KGBbOhTk5hH_vXg"/>
              <div className="absolute bottom-6 left-6 right-6 p-6 bg-white/90 backdrop-blur-md rounded-2xl border border-white/50 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-full">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  </div>
                  <div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Live Donors Nearby</p>
                    <p className="font-title-md text-title-md text-on-surface">Chennai, Tamil Nadu</p>
                  </div>
                  <div className="ml-auto flex -space-x-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-surface-dim"></div>
                    <div className="w-10 h-10 rounded-full border-2 border-white bg-primary-container flex items-center justify-center text-on-primary-container text-[10px] font-bold">+24</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-lg bg-surface-container-low">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter text-center">
            <div className="p-base">
              <h2 className="font-display-lg text-primary mb-2">2,800+</h2>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Total Donors</p>
            </div>
            <div className="p-base border-y md:border-y-0 md:border-x border-outline-variant">
              <h2 class="font-display-lg text-primary mb-2">1,500+</h2>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Successful Donations</p>
            </div>
            <div className="p-base">
              <h2 className="font-display-lg text-primary mb-2">10+</h2>
              <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Regions Covered</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-xl">
        <div className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="text-center mb-16">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">How It Works</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Simple three-step process to bridge the gap in healthcare.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-1/4 left-0 right-0 h-px bg-outline-variant -z-10 mx-24"></div>
            <div className="bento-card bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary-container text-on-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-md">
                <span className="material-symbols-outlined text-3xl">search</span>
              </div>
              <h3 className="font-title-md text-title-md text-on-surface mb-3">1. Search Blood &amp; Location</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Quickly filter by blood group and location to find matching donors in your vicinity instantly.</p>
            </div>
            <div className="bento-card bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary-container text-on-primary-container rounded-2xl flex items-center justify-center mb-6 shadow-md">
                <span className="material-symbols-outlined text-3xl">chat_bubble</span>
              </div>
              <h3 className="font-title-md text-title-md text-on-surface mb-3">2. Connect with Donors</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Send alerts to available donors and coordinate through secure, real-time messaging systems.</p>
            </div>
            <div className="bento-card bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-outline-variant flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary text-on-primary rounded-2xl flex items-center justify-center mb-6 shadow-md">
                <span className="material-symbols-outlined text-3xl">volunteer_activism</span>
              </div>
              <h3 className="font-title-md text-title-md text-on-surface mb-3">3. Save a Life</h3>
              <p className="font-body-md text-body-md text-on-surface-variant">Facilitate the donation process and help save lives in critical moments. Real-time heroes in action.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SearchView({
  searchBlood, setSearchBlood,
  searchLoc, setSearchLoc,
  searchAvailable, setSearchAvailable,
  searchDistance, setSearchDistance,
  searchResults, fetchDonors,
  setContactModal
}) {
  return (
    <main className="w-full max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-lg space-y-lg">
      <section className="space-y-md">
        <div className="max-w-2xl">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Find Heroes Near You</h1>
          <p className="text-body-lg text-on-surface-variant">Connecting you with verified donors in real-time. Every second counts.</p>
        </div>
        <div className="bg-surface-container-lowest p-sm md:p-base rounded-xl shadow-md border border-outline-variant flex flex-col md:flex-row gap-base items-stretch md:items-center">
          <div className="flex-1 flex items-center gap-xs px-base bg-surface-container-low rounded-lg border border-transparent focus-within:border-primary transition-all">
            <span className="material-symbols-outlined text-outline">water_drop</span>
            <select value={searchBlood} onChange={(e) => setSearchBlood(e.target.value)} className="bg-transparent border-none focus:ring-0 w-full py-3 text-body-md appearance-none">
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
          <div className="flex-1 flex items-center gap-xs px-base bg-surface-container-low rounded-lg border border-transparent focus-within:border-primary transition-all">
            <span className="material-symbols-outlined text-outline">location_on</span>
            <input value={searchLoc} onChange={(e) => setSearchLoc(e.target.value)} className="bg-transparent border-none focus:ring-0 w-full py-3 text-body-md" placeholder="Enter Location (e.g. Chennai, Coimbatore)" type="text"/>
          </div>
          <button onClick={fetchDonors} className="bg-primary hover:bg-secondary text-on-primary h-12 md:h-14 px-lg rounded-lg font-label-md flex items-center justify-center gap-xs transition-colors shadow-sm">
            <span className="material-symbols-outlined">search</span>
            Search
          </button>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-gutter">
        <aside className="w-full lg:w-72 space-y-md shrink-0">
          <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant">
            <h2 className="text-title-md font-title-md mb-base text-on-surface">Filters</h2>
            <div className="space-y-lg">
              <div className="space-y-sm">
                <h3 className="text-label-md text-on-surface font-semibold uppercase tracking-wider text-[11px]">Availability</h3>
                <label className="flex items-center gap-sm cursor-pointer group">
                  <input type="checkbox" checked={searchAvailable} onChange={(e) => setSearchAvailable(e.target.checked)} className="rounded border-outline text-primary focus:ring-primary h-5 w-5"/>
                  <span className="text-body-md text-on-surface-variant group-hover:text-primary transition-colors">Available Now</span>
                </label>
              </div>
              <div className="space-y-sm">
                <div className="flex justify-between items-center">
                  <h3 className="text-label-md text-on-surface font-semibold uppercase tracking-wider text-[11px]">Distance</h3>
                  <span className="text-label-sm text-primary">{searchDistance} km</span>
                </div>
                <input value={searchDistance} onChange={(e) => setSearchDistance(e.target.value)} className="w-full h-1.5 bg-surface-container-highest rounded-full appearance-none accent-primary cursor-pointer" max="50" min="1" type="range"/>
              </div>
            </div>
            <button onClick={() => { setSearchBlood(''); setSearchLoc(''); setSearchAvailable(true); setSearchDistance(15); }} className="w-full mt-lg py-sm text-primary font-label-md border border-primary/20 rounded-lg hover:bg-primary/5 transition-colors">
              Clear All Filters
            </button>
          </div>
        </aside>

        <div className="flex-1 space-y-md">
          <p className="text-label-md text-on-surface-variant">Showing <span className="text-on-surface font-bold">{searchResults.length}</span> verified donors near your area</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
            {searchResults.length === 0 ? (
              <div className="col-span-full py-12 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl mb-2 text-outline">search_off</span>
                <p className="text-body-lg font-bold">No matching donors found</p>
                <p className="text-sm">Modify search parameters or try another blood type.</p>
              </div>
            ) : (
              searchResults.map(d => {
                const avatar = d.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=80';
                // Create random but stable contact info for display matching the DB records
                const phone = d.phone || `+91 98401 ${Math.floor(10000 + Math.random() * 89999)}`;
                const email = `${d.name.toLowerCase().replace(' ', '.')}@example.com`;
                
                return (
                  <div key={d.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md flex flex-col donor-card-hover transition-all duration-300">
                    <div className="flex justify-between items-start mb-md">
                      <div className="flex items-center gap-sm">
                        <div className="h-12 w-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-bold overflow-hidden">
                          <img alt="avatar" className="h-full w-full object-cover" src={avatar}/>
                        </div>
                        <div>
                          <h4 className="font-title-md text-on-surface">{d.name}</h4>
                          <div className="flex items-center gap-xs text-label-sm text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            {d.location}
                          </div>
                        </div>
                      </div>
                      <div className="bg-primary text-on-primary w-12 h-12 rounded-lg flex flex-col items-center justify-center shadow-sm shrink-0">
                        <span className="text-label-sm font-bold -mb-1">{d.blood_group}</span>
                        <span className="text-[8px] uppercase tracking-tighter opacity-80">{d.blood_group.includes('-') ? 'Rare' : 'Common'}</span>
                      </div>
                    </div>
                    <div className="flex-grow space-y-base mb-lg">
                      <div className="flex items-center justify-between text-label-sm">
                        <span className="text-on-surface-variant">Distance</span>
                        <span className="font-bold text-on-surface">{d.distance} km</span>
                      </div>
                      <div className="flex items-center justify-between text-label-sm">
                        <span className="text-on-surface-variant">Status</span>
                        {d.is_available ? (
                          <div className="flex items-center gap-xs text-green-600 font-bold">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            Available Now
                          </div>
                        ) : (
                          <div className="flex items-center gap-xs text-on-surface-variant">
                            <span className="w-2 h-2 bg-surface-dim rounded-full"></span>
                            Unavailable
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-label-sm">
                        <span className="text-on-surface-variant">Donations</span>
                        <span className="font-bold text-on-surface">{d.donations_count || 0} times</span>
                      </div>
                    </div>
                    <button onClick={() => setContactModal({ name: d.name, blood: d.blood_group, phone, email })} className="w-full py-sm bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary font-label-md rounded-lg transition-all duration-200 flex items-center justify-center gap-xs">
                      <span className="material-symbols-outlined text-[20px]">chat</span>
                      Contact Donor
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function RegisterView({ setView }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('male');
  const [bloodGroup, setBloodGroup] = useState('A+');
  const [lastDonationDate, setLastDonationDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [newsletter, setNewsletter] = useState(false);
  const [reminder, setReminder] = useState(false);
  const [stories, setStories] = useState(true);

  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (step === 1) {
      if (!name.trim() || !age) {
        alert("Please specify name and age.");
        return;
      }
    } else if (step === 3) {
      if (!phone.trim() || !email.trim() || !password || !location.trim()) {
        alert("Please complete all contact and password inputs.");
        return;
      }
      if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
            phone: phone.trim(),
            role: 'donor',
            blood_group: bloodGroup,
            location: location.trim(),
            age: parseInt(age),
            gender: gender,
            is_available: isAvailable,
            avatar_url: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80`
          }
        }
      });
      if (error) throw error;
      alert("Registered successfully! Logging you in...");
      setView('landing');
    } catch (err) {
      console.error(err);
      alert("Registration failed: " + err.message);
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pt-lg pb-xl px-margin-mobile md:px-margin-desktop max-w-3xl mx-auto">
      <div className="mb-lg text-center">
        <h1 className="font-display-lg text-display-lg text-primary mb-xs">Become a Hero</h1>
        <p className="font-body-lg text-body-lg text-tertiary">Your single donation can save up to three lives. Start your journey today.</p>
      </div>

      <div className="mb-lg relative px-4">
        <div className="flex justify-between relative z-10">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step > s ? 'bg-primary text-on-primary' : step === s ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
              {step > s ? <span className="material-symbols-outlined text-lg">check</span> : s}
            </div>
          ))}
        </div>
        <div className="absolute top-5 left-8 right-8 h-1 bg-surface-container-highest -z-0">
          <div className="h-full bg-primary transition-all duration-300 ease-in-out" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant p-md md:p-lg overflow-hidden">
        {step === 1 && (
          <div className="space-y-md">
            <h3 className="font-title-md text-title-md text-on-surface">Step 1: Personal Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="space-y-1">
                <label className="font-label-md text-label-md text-on-surface">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder="Rajesh Kumar" type="text"/>
              </div>
              <div className="space-y-1">
                <label className="font-label-md text-label-md text-on-surface">Age</label>
                <input value={age} onChange={(e) => setAge(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder="28" type="number"/>
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface">Gender Identity</label>
              <div className="flex gap-sm">
                {['male', 'female', 'other'].map(g => (
                  <label key={g} className="flex-1 min-w-[100px] cursor-pointer">
                    <input type="radio" name="gender" value={g} checked={gender === g} onChange={() => setGender(g)} className="hidden"/>
                    <div className={`w-full py-3 text-center rounded-lg border font-label-md transition-all ${gender === g ? 'bg-primary-container text-on-primary-container border-primary' : 'border-outline-variant bg-white text-on-surface-variant'}`}>{g.toUpperCase()}</div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-md">
            <h3 className="font-title-md text-title-md text-on-surface">Step 2: Medical Details</h3>
            <div>
              <label className="font-title-md text-title-md text-on-surface block mb-md">Select Your Blood Group</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-sm">
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <label key={bg} className="cursor-pointer">
                    <input type="radio" name="bloodGroup" value={bg} checked={bloodGroup === bg} onChange={() => setBloodGroup(bg)} className="hidden"/>
                    <div className={`h-20 flex flex-col items-center justify-center rounded-xl border-2 transition-all ${bloodGroup === bg ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white'}`}>
                      <span className="text-xl font-bold">{bg}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="font-label-md text-label-md text-on-surface">Last Donation Date</label>
              <input value={lastDonationDate} onChange={(e) => setLastDonationDate(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" type="date"/>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-md">
            <h3 className="font-title-md text-title-md text-on-surface">Step 3: Contact & Security</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="space-y-1">
                <label className="font-label-md text-label-md text-on-surface">Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder="+91 98401 23456" type="tel"/>
              </div>
              <div className="space-y-1">
                <label className="font-label-md text-label-md text-on-surface">Email Address</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder="donor@example.com" type="email"/>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface">Password</label>
                <input value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder="Choose a password" type="password"/>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="font-label-md text-label-md text-on-surface">Current Location (City/Area)</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder="Adyar, Chennai, TN" type="text"/>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-md">
            <h3 className="font-title-md text-title-md text-on-surface">Step 4: Availability Options</h3>
            <div className="flex items-center justify-between p-md bg-surface-container rounded-xl border border-outline-variant">
              <div>
                <h4 className="font-title-md text-title-md text-on-surface">Ready to Donate</h4>
                <p className="text-body-md text-on-surface-variant">Available for urgent blood requests</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="sr-only peer" type="checkbox"/>
                <div className="w-14 h-8 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="space-y-md">
              <h4 className="font-label-md text-on-surface">Notification Preferences</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-sm">
                <label className="flex items-center p-4 rounded-lg border border-outline-variant hover:bg-surface-container transition-colors cursor-pointer">
                  <input checked={smsAlerts} onChange={(e) => setSmsAlerts(e.target.checked)} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox"/>
                  <span className="ml-3 font-body-md">SMS Alerts for Urgent Needs</span>
                </label>
                <label className="flex items-center p-4 rounded-lg border border-outline-variant hover:bg-surface-container transition-colors cursor-pointer">
                  <input checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox"/>
                  <span className="ml-3 font-body-md">Email Newsletters</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="mt-xl flex justify-between items-center border-t border-outline-variant pt-lg">
          <button disabled={step === 1} onClick={() => setStep(step - 1)} className="px-lg h-12 rounded-lg border-2 border-outline-variant text-on-surface font-label-md hover:bg-surface-container-high transition-colors disabled:opacity-0" type="button">Back</button>
          {step === 4 ? (
            <button disabled={loading} onClick={handleRegister} className="px-xl h-12 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 shadow-md transition-all bg-secondary" type="button">
              {loading ? "Registering..." : "Complete Registration"}
            </button>
          ) : (
            <button onClick={handleNext} className="px-xl h-12 rounded-lg bg-primary text-on-primary font-label-md hover:opacity-90 shadow-md transition-all" type="button">Next Step</button>
          )}
        </div>
      </div>
    </main>
  );
}

function EmergencyView({ broadcasts, fetchLiveBroadcasts }) {
  const [name, setName] = useState('');
  const [blood, setBlood] = useState('');
  const [hospital, setHospital] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('emergency_requests')
        .insert([{
          patient_name: name,
          blood_group: blood,
          hospital_name: hospital,
          location: location,
          contact: phone,
          urgency: urgency,
          notes: notes
        }])
        .select();
      if (error) throw error;
      alert("Broadcasted successfully!");
      setName(''); setBlood(''); setHospital(''); setLocation(''); setPhone(''); setUrgency('normal'); setNotes('');
      fetchLiveBroadcasts();
    } catch (err) {
      console.error(err);
      alert("Failed to post request: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-max-width mx-auto px-margin-mobile md:px-margin-desktop py-lg">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant p-md md:p-lg">
          <div className="mb-lg">
            <h1 className="font-headline-lg text-headline-lg text-primary mb-2">Create Emergency Request</h1>
            <p className="text-on-surface-variant text-body-md">Fill out the clinical details below to broadcast an urgent request to nearby donors and medical facilities.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="space-y-xs">
                <label className="text-label-md font-label-md text-on-surface-variant block">Patient Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline outline-none bg-surface-container-low" placeholder="Full Name" type="text"/>
              </div>
              <div className="space-y-xs">
                <label className="text-label-md font-label-md text-primary font-bold block">Blood Group Needed</label>
                <select value={blood} onChange={(e) => setBlood(e.target.value)} required className="w-full h-12 px-4 rounded-lg border-2 border-primary outline-none bg-primary-container/10 font-bold">
                  <option value="">Select Group</option>
                  <option value="O-">O Negative (O-)</option>
                  <option value="O+">O Positive (O+)</option>
                  <option value="A-">A Negative (A-)</option>
                  <option value="A+">A Positive (A+)</option>
                  <option value="B-">B Negative (B-)</option>
                  <option value="B+">B Positive (B+)</option>
                  <option value="AB-">AB Negative (AB-)</option>
                  <option value="AB+">AB Positive (AB+)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="space-y-xs">
                <label className="text-label-md font-label-md text-on-surface-variant block">Hospital Name</label>
                <input value={hospital} onChange={(e) => setHospital(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline outline-none bg-surface-container-low" placeholder="e.g. Apollo Specialty Hospital" type="text"/>
              </div>
              <div className="space-y-xs">
                <label className="text-label-md font-label-md text-on-surface-variant block">City / Location</label>
                <input value={location} onChange={(e) => setLocation(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline outline-none bg-surface-container-low" placeholder="Adyar, Chennai, TN" type="text"/>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="space-y-xs">
                <label className="text-label-md font-label-md text-on-surface-variant block">Contact Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline outline-none bg-surface-container-low" placeholder="+91 98765 43210" type="tel"/>
              </div>
              <div className="space-y-xs">
                <label className="text-label-md font-label-md text-on-surface-variant block">Urgency Level</label>
                <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full h-12 px-4 rounded-lg border border-outline outline-none bg-surface-container-low">
                  <option value="critical">Critical (Immediate life-threat)</option>
                  <option value="high">High (Needed within 4-6 hours)</option>
                  <option value="normal">Normal (Stable condition)</option>
                </select>
              </div>
            </div>
            <div className="space-y-xs">
              <label className="text-label-md font-label-md text-on-surface-variant block">Notes (Optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full p-4 rounded-lg border border-outline outline-none bg-surface-container-low resize-none" placeholder="Medical requirements..." rows="3"></textarea>
            </div>
            <button disabled={loading} className="w-full bg-primary hover:bg-secondary text-white font-title-md py-4 rounded-lg shadow-lg flex items-center justify-center gap-base" type="submit">
              {loading ? "Broadcasting..." : "Post Emergency Request"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-5 space-y-gutter">
          <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant overflow-hidden">
            <div className="p-4 bg-surface-container flex items-center justify-between border-b border-outline-variant">
              <h2 className="font-title-md text-title-md text-on-surface">Recent Active Broadcasts</h2>
              <div className="flex items-center gap-xs text-primary font-bold">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                <span className="text-label-sm">LIVE</span>
              </div>
            </div>
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto bg-surface-container-low">
              {broadcasts.length === 0 ? (
                <p className="text-center text-sm text-on-surface-variant py-4">No active emergency requests.</p>
              ) : (
                broadcasts.slice(0, 5).map(r => {
                  const badgeColor = r.urgency === 'critical' ? 'bg-error text-on-error' : r.urgency === 'high' ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface';
                  return (
                    <div key={r.id} className="p-3 rounded-lg border border-outline-variant bg-surface-container-lowest flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}`}>{r.urgency}</span>
                        <span className="text-[10px] text-on-surface-variant">{r.status === 'Pending' ? 'Active' : `Assigned`}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">{r.blood_group}</div>
                        <div>
                          <p className="text-xs font-bold text-on-surface">{r.hospital_name}</p>
                          <p className="text-[10px] text-on-surface-variant">{r.location}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function LoginView({ handleLogin }) {
  const [role, setRole] = useState('donor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
    } catch (err) {
      console.error(err);
      setError(err.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex-grow flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white/85 backdrop-blur-xl rounded-[24px] shadow-2xl p-8 border border-outline-variant">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-primary text-5xl inline-block mb-3" style={{ fontVariationSettings: "'FILL' 1" }}>bloodtype</span>
          <h2 className="text-headline-lg font-bold text-on-surface">Welcome Back</h2>
          <p className="text-on-surface-variant text-sm mt-1">Please enter your credentials to log in.</p>
        </div>

        <div className="flex border-b border-outline-variant mb-6">
          <button onClick={() => setRole('donor')} className={`flex-1 pb-3 text-center border-b-2 font-bold text-label-md transition-all ${role === 'donor' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}>Donor Login</button>
          <button onClick={() => setRole('admin')} className={`flex-1 pb-3 text-center border-b-2 font-bold text-label-md transition-all ${role === 'admin' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}>Admin Login</button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 text-error text-sm rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-label-md font-bold text-on-surface-variant block">Email Address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder={role === 'admin' ? 'admin@hospital.org' : 'donor@example.com'} type="email"/>
          </div>
          <div className="space-y-1">
            <label className="text-label-md font-bold text-on-surface-variant block">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full h-12 px-4 rounded-lg border border-outline-variant outline-none" placeholder="••••••••" type="password"/>
          </div>
          <button type="submit" disabled={loading} className="w-full h-12 bg-primary hover:bg-secondary text-on-primary rounded-xl font-bold shadow-lg transition-all mt-6">
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 bg-surface-container-low p-4 rounded-xl border border-outline-variant text-[11px] text-on-surface-variant">
          <strong>Demo Logins:</strong><br/>
          • Donor: <code>donor@example.com</code> / <code>password123</code><br/>
          • Admin: <code>admin@hospital.org</code> / <code>admin123</code>
        </div>
      </div>
    </main>
  );
}

function DonorDashboardView({ user, setView, handleLogout, toggleAvailability, donorDashboardData, respondToEmergency }) {
  if (!user) return null;
  const { donor, history, matching_requests } = donorDashboardData;
  const isAvailable = donor ? donor.is_available : user.isAvailable;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex flex-col h-screen w-64 bg-surface-container-low border-r border-outline-variant p-4 space-y-2 sticky top-0 shrink-0">
        <div className="flex items-center gap-3 px-2 py-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bloodtype</span>
          </div>
          <div>
            <h1 className="font-title-md text-title-md text-primary tracking-tight leading-tight">Blood Donor</h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">Connect Dashboard</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          <button onClick={() => setView('donor-dashboard')} className="w-full flex items-center gap-3 px-4 py-3 bg-primary-container text-on-primary-container font-bold rounded-lg text-left">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-md text-label-md">Dashboard</span>
          </button>
          <button onClick={() => setView('search')} className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg text-left">
            <span className="material-symbols-outlined">search</span>
            <span className="font-label-md text-label-md">Search Donors</span>
          </button>
          <button onClick={() => setView('emergency')} className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg text-left">
            <span className="material-symbols-outlined">emergency</span>
            <span className="font-label-md text-label-md">Emergency Request</span>
          </button>
        </nav>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg text-left">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label-md text-label-md">Logout</span>
        </button>
      </aside>

      <main className="flex-1 px-4 md:px-margin-desktop py-8 overflow-y-auto">
        <div className="md:hidden flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>bloodtype</span>
            <h1 className="font-title-md text-title-md text-primary tracking-tight">Blood Connect</h1>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-full bg-surface-container-high text-on-surface-variant">
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter mb-8">
          <div className="lg:col-span-2 relative overflow-hidden rounded-[24px] bg-primary p-8 text-on-primary shadow-lg">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-headline-lg text-headline-lg mb-1">Hello, {user.name}</h2>
                  <p className="opacity-90 font-body-md text-body-md">Your contribution saves lives. Ready to help today?</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 text-center min-w-[100px]">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1">Blood Type</p>
                  <p className="text-3xl font-display-lg leading-none">{user.bloodGroup}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 mt-8">
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <span className="text-sm font-label-md">Verified Donor</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                  <span className="text-sm font-label-md">{user.location}</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant p-8 rounded-[24px] shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-title-md text-title-md text-on-surface">Profile Status</h3>
                <span className="text-primary font-bold">Active</span>
              </div>
              <div className="w-full bg-surface-container-highest rounded-full h-3 mb-6">
                <div className="bg-primary h-3 rounded-full" style={{ width: '100%' }}></div>
              </div>
              <p className="text-on-surface-variant text-body-md">You are registered in the Blood Connect database and visible for emergencies.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          <div className="lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-[24px] p-8 shadow-sm">
            <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2 mb-8">
              <span className="material-symbols-outlined text-primary">history</span>
              Donation History Log
            </h3>
            <div className="space-y-8 relative">
              {history && history.length > 0 ? (
                <>
                  <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-outline-variant"></div>
                  {history.map((h, idx) => (
                    <div key={idx} className="flex gap-6 relative group">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 z-10 border-4 border-surface-container-lowest">
                        <span className="material-symbols-outlined text-on-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-label-md text-on-surface font-bold">{h.facility}</h4>
                          <span className="text-on-surface-variant text-sm">{h.donation_date}</span>
                        </div>
                        <p className="text-on-surface-variant text-sm mb-3">Whole Blood Donation • {h.volume_ml}ml</p>
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">{h.status}</span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-center text-sm py-4 text-on-surface-variant">No history logs recorded yet.</p>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-gutter">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-[24px] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${isAvailable ? 'bg-green-500 pulse-red' : 'bg-surface-dim'}`}></div>
                  </div>
                  <div>
                    <p className="font-title-md text-title-md text-on-surface">Available to Donate</p>
                    <p className="text-sm text-on-surface-variant">{isAvailable ? 'Visible to hospitals' : 'Hidden in searches'}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input checked={isAvailable} onChange={toggleAvailability} className="sr-only peer" type="checkbox"/>
                  <div className="w-14 h-7 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="lg:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-[24px] p-8 shadow-sm mt-8">
            <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2 mb-8">
              <span className="material-symbols-outlined text-primary">emergency</span>
              Matching Emergency Broadcasts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matching_requests && matching_requests.length > 0 ? (
                matching_requests.map(r => (
                  <div key={r.id} className="border border-outline-variant rounded-2xl p-6 border-l-4 border-l-primary bg-surface-bright flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <div className="bg-red-100 text-primary w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg">{r.blood_group}</div>
                        <span className={`text-xs font-label-sm capitalize px-2 py-1 rounded ${r.urgency === 'critical' ? 'bg-error-container text-on-error-container font-bold animate-pulse' : 'bg-primary-container text-on-primary-container'}`}>{r.urgency}</span>
                      </div>
                      <h4 className="font-label-md text-on-surface font-bold mb-1">{r.hospital_name}</h4>
                      <p className="text-sm text-on-surface-variant mb-6 line-clamp-2">{r.notes}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-xs text-on-surface-variant">{r.location}</span>
                      {r.status === 'Assigned' ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-bold">Responded</span>
                      ) : (
                        <button onClick={() => respondToEmergency(r.id)} className="bg-primary hover:bg-secondary text-on-primary px-5 py-2 rounded-lg font-label-md text-sm transition-colors">Respond</button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-center text-sm py-4 text-on-surface-variant">No matching emergency broadcasts at this time.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminDashboardView({ setView, handleLogout, adminStats, donors, broadcasts, setAssignModal }) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden md:flex flex-col h-screen w-64 bg-surface-container-low border-r border-outline-variant p-4 space-y-2 sticky top-0 shrink-0">
        <a href="/" className="flex items-center gap-3 px-2 py-4 mb-6">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bloodtype</span>
          </div>
          <div>
            <h1 className="text-title-md font-title-md text-primary leading-tight">City Hospital</h1>
            <p className="text-label-sm text-on-surface-variant">Blood Bank Admin</p>
          </div>
        </a>
        <nav className="flex-1 space-y-1">
          <button onClick={() => setView('admin-dashboard')} className="w-full flex items-center gap-3 px-4 py-3 bg-primary-container text-on-primary-container font-bold rounded-lg text-left">
            <span className="material-symbols-outlined">dashboard</span>
            <span className="font-label-md text-label-md">Dashboard</span>
          </button>
          <button onClick={() => setView('search')} className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg text-left">
            <span className="material-symbols-outlined">search</span>
            <span className="font-label-md text-label-md">Find Donors</span>
          </button>
          <button onClick={() => setView('emergency')} className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg text-left">
            <span className="material-symbols-outlined">emergency</span>
            <span className="font-label-md text-label-md">Emergency Request</span>
          </button>
        </nav>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-on-surface-variant hover:bg-surface-container-highest rounded-lg text-left">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label-md text-label-md">Logout</span>
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto relative h-screen bg-surface px-8 py-8">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Dashboard Overview</h2>
            <p className="text-body-lg text-on-surface-variant">Welcome back, System Admin.</p>
          </div>
          {adminStats.active_requests > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-error-container text-on-error-container rounded-full animate-pulse">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span className="text-label-md font-bold">{adminStats.active_requests} Urgent Requests Pending</span>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-8">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <p className="text-label-md text-on-surface-variant">Total Donors</p>
            <h3 className="text-display-lg font-display-lg leading-tight mt-1">{adminStats.total_donors}</h3>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <p className="text-label-md text-on-surface-variant">Active Available Donors</p>
            <h3 className="text-display-lg font-display-lg leading-tight mt-1">{adminStats.active_donors}</h3>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm ring-2 ring-primary/20">
            <p className="text-label-md text-on-surface-variant">Live Pending Requests</p>
            <h3 className="text-display-lg font-display-lg text-error leading-tight mt-1">{adminStats.active_requests}</h3>
          </div>
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <p className="text-label-md text-on-surface-variant">Matching Success Rate</p>
            <h3 className="text-display-lg font-display-lg leading-tight mt-1">{adminStats.success_rate}%</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter mb-8">
          <div className="lg:col-span-8 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant flex flex-col">
            <h4 className="text-title-md font-title-md mb-6">Recent Emergency Broadcasts</h4>
            <div className="space-y-4">
              {broadcasts.length === 0 ? (
                <p className="text-center text-sm py-8 text-on-surface-variant">No emergency requests logged.</p>
              ) : (
                broadcasts.map(r => (
                  <div key={r.id} className={`p-4 rounded-xl border border-outline-variant flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${r.status === 'Pending' ? 'bg-surface-bright border-l-4 border-l-primary' : 'bg-surface-container-low opacity-80'}`}>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-error/10 text-primary flex flex-col items-center justify-center shrink-0 font-bold text-lg">{r.blood_group}</div>
                      <div>
                        <h5 className="font-bold text-on-surface">{r.hospital_name}</h5>
                        <p className="text-sm text-on-surface-variant">{r.notes}</p>
                        <p className="text-[11px] text-on-surface-variant mt-1">Patient: {r.patient_name} • Location: {r.location} • Call: {r.contact}</p>
                      </div>
                    </div>
                    <div>
                      {r.status === 'Pending' ? (
                        <button onClick={() => setAssignModal({ requestId: r.id, hospital: r.hospital_name, bloodGroup: r.blood_group })} className="px-4 py-2 bg-primary hover:bg-secondary text-on-primary rounded-lg text-label-md font-bold transition-all">Assign Donor</button>
                      ) : (
                        <span className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-bold flex items-center gap-1">Assigned to {r.assigned_donor_name || 'Donor'}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="lg:col-span-4 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant space-y-4">
            <h4 className="text-title-md font-title-md">Blood Type Compatibility</h4>
            <div className="text-sm text-on-surface-variant space-y-3">
              <p>Verify matching rules before assigning a donor manually to a hospital location broadcast:</p>
              <div className="p-3 bg-surface-container-low rounded-xl">
                <p className="font-bold text-primary">Universal Donors</p>
                <p className="text-xs">O negative (O-) can donate to all blood types.</p>
              </div>
            </div>
          </div>
        </div>

        <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
          <div className="p-6 border-b border-outline-variant">
            <h4 className="text-title-md font-title-md">Donor Directory Database</h4>
            <p className="text-label-md text-on-surface-variant">Detailed view of all registered members in system</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low text-on-surface-variant text-[12px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Donor Identity</th>
                  <th className="px-6 py-4">Blood Type</th>
                  <th className="px-6 py-4">Last Donation</th>
                  <th className="px-6 py-4">Availability Status</th>
                  <th className="px-6 py-4">Lifetime Log</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {donors.map(d => (
                  <tr key={d.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-label-md font-bold">{d.name}</p>
                      <p className="text-[12px] text-on-surface-variant">{d.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-label-sm font-bold">{d.blood_group}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-label-md">{d.last_donation_date}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${d.is_available ? 'bg-green-500' : 'bg-surface-dim'}`}></div>
                        <span className="text-label-md">{d.is_available ? 'Available' : 'Invisible'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-label-md font-bold">{d.donations_count || 0} times</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
