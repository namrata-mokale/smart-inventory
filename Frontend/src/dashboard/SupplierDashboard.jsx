import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTruck, FaBoxOpen, FaClipboardList, FaSignOutAlt, FaCheckCircle, FaShippingFast, FaClock, FaExclamationTriangle, FaBell, FaPlusCircle } from 'react-icons/fa';
import { API_BASE_URL } from '../config';

const SupplierDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('requests');
  const [linkedShops, setLinkedShops] = useState([]);
  const [bills, setBills] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [quoteInputs, setQuoteInputs] = useState({});
 
  const [catalog, setCatalog] = useState([]);
  const [newItem, setNewItem] = useState({ 
    sku: '', name: '', category: 'General', base_price: '', expiry_date: '', shelf_life_days: '', discount_percent: '',
    variations: [{ unit_type: 'litres', unit_value: '', base_price: '' }]
  });
  
  // Modal State (NOT USED ANYMORE - Simplified Flow)
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [expiryDate, setExpiryDate] = useState('');

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) navigate('/login');
    fetchRequests();
    fetchCatalog();
    fetchLinkedShops();
    fetchBills();
  }, []);

  const fetchRequests = async () => {
    try {
      console.log("DEBUG: Fetching supplier requests...");
      const res = await fetch(`${API_BASE_URL}/supplier/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("DEBUG: Requests received:", data);
        setRequests(data);
      } else {
        const err = await res.json();
        console.error("Backend Error:", err);
        // Alert the user if the backend crashed
        if (res.status === 500) {
          alert(`Backend Error: ${err.message || 'The server encountered an error while fetching requests.'}`);
        }
      }
    } catch (err) {
      console.error("DEBUG: Fetch error:", err);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/supplier/catalog`, { 
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCatalog(await res.json());
    } catch (e) {}
  };

  const fetchLinkedShops = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/supplier/linked-shops`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) setLinkedShops(await res.json());
    } catch (e) {}
  };

  const fetchBills = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/billing/supplier`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) setBills(await res.json());
    } catch (e) {}
  };

  const handleAddToCatalogFromRequest = (productName, sku) => {
    setNewItem({
      ...newItem,
      name: productName,
      sku: sku || ''
    });
    setActiveTab('products');
    // Smooth scroll to top to see the form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddCatalog = async (e) => {
    e.preventDefault();
    try {
      // Validate Variations
      const validVariations = newItem.variations.length > 0 && newItem.variations.every(v => 
        v.unit_value !== '' && !Number.isNaN(parseFloat(v.unit_value)) && 
        v.base_price !== '' && !Number.isNaN(parseFloat(v.base_price))
      );

      if (!validVariations) {
          alert('Please fill all Unit Variation fields (Value and Price).');
          return;
      }

      const body = {
        ...newItem,
        base_price: parseFloat(newItem.base_price || (newItem.variations[0]?.base_price) || '0'),
        shelf_life_days: newItem.shelf_life_days ? parseInt(newItem.shelf_life_days) : null,
        discount_percent: parseFloat(newItem.discount_percent || '0'),
        variations: newItem.variations
      };
      const res = await fetch(`${API_BASE_URL}/supplier/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      
      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await res.json();
      } else {
          const text = await res.text();
          data = { message: text };
      }

      if (res.ok) {
        alert('Catalog item added');
        setNewItem({ 
          sku: '', name: '', category: 'General', base_price: '', expiry_date: '', shelf_life_days: '', discount_percent: '',
          variations: [{ unit_type: 'litres', unit_value: '', base_price: '' }]
        });
        fetchCatalog();
      } else {
        alert('Error: ' + (data.message || 'Failed to add item'));
      }
    } catch (e) {
      alert('Request Error: ' + e.message);
    }
  };

  const openDeliveryModal = (id) => {
      setSelectedRequestId(id);
      setExpiryDate('');
      setShowDeliveryModal(true);
  };
  const submitQuote = async (reqId) => {
      const qi = quoteInputs[reqId] || {};
      const discount_percent = parseFloat(qi.discount_percent || '0');
      const expiry_date = qi.expiry_date || ''; // New field for batch expiry
      
      try {
          const res = await fetch(`${API_BASE_URL}/supplier/requests/${reqId}/quote`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ discount_percent, expiry_date })
          });
          const data = await res.json();
          if (res.ok) {
              alert('Quote submitted with batch expiry date');
              setQuoteInputs({ ...quoteInputs, [reqId]: {} });
              fetchRequests();
          } else {
              alert(data.message || 'Failed to submit quote');
          }
      } catch (e) { alert('Network error'); }
  };

  const getGstRate = (name, category) => {
    if (!name) return 0.18;
    const n = name.toLowerCase().trim();
    const c = (category || "").toLowerCase().trim();

    const exempt = ["milk", "curd", "lassi", "paneer", "vegetable", "fruit", "pulse", "wheat flour", "atta", "rice", "salt", "honey", "roti", "naan", "khakhra", "chapati", "papad", "besan", "stamp", "postal", "book", "newspaper", "bangle", "earthenware", "sanitary napkin"];
    const reduced = ["butter", "ghee", "cheese", "paneer", "namkeen", "bhujia", "jam", "jelly", "pasta", "cornflake", "oil", "shampoo", "soap", "toothpaste", "toothbrush", "detergent", "tableware", "kitchenware", "sewing machine"];

    // User said: branded/packaged versions might have GST while fresh/unlabeled don't.
    // Heuristic: if name contains 'branded', 'packaged', or 'processed', it's NOT exempt.
    const isBranded = n.includes("branded") || n.includes("packaged") || n.includes("processed");

    if (!isBranded) {
      if (exempt.some(item => n.includes(item) || c.includes(item))) {
        // Exception: branded paneer is 5%
        if (n.includes("paneer") && isBranded) return 0.05;
        return 0;
      }
    }

    if (reduced.some(item => n.includes(item) || c.includes(item))) return 0.05;
    return 0.18;
  };

  const confirmDelivery = async () => {
      let body = { status: 'Delivered' };
      
      // If a new expiry date was manually entered in the modal, use it
      if (expiryDate) {
          body.expiry_date = expiryDate;
      }

      try {
          const res = await fetch(`${API_BASE_URL}/supplier/requests/${selectedRequestId}/update`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify(body)
          });
          if (res.ok) {
              alert(`Request marked as Delivered`);
              setShowDeliveryModal(false);
              fetchRequests();
          } else {
              const errorData = await res.json();
              alert(errorData.message || 'Failed to update status');
          }
      } catch (e) {
          alert('Error updating status');
      }
  };

  const handleUpdateStatus = async (id, status) => {
      if (status === 'Delivered') {
          // ALWAYS mark as Delivered immediately without any modal or extra expiry date input
          try {
              const res = await fetch(`${API_BASE_URL}/supplier/requests/${id}/update`, {
                  method: 'POST',
                  headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}` 
                  },
                  body: JSON.stringify({ status: 'Delivered' })
              });
              if (res.ok) {
                  alert(`Request marked as Delivered`);
                  fetchRequests(); 
              } else {
                  const errorData = await res.json();
                  alert(errorData.message || 'Failed to update status');
              }
          } catch (e) {
              alert('Error updating status');
          }
          return;
      }

      try {
          const res = await fetch(`${API_BASE_URL}/supplier/requests/${id}/update`, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}` 
              },
              body: JSON.stringify({ status })
          });
          if (res.ok) {
              alert(`Request marked as ${status}`);
              fetchRequests(); 
          }
      } catch (e) {
          alert('Error updating status');
      }
  };

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(id)} 
      className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors duration-200 ${
        activeTab === id 
          ? 'bg-green-700 text-white border-r-4 border-white' 
          : 'text-green-100 hover:bg-green-700'
      }`}
    >
      <Icon className="text-lg" />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans relative">
      {/* Sidebar */}
      <div className="w-72 bg-green-800 text-white shadow-xl flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <FaTruck className="text-green-300" />
            <span>SupplierHub</span>
          </h1>
          <p className="text-green-300 text-sm mt-1">Order Fulfillment</p>
        </div>
        
        <nav className="flex-1 mt-6">
          <SidebarItem id="requests" icon={FaClipboardList} label="Incoming Orders" />
          <SidebarItem id="orders" icon={FaCheckCircle} label="My Orders" />
          <SidebarItem id="products" icon={FaBoxOpen} label="My Catalog" />
          <SidebarItem id="bills" icon={FaBell} label="Bills" />
        </nav>

        <div className="p-6 border-t border-green-700">
          <button 
            onClick={() => { localStorage.clear(); navigate('/login'); }}
            className="flex items-center space-x-3 text-green-200 hover:text-white transition-colors w-full"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white shadow-sm px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            {activeTab === 'requests' && 'Incoming Orders & Alerts'}
            {activeTab === 'orders' && 'Fulfilled Orders'}
            {activeTab === 'products' && 'Product Catalog'}
            {activeTab === 'bills' && 'Bills & Invoices'}
          </h2>
          <div className="flex items-center space-x-4">
             <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Supplier Admin</p>
                <p className="text-xs text-gray-500">Logistics</p>
             </div>
             <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold">
                SA
             </div>
          </div>
        </header>

        <main className="p-8">
            {activeTab === 'requests' && (
                <>
                    {/* FAILED DELIVERY ALERTS */}
                    {bills.filter(b => b.status === 'Failed').length > 0 && (
                        <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
                            {bills.filter(b => b.status === 'Failed').map(bill => (
                                <div key={bill.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm mb-3 flex items-center">
                                    <FaExclamationTriangle className="text-red-500 mr-3 text-xl" />
                                    <div>
                                        <p className="text-red-800 font-bold text-sm">Payment Denied / Overdue: {bill.product}</p>
                                        <p className="text-red-600 text-xs">Shop: {bill.shop}. Order has been cancelled and stock reversed.</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                

                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium uppercase">Pending</p>
                                <p className="text-2xl font-bold text-gray-800">{requests.filter(r => r.status === 'Pending').length}</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-lg text-yellow-600"><FaClock /></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium uppercase">Shipped</p>
                                <p className="text-2xl font-bold text-gray-800">{requests.filter(r => r.status === 'Shipped').length}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><FaShippingFast /></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                            <div>
                                <p className="text-gray-500 text-sm font-medium uppercase">Delivered</p>
                                <p className="text-2xl font-bold text-gray-800">{requests.filter(r => r.status === 'Delivered').length}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg text-green-600"><FaCheckCircle /></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-gray-900">Linked Shops</h3>
                          <span className="text-sm text-gray-500">{linkedShops.length} linked</span>
                        </div>
                        {linkedShops.length === 0 ? (
                          <p className="text-gray-500">No shops linked yet.</p>
                        ) : (
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {linkedShops.map(s => (
                                <tr key={s.id}>
                                  <td className="px-4 py-2">#{s.id}</td>
                                  <td className="px-4 py-2">{s.name}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                    </div>

                    {requests.length === 0 ? (
                        <div className="bg-white p-10 rounded-xl shadow-sm text-center text-gray-500 border border-gray-100">
                            <FaBoxOpen className="mx-auto text-4xl mb-3 text-gray-300" />
                            <p>No pending requests at the moment.</p>
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {requests.map(req => (
                                <div key={req.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-2">
                                          <div className="flex flex-col">
                                            <div className="flex items-center space-x-3">
                                                <h3 className="font-bold text-lg text-gray-900">{req.product_name}</h3>
                                                {req.unit_type && req.unit_value && (
                                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold border border-indigo-100">
                                                        {req.unit_value} {req.unit_type}
                                                    </span>
                                                )}
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                                                    req.reason === 'Expired' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {req.reason}
                                                </span>
                                            </div>
                                            {!req.in_catalog && (
                                                <div className="flex flex-col mt-1">
                                                  <div className="flex items-center space-x-1 text-red-500 font-bold text-[10px] uppercase italic">
                                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                      </svg>
                                                      <span>Not in your catalog</span>
                                                  </div>
                                                  <button 
                                                    onClick={() => handleAddToCatalogFromRequest(req.product_name, req.product_sku)}
                                                    className="mt-1 text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100 hover:bg-red-100 transition-colors font-bold w-max"
                                                  >
                                                    + Add "{req.product_name}" to Catalog
                                                  </button>
                                                </div>
                                            )}
                                          </div>
                                            <p className="text-sm text-gray-600">
                                                <span className="font-semibold text-gray-700">Shop:</span> {req.shop_name}
                                                {req.is_top_customer && (
                                                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase">Most Orders</span>
                                                )}
                                            </p>
                                            <div className="text-sm text-gray-500 flex space-x-4">
                                                <span>Requested: {req.request_date}</span>
                                                {req.delivery_date !== 'Not Scheduled' && <span>Delivery: {req.delivery_date}</span>}
                                            </div>
                                            <div className="mt-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                    req.status === 'Delivered' ? 'bg-green-100 text-green-800' : 
                                                    req.status === 'Shipped' ? 'bg-blue-100 text-blue-800' : 
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                    Status: {req.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end space-y-3">
                                            <div className="text-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                <p className="text-xs text-gray-500 uppercase">Quantity</p>
                                                <p className="text-xl font-bold text-indigo-600">{req.quantity}</p>
                                            </div>
                                            
                                            {req.can_quote && (
                                              <div className="w-full">
                                                {req.is_top_customer && (
                                                  <div className="text-[11px] text-indigo-600 font-bold mb-1 animate-pulse bg-indigo-50 px-2 py-0.5 rounded-full inline-block">
                                                    ✨ Top Customer! Do you want to increase discount?
                                                  </div>
                                                )}
                                                <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
                                                  <span>Base Price: <span className="font-bold text-gray-900">₹{req.base_price}</span></span>
                                                  <span>Subtotal: <span className="font-bold text-gray-900">₹{(req.base_price * req.quantity).toFixed(2)}</span></span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                  <div className="flex flex-col">
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1">Discount %</label>
                                                    <input className="border rounded px-2 py-1 text-sm" type="number" step="0.01" placeholder="0" value={(quoteInputs[req.id]?.discount_percent)||''} onChange={e=>setQuoteInputs({...quoteInputs, [req.id]: {...(quoteInputs[req.id]||{}), discount_percent: e.target.value}})} />
                                                  </div>
                                                  <div className="flex flex-col">
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase mb-1">Batch Expiry</label>
                                                    <input className="border rounded px-2 py-1 text-sm" type="date" value={(quoteInputs[req.id]?.expiry_date)||''} onChange={e=>setQuoteInputs({...quoteInputs, [req.id]: {...(quoteInputs[req.id]||{}), expiry_date: e.target.value}})} />
                                                  </div>
                                                  <button onClick={() => submitQuote(req.id)} className="col-span-2 bg-green-600 text-white rounded px-3 py-2 text-sm font-bold hover:bg-green-700 mt-1 shadow-sm transition-all">Submit Quote with Batch Details</button>
                                                </div>
                                                {quoteInputs[req.id]?.discount_percent > 0 && (
                                                  <div className="space-y-1 mb-2">
                                                    <div className="text-xs text-right text-gray-500">
                                                      Net Price: ₹{(req.base_price * req.quantity * (1 - (quoteInputs[req.id]?.discount_percent || 0)/100)).toFixed(2)}
                                                    </div>
                                                    <div className="text-xs text-right text-gray-400 italic">
                                                      + GST ({(getGstRate(req.product_name, req.category) * 100).toFixed(0)}%): ₹{(req.base_price * req.quantity * (1 - (quoteInputs[req.id]?.discount_percent || 0)/100) * getGstRate(req.product_name, req.category)).toFixed(2)}
                                                    </div>
                                                    <div className="text-xs text-right text-green-600 font-bold">
                                                      Grand Total: ₹{(req.base_price * req.quantity * (1 - (quoteInputs[req.id]?.discount_percent || 0)/100) * (1 + getGstRate(req.product_name, req.category))).toFixed(2)}
                                                    </div>
                                                  </div>
                                                )}
                                                <div className="text-xs text-gray-500">
                                                  {req.status === 'Pending' ? 'First quote becomes Provisional.' : 'Submit a competing quote.'}
                                                </div>
                                              </div>
                                            )}

                                            {!req.in_catalog && req.status === 'Pending' && (
                                              <div className="bg-red-50 text-red-600 p-2 rounded text-xs border border-red-100">
                                                Product (SKU: {req.product_sku}) is not in your catalog. Add it first to submit a quote.
                                              </div>
                                            )}

                                            {req.has_quoted && (
                                                <div className={`p-3 rounded-lg border text-sm ${
                                                req.my_quote_status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' : 
                                                req.my_quote_status === 'Accepted' ? 'bg-green-50 text-green-700 border-green-100' :
                                                'bg-blue-50 text-blue-700 border-blue-100'
                                              }`}>
                                                <p className="font-bold">Your Quote: {req.my_quote_status}</p>
                                                <div className="mt-1 text-[11px] text-gray-600 border-t border-gray-200/50 pt-1">
                                                  <p>GST ({(req.gst_rate !== undefined ? req.gst_rate : getGstRate(req.product_name, req.category)) * 100}%): ₹{(req.my_quote_gst || 0).toFixed(2)}</p>
                                                  <p className="font-bold text-gray-800 text-xs">Total: ₹{(req.my_quote_grand_total || 0).toFixed(2)}</p>
                                                </div>
                                                {req.my_quote_status === 'Accepted' && req.status === 'Awaiting Payment' && (
                                                  <p className="text-xs mt-1 animate-pulse font-medium">Winner! Awaiting shop payment before shipping.</p>
                                                )}
                                                {req.my_quote_status === 'Accepted' && req.status === 'Paid' && (
                                                  <p className="text-xs mt-1 font-medium text-green-600">Payment received! Please ship the order.</p>
                                                )}
                                                {req.my_quote_status === 'Rejected' && (
                                                  <p className="text-xs mt-1">Shop chose another supplier for this request.</p>
                                                )}
                                                {req.my_quote_status === 'Provisional' && (
                                                  <p className="text-xs mt-1">Awaiting shop selection.</p>
                                                )}
                                              </div>
                                            )}
                                            
                                            {req.is_winner && (req.status === 'Paid' || req.status === 'Shipped') && (
                                                <div className="flex space-x-2 mt-3">
                                                    {req.status === 'Paid' && (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(req.id, 'Shipped')}
                                                            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
                                                        >
                                                            <FaShippingFast />
                                                            <span>Ship Order</span>
                                                        </button>
                                                    )}
                                                    {req.status === 'Shipped' && (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(req.id, 'Delivered')}
                                                            className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm transition-colors flex items-center space-x-2"
                                                        >
                                                            <FaCheckCircle />
                                                            <span>Confirm Delivery</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
            {activeTab === 'products' && (
              <div className="space-y-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Add Catalog Item</h3>
                    <p className="text-sm text-gray-500 italic">Define multiple pack sizes and their individual prices</p>
                  </div>

                  <form onSubmit={handleAddCatalog} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                        <input className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2 border" 
                          placeholder="e.g. OIL-001" value={newItem.sku} onChange={e=>setNewItem({...newItem, sku:e.target.value})} required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                        <input className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2 border" 
                          placeholder="e.g. Sunflower Oil" value={newItem.name} onChange={e=>setNewItem({...newItem, name:e.target.value})} required />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2 border" 
                          value={newItem.category} onChange={e=>setNewItem({...newItem, category:e.target.value})}>
                          <option>General</option>
                          <option>Consumables</option>
                          <option>Perishable Goods</option>
                          <option>Pharmaceuticals</option>
                          <option>Clothes</option>
                          <option>Electronics</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (Optional)</label>
                        <input className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2 border" 
                          type="date" value={newItem.expiry_date} onChange={e=>setNewItem({...newItem, expiry_date:e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Life (Days)</label>
                        <input className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2 border" 
                          type="number" placeholder="e.g. 365" value={newItem.shelf_life_days} onChange={e=>setNewItem({...newItem, shelf_life_days:e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Default Discount %</label>
                        <input className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2 border" 
                          type="number" step="0.01" placeholder="0.00" value={newItem.discount_percent} onChange={e=>setNewItem({...newItem, discount_percent:e.target.value})} />
                      </div>
                    </div>

                    {/* UNIT VARIATIONS SECTION */}
                    <div className="mt-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <FaBoxOpen className="text-green-600" />
                          <h4 className="font-bold text-gray-800">Unit Variations & Pricing</h4>
                        </div>
                        <button type="button" onClick={() => {
                          setNewItem({...newItem, variations: [...newItem.variations, { unit_type: 'litres', unit_value: '', base_price: '' }]});
                        }} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg hover:bg-green-100 font-bold flex items-center">
                          <span className="mr-1">+</span> Add Variation
                        </button>
                      </div>

                      <div className="space-y-4">
                        {newItem.variations.map((opt, idx) => (
                          <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end relative group">
                            {newItem.variations.length > 1 && (
                              <button 
                                type="button" 
                                onClick={() => {
                                  const updated = newItem.variations.filter((_, i) => i !== idx);
                                  setNewItem({...newItem, variations: updated});
                                }}
                                className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Value (Qty)</label>
                              <input className="w-full border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-0" 
                                placeholder="e.g. 0.5" type="number" step="0.01" value={opt.unit_value} 
                                onChange={e => {
                                  const updated = [...newItem.variations];
                                  updated[idx].unit_value = e.target.value;
                                  setNewItem({...newItem, variations: updated});
                                }} required />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider">Unit</label>
                              <select className="w-full border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-green-500 focus:ring-0" 
                                value={opt.unit_type} 
                                onChange={e => {
                                  const updated = [...newItem.variations];
                                  updated[idx].unit_type = e.target.value;
                                  setNewItem({...newItem, variations: updated});
                                }}>
                                <option value="litres">litres</option>
                                <option value="kg">kg</option>
                                <option value="units">units</option>
                                <option value="packs">packs</option>
                                <option value="ml">ml</option>
                                <option value="g">g</option>
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 tracking-wider text-green-600">Base Price (₹)</label>
                              <input className="w-full border-green-200 rounded-lg px-3 py-2 text-sm font-bold text-green-700 bg-green-50/50 focus:border-green-500 focus:ring-0" 
                                placeholder="Supplier Price" type="number" step="0.01" value={opt.base_price} 
                                onChange={e => {
                                  const updated = [...newItem.variations];
                                  updated[idx].base_price = e.target.value;
                                  setNewItem({...newItem, variations: updated});
                                }} required />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-4 text-[11px] text-gray-400 italic font-medium">* Note: When a shop requests a specific variation, the system will automatically use the matching price defined above.</p>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <button type="submit" className="bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 text-sm font-bold shadow-lg shadow-green-200 transition-all flex items-center space-x-2">
                        <FaCheckCircle />
                        <span>Add Catalog Item</span>
                      </button>
                    </div>
                  </form>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
                      <FaClipboardList className="text-green-600" />
                      <span>My Catalog</span>
                    </h3>
                    <div className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">Linked shops: {linkedShops.map(s=>s.name).join(', ') || 'None'}</div>
                  </div>
                  {catalog.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <FaBoxOpen className="mx-auto text-4xl mb-3 opacity-20" />
                      <p>No items in catalog yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">SKU & Product</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Unit Variations & Base Prices</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Discount %</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Expiry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {catalog.map(it => (
                            <tr key={it.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-bold text-gray-900">{it.name}</div>
                                <div className="text-xs text-gray-400 font-mono">#{it.sku}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded text-[10px] font-bold uppercase">{it.category || 'General'}</span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {it.variations && it.variations.length > 0 ? (
                                    it.variations.map(v => (
                                      <div key={v.id} className="bg-green-50 border border-green-100 px-2 py-1 rounded text-[11px] font-bold text-green-700 flex flex-col items-center">
                                        <span>{v.unit_value} {v.unit_type}</span>
                                        <span className="text-gray-400 font-normal">₹{v.base_price}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-sm font-bold text-gray-900">₹{it.base_price}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                {it.discount_percent}%
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 italic">
                                {it.expiry_date || 'No Date'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-gray-900">Order History</h3>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">
                    {bills.filter(b => b.status === 'Paid' || b.status === 'Failed').length} Total
                  </span>
                </div>
                {bills.filter(b => b.status === 'Paid' || b.status === 'Failed').length === 0 ? (
                  <div className="text-center py-10 text-gray-500">
                    <FaBoxOpen className="mx-auto text-4xl mb-3 opacity-20" />
                    <p>No order history yet.</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shop</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">GST (18%)</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {bills.filter(b => b.status === 'Paid' || b.status === 'Failed').map(b => (
                        <tr key={b.id}>
                          <td className="px-4 py-2 text-sm text-gray-600">{b.date}</td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{b.shop}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {b.product}
                            {b.unit_type && b.unit_value && (
                              <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {b.unit_value} {b.unit_type}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{b.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 italic">₹{(b.gst_amount || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm font-bold text-green-600">₹{(b.grand_total || b.total).toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              b.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {b.status === 'Failed' ? 'Delivery Failed (Overdue)' : b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'bills' && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Bills</h3>
                {bills.filter(b => b.status !== 'Paid').length === 0 ? (
                  <p className="text-gray-500">No pending bills.</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shop</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">GST (18%)</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Grand Total</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {bills.filter(b => b.status !== 'Paid').map(b => (
                        <tr key={b.id}>
                          <td className="px-4 py-2">{b.date}</td>
                          <td className="px-4 py-2">{b.shop}</td>
                          <td className="px-4 py-2">
                            {b.product}
                            {b.unit_type && b.unit_value && (
                              <span className="ml-2 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {b.unit_value} {b.unit_type}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">{b.quantity}</td>
                          <td className="px-4 py-2">₹{b.total.toFixed(2)}</td>
                          <td className="px-4 py-2 text-gray-500 italic">₹{(b.gst_amount || 0).toFixed(2)}</td>
                          <td className="px-4 py-2 font-bold text-green-600">₹{(b.grand_total || b.total).toFixed(2)}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${b.status === 'Awaiting Payment' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
        </main>
      </div>

      {/* Delivery Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md transform transition-all scale-100">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Delivery</h3>
                <p className="text-gray-600 mb-6">
                    Please confirm that the items have been delivered to the shop. 
                    If the items have a new expiry date, enter it below.
                </p>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Expiry Date (Optional)</label>
                    <input 
                        type="date" 
                        className="w-full border-gray-300 rounded-lg shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2 border"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                    />
                </div>

                <div className="flex justify-end space-x-3">
                    <button 
                        onClick={() => setShowDeliveryModal(false)}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmDelivery}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold shadow-sm transition-colors flex items-center space-x-2"
                    >
                        <FaCheckCircle />
                        <span>Confirm</span>
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default SupplierDashboard;
