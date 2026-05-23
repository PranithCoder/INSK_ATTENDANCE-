// app.jsx - Core React SPA Application with State Management, Components, and Dual-Mode Data Binding

const { useState, useEffect, useMemo } = React;

// Main App Wrapper
function App() {
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [deductions, setDeductions] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [notify, setNotify] = useState(null);
  const [dbMode, setDbMode] = useState('local');

  // Supabase Credential form states
  const [sbUrl, setSbUrl] = useState(window.safeStorage.getItem(window.DB_KEYS.URL) || '');
  const [sbKey, setSbKey] = useState(window.safeStorage.getItem(window.DB_KEYS.KEY) || '');
  const [showConfig, setShowConfig] = useState(false);

  // Helper for notifications
  const triggerNotification = (type, text) => {
    setNotify({ type, text });
    setTimeout(() => setNotify(null), 4000);
  };

  // Load database status
  useEffect(() => {
    const checkAuth = async () => {
      setDbMode(window.supabaseClient.isMock ? 'local' : 'supabase');
      try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) {
          // Verify if admin flag matches
          const adminsRes = await window.supabaseClient.from('admins').select('*');
          const adminsList = adminsRes.data || [];
          const isAdmin = adminsList.some(a => a.email.toLowerCase() === user.email.toLowerCase()) || user.is_admin;
          if (isAdmin) {
            setUser({ ...user, is_admin: true });
          } else {
            await window.supabaseClient.auth.signOut();
            setUser(null);
            triggerNotification('error', 'Access Denied: Only administrators can sign in.');
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth check failed", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
    
    // Subscribe to reconnection events
    const handleReconnect = () => {
      checkAuth();
    };
    window.addEventListener('supabase_reconnect', handleReconnect);
    
    // Subscribe to auth changes
    const { data: { subscription } } = window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const adminsRes = await window.supabaseClient.from('admins').select('*');
        const adminsList = adminsRes.data || [];
        const isAdmin = adminsList.some(a => a.email.toLowerCase() === session.user.email.toLowerCase()) || session.user.is_admin;
        if (isAdmin) {
          setUser({ ...session.user, is_admin: true });
        } else {
          await window.supabaseClient.auth.signOut();
          setUser(null);
          triggerNotification('error', 'Access Denied: Only administrators can sign in.');
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      window.removeEventListener('supabase_reconnect', handleReconnect);
      subscription.unsubscribe();
    };
  }, []);

  // Fetch all database tables
  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch employees
      let employeesData = [];
      if (user.is_admin) {
        const res = await window.supabaseClient.from('employees').select('*').order('name');
        employeesData = res.data || [];
      } else {
        const res = await window.supabaseClient.from('employees').select('*').eq('id', user.id);
        employeesData = res.data || [];
      }
      setEmployees(employeesData);

      // 2. Fetch attendance
      let attendanceData = [];
      if (user.is_admin) {
        const res = await window.supabaseClient.from('attendance').select('*').order('date', { ascending: false });
        attendanceData = res.data || [];
      } else {
        const res = await window.supabaseClient.from('attendance').select('*').eq('employee_id', user.id).order('date', { ascending: false });
        attendanceData = res.data || [];
      }
      setAttendance(attendanceData);

      // 3. Fetch deductions
      let deductionsData = [];
      if (user.is_admin) {
        const res = await window.supabaseClient.from('deductions').select('*').order('date', { ascending: false });
        deductionsData = res.data || [];
      } else {
        const res = await window.supabaseClient.from('deductions').select('*').eq('employee_id', user.id).order('date', { ascending: false });
        deductionsData = res.data || [];
      }
      setDeductions(deductionsData);
    } catch (err) {
      triggerNotification('error', 'Failed to retrieve records from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Helper to save Supabase keys
  const saveCredentials = (e) => {
    e.preventDefault();
    if (sbUrl && sbKey) {
      window.safeStorage.setItem(window.DB_KEYS.URL, sbUrl);
      window.safeStorage.setItem(window.DB_KEYS.KEY, sbKey);
      triggerNotification('success', 'Supabase credentials saved. Reconnecting...');
    } else {
      window.safeStorage.removeItem(window.DB_KEYS.URL);
      window.safeStorage.removeItem(window.DB_KEYS.KEY);
      triggerNotification('success', 'Credentials cleared. Switched to Mock Local Storage.');
    }
    setShowConfig(false);
    window.reconnectSupabase();
  };

  // Reset database simulation helper
  const handleResetDb = () => {
    if (confirm('Are you sure you want to restore default mock records? This clears all changes.')) {
      window.supabaseClient.resetDatabase();
      triggerNotification('success', 'Mock data restored.');
      fetchData();
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    setLoading(true);
    await window.supabaseClient.auth.signOut();
    setUser(null);
    setActiveTab('dashboard');
    setLoading(false);
    triggerNotification('success', 'Successfully logged out.');
  };

  if (loading && !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0b0f19]">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-400 font-display font-medium">Loading Attendance Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col md:flex-row">
      {/* Notifications */}
      {notify && (
        <div className="fixed top-4 right-4 z-50 animate-slide-up">
          <div className={`px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 ${
            notify.type === 'success' 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30' 
              : 'bg-rose-950/80 text-rose-300 border-rose-500/30'
          }`}>
            <span className="text-xl">
              {notify.type === 'success' ? '✓' : '⚠'}
            </span>
            <span className="text-sm font-medium">{notify.text}</span>
          </div>
        </div>
      )}

      {!user ? (
        <AuthScreen 
          triggerNotification={triggerNotification} 
          showConfig={showConfig}
          setShowConfig={setShowConfig}
          sbUrl={sbUrl}
          setSbUrl={setSbUrl}
          sbKey={sbKey}
          setSbKey={setSbKey}
          saveCredentials={saveCredentials}
          dbMode={dbMode}
        />
      ) : (
        <>
          {/* Sidebar */}
          <Sidebar 
            user={user} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            handleLogout={handleLogout}
            dbMode={dbMode}
            setShowConfig={setShowConfig}
            handleResetDb={handleResetDb}
          />

          {/* Main Layout Area */}
          <main className="flex-1 p-6 md:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
            {/* Header section */}
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-800 mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-display font-extrabold text-white tracking-tight capitalize">
                  {activeTab} Workspace
                </h1>
                <p className="text-slate-400 text-sm mt-1">
                  {user.is_admin ? 'HR Management & Payroll Operations' : `Personal Activity Log — Welcome, ${user.user_metadata?.name || user.email}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 ${
                  dbMode === 'supabase' 
                    ? 'bg-violet-950/60 text-violet-300 border border-violet-500/30' 
                    : 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${dbMode === 'supabase' ? 'bg-violet-400 pulse-badge' : 'bg-blue-400 pulse-badge'}`}></span>
                  {dbMode === 'supabase' ? 'Supabase DB Connected' : 'Demo Local Storage'}
                </span>
                {dbMode === 'local' && (
                  <button 
                    onClick={handleResetDb}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition"
                    title="Reset to default mock data"
                  >
                    Reset Data
                  </button>
                )}
              </div>
            </header>

            {/* Dynamic Views */}
            {activeTab === 'dashboard' && (
              <Dashboard 
                user={user} 
                employees={employees} 
                attendance={attendance} 
                deductions={deductions}
                setActiveTab={setActiveTab}
              />
            )}

            {activeTab === 'attendance' && user.is_admin && (
              <AttendanceLogger 
                employees={employees} 
                attendance={attendance} 
                fetchData={fetchData}
                triggerNotification={triggerNotification}
              />
            )}

            {activeTab === 'deductions' && user.is_admin && (
              <DeductionLogger 
                employees={employees} 
                deductions={deductions} 
                fetchData={fetchData}
                triggerNotification={triggerNotification}
              />
            )}

            {activeTab === 'employees' && user.is_admin && (
              <EmployeeManager 
                employees={employees} 
                fetchData={fetchData}
                triggerNotification={triggerNotification}
                dbMode={dbMode}
              />
            )}

            {activeTab === 'reports' && (
              <ReportGenerator 
                user={user}
                employees={employees} 
                attendance={attendance} 
                deductions={deductions}
                triggerNotification={triggerNotification}
              />
            )}
          </main>
        </>
      )}

      {/* Supabase Connection Setup Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-xl font-display font-bold text-white">Database Settings</h3>
              <button 
                onClick={() => setShowConfig(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={saveCredentials} className="space-y-4">
              <p className="text-xs text-slate-400">
                Provide your custom Supabase API credentials to bind this web portal to your live database instance. Leave blank to switch back to Local Storage Mock Mode.
              </p>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Supabase URL</label>
                <input 
                  type="url" 
                  value={sbUrl} 
                  onChange={(e) => setSbUrl(e.target.value)} 
                  placeholder="https://your-project.supabase.co"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">Supabase Anon Key</label>
                <input 
                  type="password" 
                  value={sbKey} 
                  onChange={(e) => setSbKey(e.target.value)} 
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSbUrl('');
                    setSbKey('');
                  }}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Clear Fields
                </button>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowConfig(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-indigo-600/30"
                  >
                    Connect Database
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CALCULATION ENGINE
// =========================================================================
// Calculates attendance rates and pay variables per employee.
// Deducts Rs. 100 per point, gives Rs. 500 per day worked (capped weekly at Rs. 3,000)
function computePayrollData(employeeId, attendanceList, deductionsList, isMonthly = true) {
  const empAttendance = attendanceList.filter(a => a.employee_id === employeeId && a.status === 'Present');
  const empDeductions = deductionsList.filter(d => d.employee_id === employeeId);

  // Group Present days by Calendar Week (Monday to Sunday)
  const weeklyAttendanceCount = {};
  empAttendance.forEach(record => {
    const recDate = new Date(record.date);
    const day = recDate.getDay();
    const diff = recDate.getDate() - day + (day === 0 ? -6 : 1); // Get Monday date
    const monday = new Date(recDate.setDate(diff)).toISOString().split('T')[0];

    if (!weeklyAttendanceCount[monday]) {
      weeklyAttendanceCount[monday] = 0;
    }
    weeklyAttendanceCount[monday]++;
  });

  let totalAllowance = 0;
  Object.keys(weeklyAttendanceCount).forEach(monDate => {
    const presentDays = weeklyAttendanceCount[monDate];
    const rawAllowance = presentDays * 500;
    // Cap weekly allowance at Rs 3,000
    totalAllowance += Math.min(rawAllowance, 3000);
  });

  const totalPoints = empDeductions.reduce((sum, d) => sum + parseInt(d.points_lost || 0), 0);
  const totalDeductions = totalPoints * 100;
  
  // Reward: if they secured 10 points (0 points lost) in a monthly period, they get Rs. 1000 reward
  const reward = (isMonthly && totalPoints === 0 && empAttendance.length > 0) ? 1000 : 0;
  const netPay = totalAllowance - totalDeductions + reward;

  return {
    daysWorked: empAttendance.length,
    totalPoints,
    totalAllowance,
    totalDeductions,
    reward,
    netPay
  };
}

// Helper to group attendance into ISO Weeks for drilldowns
function getWeekRange(dateString) {
  const d = new Date(dateString);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const start = new Date(d.setDate(diff));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString(undefined, {month:'short', day:'numeric'})} - ${end.toLocaleDateString(undefined, {month:'short', day:'numeric'})}`;
}

// =========================================================================
// AUTHENTICATION SCREEN COMPONENT
// =========================================================================
function AuthScreen({ triggerNotification, showConfig, setShowConfig, sbUrl, setSbUrl, sbKey, setSbKey, saveCredentials, dbMode }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      const userObj = data.user;
      if (userObj) {
        const adminsRes = await window.supabaseClient.from('admins').select('*');
        const adminsList = adminsRes.data || [];
        const isAdmin = adminsList.some(a => a.email.toLowerCase() === userObj.email.toLowerCase()) || userObj.is_admin;
        if (!isAdmin) {
          await window.supabaseClient.auth.signOut();
          throw new Error('Access Denied: Only administrators can sign in.');
        }
      }
      triggerNotification('success', 'Logged in successfully!');
    } catch (err) {
      triggerNotification('error', err.message || 'Authentication error occurred.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-[#0b0f19] to-slate-950 min-h-screen">
      <div className="w-full max-w-md">
        {/* Brand Logo Header */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 bg-gradient-to-tr from-indigo-600 to-violet-400 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20 mx-auto transform hover:rotate-12 transition">
            <span className="text-2xl font-display font-extrabold text-white">A</span>
          </div>
          <h2 className="text-3xl font-display font-extrabold text-white mt-4 tracking-tight">
            Attendance & Payroll Portal
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Empowering organizations with automated attendance points tracking.
          </p>
        </div>

        {/* Auth Panel */}
        <div className="glass-panel rounded-3xl p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          {/* Accent Glow */}
          <div className="absolute -top-12 -left-12 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl"></div>

          <div className="text-center border-b border-slate-800 pb-4 mb-6">
            <h3 className="text-lg font-display font-bold text-white">Sign In to Account</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Email Address</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="you@company.com"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Password</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white transition"
              />
            </div>

            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transform hover:-translate-y-0.5 active:translate-y-0 transition duration-150 disabled:opacity-50 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : null}
              Sign In to Account
            </button>
          </form>
        </div>

        {/* Database Config Link */}
        <div className="text-center mt-6">
          <button 
            onClick={() => setShowConfig(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1.5 transition"
          >
            ⚙ Database Configuration Panel
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// SIDEBAR COMPONENT
// =========================================================================
function Sidebar({ user, activeTab, setActiveTab, handleLogout, dbMode, setShowConfig, handleResetDb }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'employee'] },
    { id: 'employees', label: 'Employees', icon: '👥', roles: ['admin'] },
    { id: 'attendance', label: 'Attendance', icon: '📅', roles: ['admin'] },
    { id: 'deductions', label: 'Point Deductions', icon: '⛔', roles: ['admin'] },
    { id: 'reports', label: 'Payroll Reports', icon: '📝', roles: ['admin', 'employee'] },
  ];

  const visibleNav = navigationItems.filter(item => 
    user.is_admin ? item.roles.includes('admin') : item.roles.includes('employee')
  );

  const initials = user.user_metadata?.name 
    ? user.user_metadata.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user.email.substring(0, 2).toUpperCase();

  return (
    <>
      {/* Mobile Nav Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900/90 border-b border-slate-800 px-6 py-4 w-full sticky top-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="font-display font-extrabold text-white">Attendance</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-300 hover:text-white"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Panel */}
      <aside className={`w-full md:w-64 bg-slate-950/80 border-r border-slate-800 flex flex-col sticky top-[69px] md:top-0 h-[calc(100vh-69px)] md:h-screen z-20 backdrop-blur-lg ${
        isMobileMenuOpen ? 'block' : 'hidden md:flex'
      }`}>
        {/* Logo and Brand */}
        <div className="p-6 hidden md:flex items-center gap-3 border-b border-slate-900">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <span className="text-white text-lg font-bold">A</span>
          </div>
          <div>
            <h2 className="font-display font-extrabold text-white text-md tracking-wide">ATTENDANCE</h2>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">HR Portal</span>
          </div>
        </div>

        {/* Profile Card */}
        <div className="p-5 border-b border-slate-900/60 bg-slate-900/20 flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-display font-bold shadow-md">
            {initials}
          </div>
          <div className="overflow-hidden flex-1">
            <h4 className="font-display font-bold text-white text-sm truncate">{user.user_metadata?.name || 'Admin User'}</h4>
            <span className="text-slate-500 text-xs truncate block capitalize">
              {user.is_admin ? 'HR Administrator' : user.user_metadata?.department || 'Employee'}
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {visibleNav.map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                activeTab === item.id 
                  ? 'bg-indigo-600/90 text-white shadow-lg shadow-indigo-600/10' 
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-slate-900 space-y-2">
          <button 
            onClick={() => setShowConfig(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 transition"
          >
            ⚙ Settings Panel
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition"
          >
            ↪ Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

// =========================================================================
// DASHBOARD COMPONENT (DYNAMIC PORTLETS)
// =========================================================================
function Dashboard({ user, employees, attendance, deductions, setActiveTab }) {
  // If user is Admin, render Admin KPI Dashboard
  if (user.is_admin) {
    return (
      <AdminDashboard 
        employees={employees} 
        attendance={attendance} 
        deductions={deductions} 
        setActiveTab={setActiveTab}
      />
    );
  }

  // If user is Employee, render Personal Stats Dashboard
  return (
    <EmployeeDashboard 
      user={user} 
      employees={employees} 
      attendance={attendance} 
      deductions={deductions} 
      setActiveTab={setActiveTab}
    />
  );
}

function AdminDashboard({ employees, attendance, deductions, setActiveTab }) {
  // Compute Key Admin Statistics
  const totalEmployees = employees.length;
  
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === 'Present').length;
  const attendanceRate = totalEmployees > 0 
    ? Math.round((presentToday / totalEmployees) * 100) 
    : 0;

  const totalPoints = deductions.reduce((sum, d) => sum + parseInt(d.points_lost || 0), 0);
  
  // Get current week's dates (Monday to Sunday)
  const currentWeekDates = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday date
    const monday = new Date(today.setDate(diff));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, [attendance]);

  // Filter current week & current month data
  const currentMonthStr = useMemo(() => new Date().toISOString().substring(0, 7), []);
  
  const weekAttendance = useMemo(() => attendance.filter(a => currentWeekDates.includes(a.date)), [attendance, currentWeekDates]);
  const weekDeductions = useMemo(() => deductions.filter(d => currentWeekDates.includes(d.date)), [deductions, currentWeekDates]);
  
  const monthAttendance = useMemo(() => attendance.filter(a => a.date.startsWith(currentMonthStr)), [attendance, currentMonthStr]);
  const monthDeductions = useMemo(() => deductions.filter(d => d.date.startsWith(currentMonthStr)), [deductions, currentMonthStr]);

  // Calculate total weekly net pay payout (no monthly reward)
  const weeklyPayout = useMemo(() => {
    let total = 0;
    employees.forEach(emp => {
      const { netPay } = computePayrollData(emp.id, weekAttendance, weekDeductions, false);
      total += netPay;
    });
    return total;
  }, [employees, weekAttendance, weekDeductions]);

  // Calculate total monthly net pay payout (includes monthly reward)
  const monthlyPayout = useMemo(() => {
    let total = 0;
    employees.forEach(emp => {
      const { netPay } = computePayrollData(emp.id, monthAttendance, monthDeductions, true);
      total += netPay;
    });
    return total;
  }, [employees, monthAttendance, monthDeductions]);

  // Calculate high infraction employees (>= 10 points lost in current month)
  const monthlyInfractions = useMemo(() => {
    const employeePointsMap = {};
    monthDeductions.forEach(d => {
      if (!employeePointsMap[d.employee_id]) {
        employeePointsMap[d.employee_id] = 0;
      }
      employeePointsMap[d.employee_id] += parseInt(d.points_lost || 0);
    });

    const flagged = [];
    Object.keys(employeePointsMap).forEach(empId => {
      if (employeePointsMap[empId] >= 10) {
        const emp = employees.find(e => e.id === empId);
        flagged.push({
          id: empId,
          name: emp ? emp.name : 'Unknown Employee',
          email: emp ? emp.email : '',
          points: employeePointsMap[empId]
        });
      }
    });
    return flagged;
  }, [employees, monthDeductions]);

  // Aggregate stats per department
  const deptStats = useMemo(() => {
    const depts = {};
    employees.forEach(emp => {
      const d = emp.department || 'General';
      if (!depts[d]) depts[d] = { count: 0, points: 0 };
      depts[d].count++;
    });

    deductions.forEach(ded => {
      const emp = employees.find(e => e.id === ded.employee_id);
      if (emp) {
        const d = emp.department || 'General';
        if (depts[d]) depts[d].points += parseInt(ded.points_lost || 0);
      }
    });

    return Object.keys(depts).map(name => ({
      name,
      count: depts[name].count,
      points: depts[name].points
    }));
  }, [employees, deductions]);

  // Find recent logs
  const recentDeductions = deductions.slice(0, 4);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Inverted Pyramid KPI metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1 */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4 text-3xl opacity-20">👥</div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Active Staff</span>
          <h3 className="text-3xl font-display font-extrabold text-white mt-2">{totalEmployees}</h3>
          <div className="mt-3 flex items-center text-xs text-indigo-400 font-bold cursor-pointer" onClick={() => setActiveTab('employees')}>
            Manage employee roster →
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4 text-3xl opacity-20">📅</div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Attendance Rate (Today)</span>
          <h3 className="text-3xl font-display font-extrabold text-white mt-2">{attendanceRate}%</h3>
          <div className="mt-3 flex items-center text-xs text-emerald-400 font-bold cursor-pointer" onClick={() => setActiveTab('attendance')}>
            {presentToday} of {totalEmployees} Present today →
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-4 right-4 text-3xl opacity-20">⛔</div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Violations Points</span>
          <h3 className="text-3xl font-display font-extrabold text-rose-400 mt-2">{totalPoints} Pts</h3>
          <div className="mt-3 flex items-center text-xs text-rose-400 font-bold cursor-pointer" onClick={() => setActiveTab('deductions')}>
            Log infraction event →
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel glass-panel-hover rounded-2xl p-6 relative overflow-hidden border border-indigo-500/20 glow-primary">
          <div className="absolute top-4 right-4 text-3xl opacity-20">💰</div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Estimated Payouts</span>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">Weekly:</span>
              <span className="text-base font-bold text-white">Rs. {weeklyPayout.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400">Monthly:</span>
              <span className="text-base font-bold text-emerald-400">Rs. {monthlyPayout.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs text-violet-400 font-bold cursor-pointer" onClick={() => setActiveTab('reports')}>
            Generate payroll reports →
          </div>
        </div>
      </div>

      {/* High Infraction Warning Banner */}
      {monthlyInfractions.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-6 text-rose-200">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl animate-pulse">⚠️</span>
            <h3 className="text-md font-display font-bold text-white">Critical Infraction Alert (10+ Points Lost This Month)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {monthlyInfractions.map(flag => (
              <div key={flag.id} className="flex justify-between items-center bg-[#11070b]/60 border border-rose-500/10 rounded-xl px-4 py-2 text-sm">
                <span className="truncate mr-2 font-medium text-slate-300">{flag.name} ({flag.email})</span>
                <span className="font-extrabold text-rose-400 whitespace-nowrap">{flag.points} Points Lost</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Graphs & Detailed Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Department Chart */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <h3 className="text-md font-display font-bold text-white mb-4">Department Roster & Violation Breakdown</h3>
          <div className="space-y-4">
            {deptStats.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No department statistics recorded yet.</p>
            ) : (
              deptStats.map(dept => {
                const maxPoints = Math.max(...deptStats.map(d => d.points), 1);
                const widthPercent = (dept.points / maxPoints) * 100;
                return (
                  <div key={dept.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-300">{dept.name} ({dept.count} Members)</span>
                      <span className="text-rose-400">{dept.points} Violation Points</span>
                    </div>
                    <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-rose-500 to-orange-400 rounded-full transition-all duration-500"
                        style={{ width: `${widthPercent || 5}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Activity feed */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-md font-display font-bold text-white mb-4">Recent Deductions Log</h3>
            <div className="space-y-4">
              {recentDeductions.length === 0 ? (
                <p className="text-slate-500 text-sm py-6 text-center">No infractions logged recently.</p>
              ) : (
                recentDeductions.map(ded => {
                  const emp = employees.find(e => e.id === ded.employee_id);
                  return (
                    <div key={ded.id} className="flex justify-between items-start border-l-2 border-rose-500 pl-3">
                      <div>
                        <h4 className="text-xs font-semibold text-white truncate max-w-[150px]">
                          {emp ? emp.name : 'Unknown Employee'}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{ded.reason}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-rose-400">-{ded.points_lost} Pts</span>
                        <p className="text-[9px] text-slate-500 mt-0.5">{ded.date}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('deductions')}
            className="w-full mt-4 py-2 bg-slate-900 hover:bg-slate-850 text-xs font-bold text-slate-300 rounded-xl transition"
          >
            Log Violation Points
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeDashboard({ user, employees, attendance, deductions, setActiveTab }) {
  // Get current month
  const currentMonthStr = useMemo(() => new Date().toISOString().substring(0, 7), []);

  // Filter current month logs
  const monthAttendance = useMemo(() => attendance.filter(a => a.employee_id === user.id && a.date.startsWith(currentMonthStr)), [attendance, user.id, currentMonthStr]);
  const monthDeductions = useMemo(() => deductions.filter(d => d.employee_id === user.id && d.date.startsWith(currentMonthStr)), [deductions, user.id, currentMonthStr]);

  // Run calculation hook for logged in employee for current month
  const stats = useMemo(() => {
    return computePayrollData(user.id, monthAttendance, monthDeductions, true);
  }, [user.id, monthAttendance, monthDeductions]);

  // General recent logs (filtered to user)
  const empAllAttendance = useMemo(() => attendance.filter(a => a.employee_id === user.id), [attendance, user.id]);
  const empAllDeductions = useMemo(() => deductions.filter(d => d.employee_id === user.id), [deductions, user.id]);

  const recentAttendance = useMemo(() => empAllAttendance.slice(0, 5), [empAllAttendance]);
  const recentDeductions = useMemo(() => empAllDeductions.slice(0, 5), [empAllDeductions]);

  const pointsThisMonth = stats.totalPoints;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Alert Notices */}
      {pointsThisMonth >= 10 && (
        <div className="bg-rose-950/40 border border-rose-500/30 rounded-2xl p-6 text-rose-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">⚠️</span>
            <div>
              <h3 className="text-md font-display font-bold text-white">Critical Infraction Alert</h3>
              <p className="text-xs text-rose-300/80 mt-1">
                You have accumulated <strong className="text-rose-400 font-extrabold">{pointsThisMonth} violation points</strong> this month. Please schedule a review meeting with your HR Administrator immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.reward > 0 && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-6 text-emerald-200">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <h3 className="text-md font-display font-bold text-white">Perfect Monthly Record Secured!</h3>
              <p className="text-xs text-emerald-300/80 mt-1">
                Outstanding job! You had 0 violation points this month and secured your full points record, earning a **Rs. 1,000 bonus reward** added to your payroll allowance.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Inverted Pyramid metrics for employee */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1 */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Worked Days (Month)</span>
          <h3 className="text-3xl font-display font-extrabold text-white mt-1">{stats.daysWorked} Days</h3>
          <div className="absolute bottom-2 right-4 text-3xl opacity-10">📅</div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Points Lost (Month)</span>
          <h3 className="text-3xl font-display font-extrabold text-rose-400 mt-1">{stats.totalPoints} Pts</h3>
          <div className="absolute bottom-2 right-4 text-3xl opacity-10">⛔</div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel rounded-2xl p-5 relative overflow-hidden">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Total Allowances</span>
          <h3 className="text-3xl font-display font-extrabold text-white mt-1">Rs. {stats.totalAllowance}</h3>
          {stats.reward > 0 && (
            <span className="absolute top-2 right-2 px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/20 rounded text-[9px] font-bold">
              +Rs. 1,000 Reward
            </span>
          )}
          <div className="absolute bottom-2 right-4 text-3xl opacity-10">💰</div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel rounded-2xl p-5 border border-indigo-500/20 glow-primary relative overflow-hidden">
          <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">Net Take-Home Pay</span>
          <h3 className="text-3xl font-display font-extrabold text-emerald-400 mt-1">Rs. {stats.netPay}</h3>
          <div className="absolute bottom-2 right-4 text-3xl opacity-15">💸</div>
        </div>
      </div>

      {/* Logs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance history */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-md font-display font-bold text-white mb-4">Recent Attendance Logs</h3>
          <div className="divide-y divide-slate-800/80">
            {recentAttendance.length === 0 ? (
              <p className="text-slate-500 text-sm py-6 text-center">No attendance logged yet.</p>
            ) : (
              recentAttendance.map(att => (
                <div key={att.id} className="py-3 flex justify-between items-center">
                  <div>
                    <span className="text-sm font-semibold text-slate-300">{att.date}</span>
                    <p className="text-[10px] text-slate-500">ISO Week: {getWeekRange(att.date)}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    att.status === 'Present' 
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                  }`}>
                    {att.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Deductions breakdown */}
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-md font-display font-bold text-white mb-4">Deductions & Violations History</h3>
          <div className="divide-y divide-slate-800/80">
            {recentDeductions.length === 0 ? (
              <p className="text-slate-500 text-sm py-6 text-center">Excellent! No violation events recorded.</p>
            ) : (
              recentDeductions.map(ded => (
                <div key={ded.id} className="py-3 flex justify-between items-start gap-4">
                  <div>
                    <span className="text-sm font-semibold text-white block">{ded.reason}</span>
                    <span className="text-[10px] text-slate-500">{ded.date}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-rose-400">-{ded.points_lost} Points</span>
                    <p className="text-[9px] text-slate-500 mt-0.5">Rs. {ded.points_lost * 100} Deduct</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// ATTENDANCE LOGGER MATRIX COMPONENT (ADMIN)
// =========================================================================
function AttendanceLogger({ employees, attendance, fetchData, triggerNotification }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  
  // Track status updates for current screen locally
  const [logState, setLogState] = useState({});

  // Sync screen state when employees or date changes
  useEffect(() => {
    const initialState = {};
    employees.forEach(emp => {
      const existing = attendance.find(a => a.employee_id === emp.id && a.date === selectedDate);
      initialState[emp.id] = existing ? existing.status : 'Absent'; // Default to Absent if unmarked
    });
    setLogState(initialState);
  }, [employees, selectedDate, attendance]);

  const handleToggleStatus = (empId, status) => {
    setLogState(prev => ({
      ...prev,
      [empId]: status
    }));
  };

  const handleMarkAll = (status) => {
    const updated = {};
    employees.forEach(emp => {
      updated[emp.id] = status;
    });
    setLogState(updated);
  };

  const handleSaveAttendance = async () => {
    setSaving(true);
    try {
      const recordsToUpsert = Object.keys(logState).map(empId => ({
        employee_id: empId,
        date: selectedDate,
        status: logState[empId]
      }));

      const { error } = await window.supabaseClient.from('attendance').upsert(recordsToUpsert);
      if (error) throw error;
      
      triggerNotification('success', 'Attendance matrix successfully updated.');
      fetchData();
    } catch (err) {
      triggerNotification('error', err.message || 'Failed to update attendance.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-semibold text-slate-300">Choose Logging Date:</label>
          <input 
            type="date" 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>
        <div className="flex gap-2.5">
          <button 
            type="button" 
            onClick={() => handleMarkAll('Present')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold rounded-xl text-slate-300 transition"
          >
            ✓ Mark All Present
          </button>
          <button 
            type="button" 
            onClick={() => handleMarkAll('Absent')}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold rounded-xl text-slate-300 transition"
          >
            ✕ Mark All Absent
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse custom-table">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <th className="px-6 py-4">Employee Name</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Previous Month Stats</th>
                <th className="px-6 py-4 text-center">Attendance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-slate-500 text-sm">
                    No registered employees found. Register staff members first.
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  const currentStatus = logState[emp.id] || 'Absent';
                  
                  // Compute historical stats
                  const workedRecords = attendance.filter(a => a.employee_id === emp.id && a.status === 'Present');
                  
                  return (
                    <tr key={emp.id} className="hover:bg-slate-900/30 transition">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-white block">{emp.name}</span>
                        <span className="text-slate-500 text-[11px]">{emp.email}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 text-sm">{emp.department}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-400 block">{workedRecords.length} Present Days Logged</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(emp.id, 'Present')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                              currentStatus === 'Present'
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40 shadow-md shadow-emerald-950/20'
                                : 'bg-transparent text-slate-500 border-slate-800/80 hover:text-slate-300'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(emp.id, 'Absent')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                              currentStatus === 'Absent'
                                ? 'bg-rose-950/80 text-rose-400 border-rose-500/40 shadow-md shadow-rose-950/20'
                                : 'bg-transparent text-slate-500 border-slate-800/80 hover:text-slate-300'
                            }`}
                          >
                            Absent
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {employees.length > 0 && (
          <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleSaveAttendance}
              disabled={saving}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transform hover:-translate-y-0.5 transition flex items-center gap-2"
            >
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : null}
              Save Daily Attendance Matrix
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// DEDUCTION LOGGER & VIOLATION MANAGEMENT (ADMIN)
// =========================================================================
function DeductionLogger({ employees, deductions, fetchData, triggerNotification }) {
  const [empId, setEmpId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reasonCategory, setReasonCategory] = useState('Late Login (Over 30 Mins)');
  const [customReason, setCustomReason] = useState('');
  const [points, setPoints] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Set default employee select
  useEffect(() => {
    if (employees.length > 0 && !empId) {
      setEmpId(employees[0].id);
    }
  }, [employees]);

  const handleSubmitDeduction = async (e) => {
    e.preventDefault();
    if (!empId) {
      triggerNotification('error', 'Please select an employee profile.');
      return;
    }
    
    setSubmitting(true);
    try {
      const finalReason = customReason ? `${reasonCategory}: ${customReason}` : reasonCategory;
      const payload = {
        employee_id: empId,
        date,
        reason: finalReason,
        points_lost: parseInt(points)
      };

      const { error } = await window.supabaseClient.from('deductions').insert(payload);
      if (error) throw error;

      triggerNotification('success', 'Violation points assigned successfully.');
      setCustomReason('');
      setShowModal(false);
      fetchData();
    } catch (err) {
      triggerNotification('error', err.message || 'Failed to log deduction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDeduction = async (id) => {
    if (confirm('Are you sure you want to revoke this deduction record?')) {
      try {
        const { error } = await window.supabaseClient.from('deductions').delete().eq('id', id);
        if (error) throw error;
        triggerNotification('success', 'Deduction record removed.');
        fetchData();
      } catch (err) {
        triggerNotification('error', err.message || 'Failed to delete record.');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner and Call to Action */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-display font-bold text-white">Active Deduction Logs</h3>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transform hover:-translate-y-0.5 transition"
        >
          ➕ Assign Violation Points
        </button>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse custom-table">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Reason / Infraction</th>
                <th className="px-6 py-4">Points Docked</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {deductions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-slate-500 text-sm">
                    No violation events logged. Roster is clear!
                  </td>
                </tr>
              ) : (
                deductions.map(ded => {
                  const emp = employees.find(e => e.id === ded.employee_id);
                  return (
                    <tr key={ded.id} className="hover:bg-slate-900/30 transition">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-white block">{emp ? emp.name : 'Unknown Staff'}</span>
                        <span className="text-slate-500 text-[11px]">{emp ? emp.email : ''}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 text-sm">{emp ? emp.department : 'General'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 text-sm">{ded.date}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 text-sm block max-w-xs truncate" title={ded.reason}>
                          {ded.reason}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-0.5 bg-rose-950/60 border border-rose-500/30 text-rose-400 rounded-full text-xs font-bold">
                          -{ded.points_lost} Points
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleDeleteDeduction(ded.id)}
                          className="px-3 py-1.5 bg-transparent hover:bg-rose-950/30 text-rose-500 hover:text-rose-400 rounded-lg text-xs font-bold transition"
                          title="Revoke infraction"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Infraction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-display font-bold text-white">Log Employee Infraction</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmitDeduction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Select Employee</label>
                <select 
                  required
                  value={empId} 
                  onChange={e => setEmpId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Date of Event</label>
                  <input 
                    type="date" 
                    required 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Points Lost</label>
                  <select 
                    value={points} 
                    onChange={e => setPoints(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                  >
                    <option value={1}>1 Point (Rs. 100)</option>
                    <option value={2}>2 Points (Rs. 200)</option>
                    <option value={3}>3 Points (Rs. 300)</option>
                    <option value={5}>5 Points (Rs. 500)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Reason Category</label>
                <select 
                  value={reasonCategory} 
                  onChange={e => setReasonCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                >
                  <option value="Late Login (Over 30 Mins)">Late Login (Over 30 Mins)</option>
                  <option value="Missed Daily Standup">Missed Daily Standup</option>
                  <option value="Delayed Weekly Report Submit">Delayed Weekly Report Submit</option>
                  <option value="Incomplete Task Submission">Incomplete Task Submission</option>
                  <option value="Unprofessional Conduct">Unprofessional Conduct</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Explanation / Notes (Optional)</label>
                <textarea 
                  value={customReason} 
                  onChange={e => setCustomReason(e.target.value)} 
                  placeholder="Provide brief context details"
                  rows="3"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-600/30 transform hover:-translate-y-0.5 transition duration-150 flex items-center gap-2"
                >
                  {submitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : null}
                  Assign Infraction points
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// EMPLOYEE MANAGER PROFILE COMPONENT (ADMIN)
// =========================================================================
function EmployeeManager({ employees, fetchData, triggerNotification, dbMode }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { name, email, department };
      const { error } = await window.supabaseClient.from('employees').insert(payload);
      if (error) throw error;

      triggerNotification('success', `Employee profile for ${name} successfully created.`);
      setName('');
      setEmail('');
      setShowModal(false);
      fetchData();
    } catch (err) {
      triggerNotification('error', err.message || 'Failed to add employee profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id, empName) => {
    if (confirm(`Are you sure you want to delete employee ${empName}? This will cascade delete their attendance and points logs.`)) {
      try {
        const { error } = await window.supabaseClient.from('employees').delete().eq('id', id);
        if (error) throw error;
        triggerNotification('success', `Profile of ${empName} has been deleted.`);
        fetchData();
      } catch (err) {
        triggerNotification('error', err.message || 'Failed to delete employee profile.');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-display font-bold text-white">Registered Employee Profiles</h3>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20 transform hover:-translate-y-0.5 transition"
        >
          ➕ Register New Employee
        </button>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse custom-table">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <th className="px-6 py-4">Employee ID</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-slate-500 text-sm">
                    No employees registered yet. Click the button above to add members.
                  </td>
                </tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-900/30 transition">
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {emp.id}
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">
                      {emp.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {emp.department}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {emp.email}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                        className="px-3 py-1.5 bg-transparent hover:bg-rose-950/30 text-rose-500 hover:text-rose-400 rounded-lg text-xs font-bold transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-display font-bold text-white">Register New Employee Profile</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. Michael Scott"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="e.g. michael@dundermifflin.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1 tracking-wider">Department</label>
                <select 
                  value={department} 
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                  <option value="HR/Admin">HR/Admin</option>
                </select>
              </div>


              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transform hover:-translate-y-0.5 transition duration-150 flex items-center gap-2"
                >
                  {submitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : null}
                  Create Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// PAYROLL REPORT GENERATOR COMPONENT (ADMIN/EMPLOYEE)
// =========================================================================
// ISO Week Helpers for ReportGenerator
function getISOWeekDateRange(weekStr) {
  if (!weekStr) return { start: new Date(), end: new Date() };
  const parts = weekStr.split('-W');
  if (parts.length !== 2) return { start: new Date(), end: new Date() };
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (jan4Day - 1) * 24 * 60 * 60 * 1000);
  const targetMonday = new Date(week1Monday.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
  const targetSunday = new Date(targetMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
  return { start: targetMonday, end: targetSunday };
}

function getISOWeekRangeLabel(weekStr) {
  const { start, end } = getISOWeekDateRange(weekStr);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
}

function getCurrentISOWeek(date = new Date()) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  return `${target.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function formatISOString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ReportGenerator({ user, employees, attendance, deductions, triggerNotification }) {
  const [reportMode, setReportMode] = useState('weekly'); // 'weekly' or 'monthly'
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [filterWeek, setFilterWeek] = useState(getCurrentISOWeek(new Date())); // YYYY-Www

  // Calculate summaries for either all employees (if admin) or just current employee
  const payrollList = useMemo(() => {
    let periodAttendance = [];
    let periodDeductions = [];
    const isMonthly = reportMode === 'monthly';

    if (isMonthly) {
      periodAttendance = attendance.filter(a => a.date.startsWith(filterMonth));
      periodDeductions = deductions.filter(d => d.date.startsWith(filterMonth));
    } else {
      const { start, end } = getISOWeekDateRange(filterWeek);
      const startStr = formatISOString(start);
      const endStr = formatISOString(end);
      periodAttendance = attendance.filter(a => a.date >= startStr && a.date <= endStr);
      periodDeductions = deductions.filter(d => d.date >= startStr && d.date <= endStr);
    }

    const targets = user.is_admin ? employees : employees.filter(e => e.id === user.id);
    
    return targets.map(emp => {
      const stats = computePayrollData(emp.id, periodAttendance, periodDeductions, isMonthly);
      return {
        ...emp,
        ...stats
      };
    });
  }, [employees, attendance, deductions, reportMode, filterMonth, filterWeek, user]);

  const handlePrint = () => {
    window.print();
  };

  // Sum totals of reports
  const summaryTotals = useMemo(() => {
    return payrollList.reduce((totals, item) => ({
      allowances: totals.allowances + item.totalAllowance,
      deductions: totals.deductions + item.totalDeductions,
      reward: totals.reward + (item.reward || 0),
      net: totals.net + item.netPay
    }), { allowances: 0, deductions: 0, reward: 0, net: 0 });
  }, [payrollList]);

  // Formatted date string for printable header
  const reportPeriodLabel = useMemo(() => {
    if (reportMode === 'monthly') {
      return new Date(filterMonth + '-02').toLocaleDateString(undefined, {
        month: 'long', 
        year: 'numeric'
      });
    } else {
      return `Week ${filterWeek} (${getISOWeekRangeLabel(filterWeek)})`;
    }
  }, [reportMode, filterMonth, filterWeek]);

  // Precomposed summary generator
  const getSummaryMessage = (item) => {
    const rewardLine = reportMode === 'monthly'
      ? `\n- Perfect Record Reward: Rs. ${item.reward.toLocaleString()}`
      : '';

    return `Hello ${item.name},

Here is your attendance and payroll summary for the period ${reportPeriodLabel}:

- Days Worked: ${item.daysWorked} Days
- Violation Points Lost: ${item.totalPoints} Pts
- Gross Allowance: Rs. ${item.totalAllowance.toLocaleString()}
- Total Deductions: Rs. ${item.totalDeductions.toLocaleString()}${rewardLine}
- Net Take-Home Payout: Rs. ${item.netPay.toLocaleString()}

If you have any questions, please contact the administration office.

Best regards,
INSK Attendance Team`;
  };

  // Client-side mailto dispatcher
  const handleSendEmail = (item) => {
    const body = getSummaryMessage(item);
    const subject = `INSK Payroll Summary - ${reportPeriodLabel}`;
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(item.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  // Copy to clipboard dispatcher
  const handleCopySummary = (item) => {
    const body = getSummaryMessage(item);
    navigator.clipboard.writeText(body).then(() => {
      if (triggerNotification) {
        triggerNotification('success', `Summary copied to clipboard for ${item.name}!`);
      } else {
        alert(`Summary copied to clipboard for ${item.name}!`);
      }
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Filter and Print Controls */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 no-print">
        
        {/* Toggle Mode Buttons */}
        <div className="flex items-center bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setReportMode('weekly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition duration-200 ${
              reportMode === 'weekly'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weekly Payouts
          </button>
          <button
            onClick={() => setReportMode('monthly')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition duration-200 ${
              reportMode === 'monthly'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly Payouts
          </button>
        </div>

        {/* Date Selector input */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-sm font-semibold text-slate-300">
            Select {reportMode === 'weekly' ? 'Week' : 'Month'}:
          </label>
          {reportMode === 'weekly' ? (
            <input 
              type="week" 
              value={filterWeek} 
              onChange={e => setFilterWeek(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white min-w-[200px]"
            />
          ) : (
            <input 
              type="month" 
              value={filterMonth} 
              onChange={e => setFilterMonth(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white min-w-[200px]"
            />
          )}
        </div>



        <button
          onClick={handlePrint}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 self-start lg:self-center"
        >
          🖨 Print Payroll Ledger
        </button>
      </div>

      {/* Printable Sheet Header (hidden by default, shown during print media) */}
      <div className="hidden print-only text-center border-b pb-4 mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide text-black">Company {reportMode === 'weekly' ? 'Weekly' : 'Monthly'} Payroll Ledger</h2>
        <p className="text-sm text-slate-700 mt-1">Statement Period: {reportPeriodLabel}</p>
        <p className="text-[10px] text-slate-500">Generated on: {new Date().toLocaleString()}</p>
      </div>

      {/* Report Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse custom-table">
            <thead>
              <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400">
                <th className="px-6 py-4">Employee</th>
                {user.is_admin && <th className="px-6 py-4">Department</th>}
                <th className="px-6 py-4 text-center">Days Worked</th>
                <th className="px-6 py-4 text-center">Violation Points</th>
                <th className="px-6 py-4 text-right">Gross Allowance</th>
                <th className="px-6 py-4 text-right">Deductions</th>
                {reportMode === 'monthly' && <th className="px-6 py-4 text-right">Perfect Reward</th>}
                <th className="px-6 py-4 text-right">Net Take-Home Payout</th>
                {user.is_admin && <th className="px-6 py-4 text-center no-print">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {payrollList.length === 0 ? (
                <tr>
                  <td colSpan={user.is_admin ? (reportMode === 'monthly' ? 9 : 8) : (reportMode === 'monthly' ? 7 : 6)} className="px-6 py-10 text-center text-slate-500 text-sm">
                    No payroll details logged for this period.
                  </td>
                </tr>
              ) : (
                payrollList.map(item => (
                  <tr key={item.id} className="hover:bg-slate-900/30 transition">
                    <td className="px-6 py-4">
                      <span className="font-semibold text-white block print:text-black">{item.name}</span>
                      <span className="text-slate-500 text-[11px] print:text-slate-600">{item.email}</span>
                    </td>
                    {user.is_admin && (
                      <td className="px-6 py-4">
                        <span className="text-slate-300 text-sm print:text-black">{item.department}</span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className="text-slate-300 text-sm font-semibold print:text-black">{item.daysWorked} Days</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        item.totalPoints > 2 
                          ? 'bg-rose-950/40 text-rose-400 print:text-rose-700' 
                          : 'bg-slate-900 text-slate-400 print:text-slate-700'
                      }`}>
                        {item.totalPoints} Pts
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-300 print:text-black">
                      Rs. {item.totalAllowance.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-rose-400 print:text-rose-700">
                      -Rs. {item.totalDeductions.toLocaleString()}
                    </td>
                    {reportMode === 'monthly' && (
                      <td className="px-6 py-4 text-right font-mono text-sm text-emerald-400 print:text-emerald-700">
                        {item.reward > 0 ? `+Rs. ${item.reward.toLocaleString()}` : 'Rs. 0'}
                      </td>
                    )}
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-emerald-400 print:text-emerald-700">
                      Rs. {item.netPay.toLocaleString()}
                    </td>
                    {user.is_admin && (
                      <td className="px-6 py-4 text-center no-print">
                        <div className="flex items-center justify-center gap-1.5 mx-auto">
                          <button
                            onClick={() => handleSendEmail(item)}
                            className="p-2 bg-indigo-600/20 hover:bg-indigo-600/35 border border-indigo-500/30 text-indigo-300 hover:text-white rounded-lg text-xs transition-all duration-150"
                            title="Email Summary"
                          >
                            ✉️
                          </button>
                          <button
                            onClick={() => handleCopySummary(item)}
                            className="p-2 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs transition-all duration-150"
                            title="Copy Summary to Clipboard"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {payrollList.length > 0 && (
              <tfoot>
                <tr className="bg-slate-950/40 font-bold border-t-2 border-slate-800 text-white print:text-black print:border-black">
                  <td colSpan={user.is_admin ? 4 : 3} className="px-6 py-4 text-left uppercase tracking-wide text-xs text-slate-400 print:text-black">
                    Payroll Ledger Totals
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm">
                    Rs. {summaryTotals.allowances.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-sm text-rose-400 print:text-rose-700">
                    -Rs. {summaryTotals.deductions.toLocaleString()}
                  </td>
                  {reportMode === 'monthly' && (
                    <td className="px-6 py-4 text-right font-mono text-sm text-emerald-400 print:text-emerald-700">
                      Rs. {summaryTotals.reward.toLocaleString()}
                    </td>
                  )}
                  <td className="px-6 py-4 text-right font-mono text-sm text-emerald-400 print:text-emerald-700">
                    Rs. {summaryTotals.net.toLocaleString()}
                  </td>
                  {user.is_admin && <td className="no-print"></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// Global Mount Hook
const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
