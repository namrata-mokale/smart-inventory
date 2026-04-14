import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserShield, FaStore, FaTruck, FaUsers, FaExclamationCircle, FaSignOutAlt, FaChartPie, FaTrash, FaCheckCircle } from 'react-icons/fa';
import { API_BASE_URL } from '../config';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    total_users: 0,
    total_shops: 0,
    total_suppliers: 0,
    total_products: 0,
    low_stock_alerts: 0
  });
  
  const [shops, setShops] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchShops();
    fetchSuppliers();
    fetchUsers();
    fetchCustomers();
    fetchSalesmen();
  }, []);

  const getToken = () => localStorage.getItem('token');

  const fetchStats = async () => {
    const token = getToken();
    if (!token) return navigate('/login');
    try {
      const res = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchShops = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/shops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setShops(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchSuppliers = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSuppliers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchCustomers = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCustomers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchSalesmen = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/salesmen`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSalesmen(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleDeleteShop = async (id) => {
    if(!window.confirm("Delete this shop? This will delete all its products too.")) return;
    const token = getToken();
    try {
      // Using POST for delete to avoid CORS issues
      const res = await fetch(`${API_BASE_URL}/admin/shops/${id}`, {
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Shop Deleted");
        fetchShops();
        fetchStats();
      } else {
        alert("Failed to delete shop");
      }
    } catch (err) { console.error(err); }
  };

  const handleDeleteSupplier = async (id) => {
    if(!window.confirm("Delete this supplier?")) return;
    const token = getToken();
    try {
      // Using POST for delete
      const res = await fetch(`${API_BASE_URL}/admin/suppliers/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Supplier Deleted");
        fetchSuppliers();
        fetchStats();
      } else {
        alert("Failed to delete supplier");
      }
    } catch (err) { console.error(err); }
  };

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
      </div>
      <div className={`p-4 rounded-full ${color} bg-opacity-10`}>
        <Icon className={`text-2xl ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-72 bg-gray-900 text-white shadow-xl flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <FaUserShield className="text-blue-400" />
            <span>AdminPanel</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">System Administration</p>
        </div>
        
        <nav className="flex-1 mt-6">
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors ${activeTab === 'overview' ? 'bg-gray-800 text-white border-r-4 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>
            <FaChartPie className="text-lg" />
            <span className="font-medium">Overview</span>
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors ${activeTab === 'users' ? 'bg-gray-800 text-white border-r-4 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>
            <FaUsers className="text-lg" />
            <span className="font-medium">Registered Accounts</span>
          </button>
          <button onClick={() => setActiveTab('shops')} className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors ${activeTab === 'shops' ? 'bg-gray-800 text-white border-r-4 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>
            <FaStore className="text-lg" />
            <span className="font-medium">Manage Shops</span>
          </button>
          <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors ${activeTab === 'customers' ? 'bg-gray-800 text-white border-r-4 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>
            <FaUsers className="text-lg text-purple-400" />
            <span className="font-medium">Linked Customers</span>
          </button>
          <button onClick={() => setActiveTab('salesmen')} className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors ${activeTab === 'salesmen' ? 'bg-gray-800 text-white border-r-4 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>
            <FaUsers className="text-lg text-green-400" />
            <span className="font-medium">Shop Salesmen</span>
          </button>
          <button onClick={() => setActiveTab('suppliers')} className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors ${activeTab === 'suppliers' ? 'bg-gray-800 text-white border-r-4 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>
            <FaTruck className="text-lg" />
            <span className="font-medium">Manage Suppliers</span>
          </button>
        </nav>

        <div className="p-6 border-t border-gray-800">
          <button 
            onClick={() => { localStorage.clear(); navigate('/login'); }}
            className="flex items-center space-x-3 text-red-400 hover:text-red-300 transition-colors w-full"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            {activeTab === 'overview' && 'Dashboard Overview'}
            {activeTab === 'users' && 'Manage Registered Accounts'}
            {activeTab === 'shops' && 'Manage Registered Shops'}
            {activeTab === 'customers' && 'Linked Customers & Shops'}
            {activeTab === 'salesmen' && 'Manage Shop Salesmen'}
            {activeTab === 'suppliers' && 'Manage Suppliers'}
          </h2>
          <div className="flex items-center space-x-4">
             <div className="text-right">
                <p className="text-sm font-medium text-gray-900">System Admin</p>
                <p className="text-xs text-gray-500">Super User</p>
             </div>
             <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">
                AD
             </div>
          </div>
        </header>

        <main className="p-8">
          {activeTab === 'overview' && (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <StatCard title="Registered Accounts" value={stats.total_users} icon={FaUserShield} color="bg-indigo-500" />
                    <StatCard title="Total Shops" value={stats.total_shops} icon={FaStore} color="bg-blue-500" />
                    <StatCard title="Total Customers" value={stats.total_customers} icon={FaUsers} color="bg-purple-500" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard title="Total Salesmen" value={stats.total_salesmen} icon={FaUsers} color="bg-green-500" />
                    <StatCard title="Active Suppliers" value={stats.total_suppliers} icon={FaTruck} color="bg-teal-500" />
                    <StatCard title="System Alerts" value={stats.low_stock_alerts} icon={FaExclamationCircle} color="bg-red-500" />
                </div>
                <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-4">System Health & Status</h3>
                    <div className="flex items-center space-x-2 text-green-600">
                        <FaCheckCircle />
                        <span>All systems operational. Database connection stable.</span>
                    </div>
                </div>
            </>
          )}

          {activeTab === 'users' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {users.map(user => (
                              <tr key={user.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{user.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone || 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                          ${user.role === 'admin' ? 'bg-red-100 text-red-800' : 
                                            user.role === 'shop_owner' ? 'bg-blue-100 text-blue-800' : 
                                            user.role === 'supplier' ? 'bg-green-100 text-green-800' : 
                                            'bg-purple-100 text-purple-800'}`}>
                                        {user.role}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.created_at}</td>
                              </tr>
                          ))}
                          {users.length === 0 && (
                              <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">No users found</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}

          {activeTab === 'shops' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop Name & Location</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner Details</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stats</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {shops.map(shop => (
                              <tr key={shop.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{shop.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{shop.name}</div>
                                    <div className="text-xs text-gray-500">{shop.location || 'No location'}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{shop.owner}</div>
                                    <div className="text-xs text-gray-500">{shop.email}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div><span className="font-semibold text-gray-700">{shop.customers_count}</span> Customers</div>
                                    <div><span className="font-semibold text-gray-700">{shop.salesmen_count}</span> Salesmen</div>
                                    <div><span className="font-semibold text-gray-700">{shop.suppliers_count}</span> Suppliers</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{shop.created_at}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button onClick={() => handleDeleteShop(shop.id)} className="text-red-600 hover:text-red-900 flex items-center space-x-1 bg-red-50 px-3 py-1 rounded-md">
                                          <FaTrash /> <span>Delete</span>
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {shops.length === 0 && (
                              <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">No shops found</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}

          {activeTab === 'customers' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registered Account?</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Shops</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {customers.map(c => (
                              <tr key={c.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{c.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                                    <div className="text-xs text-gray-500">{c.phone} | {c.email || 'No email'}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {c.registered_account !== "No" ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Yes: {c.registered_account}</span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">No (Offline Only)</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-500">
                                    <div className="flex flex-wrap gap-1">
                                        {c.linked_shops.map((shopName, idx) => (
                                            <span key={idx} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded border border-blue-100">{shopName}</span>
                                        ))}
                                        {c.linked_shops.length === 0 && <span className="text-gray-400 italic">No linked shops</span>}
                                    </div>
                                  </td>
                              </tr>
                          ))}
                          {customers.length === 0 && (
                              <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No customers found</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}

          {activeTab === 'salesmen' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salesman Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Shop</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {salesmen.map(s => (
                              <tr key={s.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{s.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div>{s.phone}</div>
                                    <div className="text-xs text-gray-400">{s.email}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                                    {s.shop}
                                  </td>
                              </tr>
                          ))}
                          {salesmen.length === 0 && (
                              <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No salesmen found</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}

          {activeTab === 'suppliers' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Details</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplying To Shops</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {suppliers.map(sup => (
                              <tr key={sup.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{sup.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{sup.name}</div>
                                    <div className="text-xs text-gray-500">{sup.contact} | {sup.email}</div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-500">
                                    <div className="flex flex-wrap gap-1">
                                        {sup.linked_shops.map((shopName, idx) => (
                                            <span key={idx} className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded border border-green-100">{shopName}</span>
                                        ))}
                                        {sup.linked_shops.length === 0 && <span className="text-gray-400 italic">No linked shops yet</span>}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button onClick={() => handleDeleteSupplier(sup.id)} className="text-red-600 hover:text-red-900 flex items-center space-x-1 bg-red-50 px-3 py-1 rounded-md">
                                          <FaTrash /> <span>Delete</span>
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {suppliers.length === 0 && (
                              <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No suppliers found</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
