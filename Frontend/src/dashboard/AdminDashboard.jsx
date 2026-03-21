import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserShield, FaStore, FaTruck, FaUsers, FaExclamationCircle, FaSignOutAlt, FaChartPie, FaTrash, FaCheckCircle } from 'react-icons/fa';

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

  useEffect(() => {
    fetchStats();
    fetchShops();
    fetchSuppliers();
  }, []);

  const getToken = () => localStorage.getItem('token');

  const fetchStats = async () => {
    const token = getToken();
    if (!token) return navigate('/login');
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/admin/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setStats(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchShops = async () => {
    const token = getToken();
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/admin/shops', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setShops(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchSuppliers = async () => {
    const token = getToken();
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/admin/suppliers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSuppliers(await res.json());
    } catch (err) { console.error(err); }
  };

  const handleDeleteShop = async (id) => {
    if(!window.confirm("Delete this shop? This will delete all its products too.")) return;
    const token = getToken();
    try {
      // Using POST for delete to avoid CORS issues
      const res = await fetch(`/api/admin/shops/${id}`, {
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
      const res = await fetch(`/api/admin/suppliers/${id}`, {
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
          <button onClick={() => setActiveTab('shops')} className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors ${activeTab === 'shops' ? 'bg-gray-800 text-white border-r-4 border-blue-500' : 'text-gray-400 hover:bg-gray-800'}`}>
            <FaStore className="text-lg" />
            <span className="font-medium">Manage Shops</span>
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
            {activeTab === 'shops' && 'Manage Registered Shops'}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard title="Registered Shops" value={stats.total_shops} icon={FaStore} color="bg-blue-500" />
                    <StatCard title="Active Suppliers" value={stats.total_suppliers} icon={FaTruck} color="bg-green-500" />
                    <StatCard title="Total Users" value={stats.total_users} icon={FaUsers} color="bg-purple-500" />
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

          {activeTab === 'shops' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {shops.map(shop => (
                              <tr key={shop.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{shop.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shop.name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{shop.owner}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{shop.email}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button onClick={() => handleDeleteShop(shop.id)} className="text-red-600 hover:text-red-900 flex items-center space-x-1">
                                          <FaTrash /> <span>Delete</span>
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {shops.length === 0 && (
                              <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">No shops found</td></tr>
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
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact Person</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                          {suppliers.map(sup => (
                              <tr key={sup.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{sup.id}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sup.name}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sup.contact}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sup.email}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button onClick={() => handleDeleteSupplier(sup.id)} className="text-red-600 hover:text-red-900 flex items-center space-x-1">
                                          <FaTrash /> <span>Delete</span>
                                      </button>
                                  </td>
                              </tr>
                          ))}
                          {suppliers.length === 0 && (
                              <tr><td colSpan="5" className="px-6 py-4 text-center text-gray-500">No suppliers found</td></tr>
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
