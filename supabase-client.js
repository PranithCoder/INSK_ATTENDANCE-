// supabase-client.js - Dual-Mode Supabase Database & Auth Client Adapter

(function (window) {
  // Default Config
  const CONFIG_KEYS = {
    URL: 'insk_supabase_url',
    KEY: 'insk_supabase_key'
  };

  // Pre-populated Mock Data
  const DEFAULT_ADMINS = [
    { email: 'admin@company.com' }
  ];

  const DEFAULT_EMPLOYEES = [
    { id: 'emp-1', name: 'John Doe', department: 'Engineering', email: 'john.doe@company.com' },
    { id: 'emp-2', name: 'Jane Smith', department: 'Sales', email: 'jane.smith@company.com' },
    { id: 'emp-3', name: 'Alex Jones', department: 'Marketing', email: 'alex.jones@company.com' },
    { id: 'emp-4', name: 'Sarah Connor', department: 'Operations', email: 'sarah.connor@company.com' }
  ];

  // Helper to generate dates for past 10 days
  const generatePastAttendance = () => {
    const records = [];
    const statuses = ['Present', 'Present', 'Present', 'Present', 'Present', 'Absent', 'Present']; // Weighted present
    const employees = ['emp-1', 'emp-2', 'emp-3', 'emp-4'];
    
    // Past 10 days
    for (let i = 0; i < 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      // Format as YYYY-MM-DD
      const dateStr = d.toISOString().split('T')[0];
      
      // Skip weekends for mock records
      const day = d.getDay();
      if (day === 0 || day === 6) continue;

      employees.forEach(empId => {
        // Random status
        const randIndex = Math.floor(Math.random() * statuses.length);
        records.push({
          id: `att-${empId}-${dateStr}`,
          employee_id: empId,
          date: dateStr,
          status: statuses[randIndex]
        });
      });
    }
    return records;
  };

  const DEFAULT_ATTENDANCE = generatePastAttendance();

  const DEFAULT_DEDUCTIONS = [
    { id: 'ded-1', employee_id: 'emp-1', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], reason: 'Late Login (Over 30 Mins)', points_lost: 1 },
    { id: 'ded-2', employee_id: 'emp-3', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], reason: 'Missed Daily Standup', points_lost: 2 },
    { id: 'ded-3', employee_id: 'emp-2', date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], reason: 'Delayed Status Report Submit', points_lost: 1 }
  ];

  // Initialize Local Storage Databases if they do not exist
  const initLocalStorageDb = () => {
    if (!localStorage.getItem('db_admins')) {
      localStorage.setItem('db_admins', JSON.stringify(DEFAULT_ADMINS));
    }
    if (!localStorage.getItem('db_employees')) {
      localStorage.setItem('db_employees', JSON.stringify(DEFAULT_EMPLOYEES));
    }
    if (!localStorage.getItem('db_attendance')) {
      localStorage.setItem('db_attendance', JSON.stringify(DEFAULT_ATTENDANCE));
    }
    if (!localStorage.getItem('db_deductions')) {
      localStorage.setItem('db_deductions', JSON.stringify(DEFAULT_DEDUCTIONS));
    }
    if (!localStorage.getItem('db_auth_users')) {
      // Mock Auth credentials lookup
      const authUsers = {
        'admin@company.com': { password: 'admin123', id: 'admin-user', email: 'admin@company.com', is_admin: true },
        'john.doe@company.com': { password: 'password123', id: 'emp-1', email: 'john.doe@company.com', is_admin: false },
        'jane.smith@company.com': { password: 'password123', id: 'emp-2', email: 'jane.smith@company.com', is_admin: false },
        'alex.jones@company.com': { password: 'password123', id: 'emp-3', email: 'alex.jones@company.com', is_admin: false },
        'sarah.connor@company.com': { password: 'password123', id: 'emp-4', email: 'sarah.connor@company.com', is_admin: false },
      };
      localStorage.setItem('db_auth_users', JSON.stringify(authUsers));
    }
  };

  initLocalStorageDb();

  // Local Storage Database Operations API
  const db = {
    get: (table) => JSON.parse(localStorage.getItem(`db_${table}`) || '[]'),
    set: (table, data) => localStorage.setItem(`db_${table}`, JSON.stringify(data)),
    getUser: () => JSON.parse(localStorage.getItem('db_session_user') || 'null'),
    setUser: (user) => localStorage.setItem('db_session_user', JSON.stringify(user)),
    getAuthUsers: () => JSON.parse(localStorage.getItem('db_auth_users') || '{}'),
    setAuthUsers: (users) => localStorage.setItem('db_auth_users', JSON.stringify(users)),
  };

  // Mock Supabase Query Builder
  class MockQueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.data = db.get(tableName);
    }

    select(columns = '*') {
      // Basic implementation: returns this builder. In mock, we resolve at the end or filter.
      return this;
    }

    insert(records) {
      const recordsArray = Array.isArray(records) ? records : [records];
      const current = db.get(this.tableName);
      
      const newRecords = recordsArray.map(r => {
        const id = r.id || `${this.tableName.substring(0, 3)}-${Math.random().toString(36).substr(2, 9)}`;
        return { id, ...r, created_at: new Date().toISOString() };
      });

      const updated = [...current, ...newRecords];
      db.set(this.tableName, updated);
      this.data = updated;

      // Handle employee insertion syncing with auth list
      if (this.tableName === 'employees') {
        const authUsers = db.getAuthUsers();
        newRecords.forEach(emp => {
          if (!authUsers[emp.email]) {
            authUsers[emp.email] = {
              password: 'password123', // Default password
              id: emp.id,
              email: emp.email,
              is_admin: false
            };
          }
        });
        db.setAuthUsers(authUsers);
      }

      return Promise.resolve({ data: newRecords, error: null });
    }

    upsert(records) {
      const recordsArray = Array.isArray(records) ? records : [records];
      const current = db.get(this.tableName);

      const insertedOrUpdated = [];
      
      recordsArray.forEach(record => {
        let matchIndex = -1;
        
        // Handle compound keys or IDs
        if (this.tableName === 'attendance') {
          matchIndex = current.findIndex(r => r.employee_id === record.employee_id && r.date === record.date);
        } else if (record.id) {
          matchIndex = current.findIndex(r => r.id === record.id);
        }

        if (matchIndex > -1) {
          current[matchIndex] = { ...current[matchIndex], ...record };
          insertedOrUpdated.push(current[matchIndex]);
        } else {
          const id = record.id || `${this.tableName.substring(0, 3)}-${Math.random().toString(36).substr(2, 9)}`;
          const newRec = { id, ...record, created_at: new Date().toISOString() };
          current.push(newRec);
          insertedOrUpdated.push(newRec);
        }
      });

      db.set(this.tableName, current);
      this.data = current;
      return Promise.resolve({ data: insertedOrUpdated, error: null });
    }

    delete() {
      // Returns a filter builder that deletes
      return {
        eq: (col, val) => {
          const current = db.get(this.tableName);
          const filtered = current.filter(item => item[col] !== val);
          db.set(this.tableName, filtered);
          return Promise.resolve({ error: null });
        }
      };
    }

    update(values) {
      return {
        eq: (col, val) => {
          const current = db.get(this.tableName);
          const updated = current.map(item => {
            if (item[col] === val) {
              return { ...item, ...values };
            }
            return item;
          });
          db.set(this.tableName, updated);
          return Promise.resolve({ data: updated.filter(item => item[col] === val), error: null });
        }
      };
    }

    // Filters (Simplistic chain resolution)
    eq(column, value) {
      this.data = this.data.filter(row => row[column] === value);
      return this;
    }

    in(column, valuesArray) {
      this.data = this.data.filter(row => valuesArray.includes(row[column]));
      return this;
    }

    order(column, { ascending = true } = {}) {
      this.data.sort((a, b) => {
        if (a[column] < b[column]) return ascending ? -1 : 1;
        if (a[column] > b[column]) return ascending ? 1 : -1;
        return 0;
      });
      return this;
    }

    // Resolver
    then(onfulfilled) {
      return Promise.resolve({ data: this.data, error: null }).then(onfulfilled);
    }
  }

  // Create Mock Client Interface
  const createMockClient = () => {
    return {
      isMock: true,
      auth: {
        signUp: ({ email, password, options }) => {
          const authUsers = db.getAuthUsers();
          if (authUsers[email]) {
            return Promise.resolve({ data: null, error: { message: 'User already exists.' } });
          }

          const userId = `emp-${Math.random().toString(36).substr(2, 9)}`;
          authUsers[email] = {
            password: password,
            id: userId,
            email: email,
            is_admin: false
          };
          db.setAuthUsers(authUsers);

          // Add to employees profile
          const meta = options?.data || {};
          const employees = db.get('employees');
          employees.push({
            id: userId,
            name: meta.name || email.split('@')[0],
            department: meta.department || 'General',
            email: email
          });
          db.set('employees', employees);

          const sessionUser = {
            id: userId,
            email: email,
            user_metadata: {
              name: meta.name || email.split('@')[0],
              department: meta.department || 'General'
            },
            is_admin: false
          };
          db.setUser(sessionUser);

          return Promise.resolve({ data: { user: sessionUser, session: {} }, error: null });
        },

        signInWithPassword: ({ email, password }) => {
          const authUsers = db.getAuthUsers();
          const userObj = authUsers[email];
          
          if (!userObj || userObj.password !== password) {
            return Promise.resolve({ data: null, error: { message: 'Invalid credentials.' } });
          }

          // Check if admin
          const admins = db.get('admins');
          const isAdmin = admins.some(a => a.email.toLowerCase() === email.toLowerCase());

          // Get profile metadata
          const employees = db.get('employees');
          const profile = employees.find(e => e.id === userObj.id) || {};

          const sessionUser = {
            id: userObj.id,
            email: userObj.email,
            user_metadata: {
              name: profile.name || email.split('@')[0],
              department: profile.department || 'Management'
            },
            is_admin: isAdmin || userObj.is_admin
          };
          
          db.setUser(sessionUser);
          // Trigger a storage event to sync other tabs if needed
          window.dispatchEvent(new Event('auth_change'));

          return Promise.resolve({ data: { user: sessionUser, session: { access_token: 'mock-jwt-token' } }, error: null });
        },

        signOut: () => {
          db.setUser(null);
          window.dispatchEvent(new Event('auth_change'));
          return Promise.resolve({ error: null });
        },

        getUser: () => {
          const user = db.getUser();
          return Promise.resolve({ data: { user }, error: null });
        },

        onAuthStateChange: (callback) => {
          const handleAuth = () => {
            const user = db.getUser();
            callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
          };
          window.addEventListener('auth_change', handleAuth);
          // Initial trigger
          setTimeout(handleAuth, 50);
          return {
            data: {
              subscription: {
                unsubscribe: () => window.removeEventListener('auth_change', handleAuth)
              }
            }
          };
        }
      },

      from: (tableName) => {
        return new MockQueryBuilder(tableName);
      },

      // Database Management Helpers
      admins: {
        add: (email) => {
          const current = db.get('admins');
          if (current.some(a => a.email.toLowerCase() === email.toLowerCase())) return;
          current.push({ email: email.toLowerCase() });
          db.set('admins', current);
        },
        remove: (email) => {
          const current = db.get('admins');
          db.set('admins', current.filter(a => a.email.toLowerCase() !== email.toLowerCase()));
        }
      },

      resetDatabase: () => {
        localStorage.removeItem('db_admins');
        localStorage.removeItem('db_employees');
        localStorage.removeItem('db_attendance');
        localStorage.removeItem('db_deductions');
        localStorage.removeItem('db_auth_users');
        initLocalStorageDb();
        window.dispatchEvent(new Event('auth_change'));
      }
    };
  };

  // Live client instantiation check
  const getClient = () => {
    const savedUrl = localStorage.getItem(CONFIG_KEYS.URL);
    const savedKey = localStorage.getItem(CONFIG_KEYS.KEY);

    if (savedUrl && savedKey && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        const client = window.supabase.createClient(savedUrl, savedKey);
        client.isMock = false;
        // Enrich client auth screen helpers
        client.resetDatabase = () => {
          console.warn('Cannot reset database in live Supabase mode.');
        };
        return client;
      } catch (err) {
        console.error('Failed to initialize live Supabase client, falling back to mock.', err);
      }
    }
    
    // Return standard mock client
    return createMockClient();
  };

  // Export client details
  window.DB_KEYS = CONFIG_KEYS;
  window.supabaseClient = getClient();
  
  // Method to re-initialize connection after credential saves
  window.reconnectSupabase = () => {
    window.supabaseClient = getClient();
    window.dispatchEvent(new Event('supabase_reconnect'));
  };

})(window);
