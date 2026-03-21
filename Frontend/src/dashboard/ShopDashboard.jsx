import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { FaBox, FaChartLine, FaHistory, FaPlusCircle, FaSignOutAlt, FaCloudSun, FaExclamationTriangle, FaMoneyBillWave, FaShoppingCart, FaTrash, FaUsers, FaEnvelope, FaBell, FaUserTag, FaClipboardList, FaCheckCircle, FaStore } from 'react-icons/fa';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const ShopDashboard = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const role = localStorage.getItem('role');
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [weather, setWeather] = useState({ temp: '--', condition: 'Loading...' });
  const [demand, setDemand] = useState(null);
  const [rules, setRules] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], revenue: [], profit: [] });
  const [saleQuantities, setSaleQuantities] = useState({});
  const [customers, setCustomers] = useState([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '', dob: '' });
  const [bills, setBills] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [linkedSuppliers, setLinkedSuppliers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [expired, setExpired] = useState([]);
  const [restockQty, setRestockQty] = useState({});
  const [salesSummary, setSalesSummary] = useState([]);
  const [dailySales, setDailySales] = useState([]);
  const [dailyForProduct, setDailyForProduct] = useState(null);
  const [expiredSales, setExpiredSales] = useState({});
  const [expandedExpired, setExpandedExpired] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [isPaying, setIsPaying] = useState(false);
  const [shopName, setShopName] = useState('');
  const [rationOrders, setRationOrders] = useState([]);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);

  // Salesman State
  const [salesmen, setSalesmen] = useState([]);
  const [newSalesman, setNewSalesman] = useState({ name: '', phone: '' });
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellingProduct, setSellingProduct] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [sellSalesmanId, setSellSalesmanId] = useState('');
  const [sellQuantity, setSellQuantity] = useState(1);
  const [scannedCode, setScannedCode] = useState('');
  const [isScanned, setIsScanned] = useState(false);

  // New Customer Search State for Sell Modal
  const [sellCustomer, setSellCustomer] = useState({
    name: '', phone: '', email: '', dob: '', address: '', save_profile: false
  });
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Form State
  const [newProduct, setNewProduct] = useState({
      name: '', sku: '', category: 'General', expiry_date: '', shelf_life_days: '',
      unit_options: [{ unit_type: 'litres', unit_value: '', cost_price: '', selling_price: '', stock_quantity: '', reorder_level: '10', restock_quantity: '50' }]
  });

  const [selectedUnitsInList, setSelectedUnitsInList] = useState({});

  useEffect(() => {
    if (!token) navigate('/login');
    
    // Check if role is present
    if (!role) {
      console.error("No role found in localStorage");
      navigate('/login');
      return;
    }

    fetchProducts();
    fetchWeather();
    fetchShopDetails();
    
    if (role === 'shop_owner') {
      fetchAnalytics();
      fetchCustomers();
      fetchSuppliers();
      fetchLinkedSuppliers();
      fetchBills();
      fetchExpired();
      fetchRequests();
      fetchSalesmen();
      fetchRationOrders();
    } else if (role === 'salesman') {
      fetchSalesmanProfile();
      fetchAnalytics(); // Added for salesman
      fetchExpired();   // Added for salesman
      fetchSalesSummary(); // Added for salesman
    }
    
    fetchHistory();
  }, []);

  const fetchShopDetails = async () => {
     try {
       const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/auth/me', {
         headers: { 'Authorization': `Bearer ${token}` }
       });
       if (res.ok) {
         const data = await res.json();
         if (data.shop_name) setShopName(data.shop_name);
       }
     } catch (e) {}
   };

  const [salesmanProfile, setSalesmanProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const fetchSalesmanProfile = async () => {
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/salesman/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSalesmanProfile(data);
        setProfileError(null);
        if (data.shop_name) setShopName(data.shop_name);
      } else {
        let errorMsg = 'Profile not linked';
        try {
          const errData = await res.json();
          errorMsg = errData.message || errorMsg;
        } catch (parseErr) {
          // If response is not JSON (like a 404 HTML page)
          errorMsg = `Server Error (${res.status})`;
        }
        setProfileError(errorMsg);
      }
    } catch (e) { 
      console.error('Fetch error:', e);
      setProfileError('Connection Error');
    }
  };

  const fetchSalesmen = async () => {
    try {
        const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/salesman/list', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setSalesmen(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchRationOrders = async () => {
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/customers/shop/ration-orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setRationOrders(await res.json());
    } catch (e) { console.error(e); }
  };

  const updateRationOrderStatus = async (orderId, updates) => {
    setUpdatingOrderStatus(true);
    try {
      const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/customers/order/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        alert('Order updated successfully');
        fetchRationOrders();
      }
    } catch (e) { console.error(e); }
    setUpdatingOrderStatus(false);
  };

  const handleAddSalesman = async (e) => {
    e.preventDefault();
    try {
        const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/salesman/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(newSalesman)
        });
        const data = await res.json();
        if (res.ok) {
            alert('Salesman Registered! Unique ID has been auto-assigned.');
            fetchSalesmen();
            setNewSalesman({ name: '', phone: '' });
        } else {
            alert(data.message || 'Failed to add salesman');
        }
    } catch (e) { console.error(e); }
  };

  const handleDeleteSalesman = async (id) => {
    if(!window.confirm('Delete this salesman?')) return;
    try {
        const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/salesman/delete/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            alert('Salesman deleted');
            fetchSalesmen();
        }
    } catch (e) { console.error(e); }
  };

  const handleOpenSellModal = (product, initialVariation = null) => {
    setSellingProduct(product);
    setSellQuantity(saleQuantities[product.id] || 1);
    
    // Explicitly set the first variation if none provided
    const variation = initialVariation || (product.unit_options?.length > 0 ? product.unit_options[0] : null);
    setSelectedUnit(variation);
    
    setScannedCode('');
    setIsScanned(false);
    setSellCustomer({ name: '', phone: '', email: '', dob: '', address: '', save_profile: false });
    setShowSellModal(true);
  };

  const handleSearchCustomer = async (phone) => {
    if (phone.length < 10) return;
    setIsSearchingCustomer(true);
    try {
      const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/customers/search?phone=${phone}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSellCustomer({
            ...sellCustomer,
            name: data.name,
            email: data.email,
            dob: data.dob,
            address: data.address,
            phone: data.phone,
            is_birthday: data.is_birthday,
            birthday_discount: data.birthday_discount,
            offer_code: data.offer_code,
            save_profile: false // Already exists
          });
        }
      }
    } catch (e) { console.error(e); }
    setIsSearchingCustomer(false);
  };

  const handleSellProduct = async () => {
    let finalSalesmanId = sellSalesmanId;
    if (role === 'salesman') {
      if (salesmanProfile) {
        finalSalesmanId = salesmanProfile.salesman_id_code;
      } else {
        alert(profileError || 'Salesman identity not found. Please wait or refresh.');
        return;
      }
    }

    if (!finalSalesmanId) {
      alert('Error: No salesman identity found for this transaction.');
      return;
    }
    
    if (!isScanned) {
      alert('Product must be scanned before selling!');
      return;
    }
    
    try {
        const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                product_id: sellingProduct.id,
                type: 'SALE',
                quantity: sellQuantity,
                unit_option_id: selectedUnit?.id,
                salesman_id_code: finalSalesmanId,
                scanned_qr_code: scannedCode,
                customer: sellCustomer.phone ? sellCustomer : null,
                is_birthday_sale: sellCustomer.is_birthday,
                birthday_discount_percent: sellCustomer.birthday_discount,
                birthday_offer_code: sellCustomer.offer_code
            })
        });
        
        let data;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            const text = await res.text();
            throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
        }

        if (res.ok) {
            alert('Transaction recorded!');
            setShowSellModal(false);
            setSellSalesmanId('');
            setSellCustomer({ name: '', phone: '', email: '', dob: '', address: '', save_profile: false });
            fetchProducts();
            fetchHistory();
            fetchAnalytics();
            fetchSalesSummary(); // Ensure product sales tab is updated
            if (role === 'shop_owner') {
                fetchSalesmen();
                fetchCustomers();
            } else if (role === 'salesman') {
                fetchSalesmanProfile();
            }
        } else {
            alert(data.message || 'Transaction failed');
        }
    } catch (e) { 
        console.error("SELL_PRODUCT_ERROR:", e);
        alert(`Error: ${e.message}`);
    }
  };

  const fetchCustomers = async () => {
      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/customers/', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) setCustomers(await res.json());
      } catch (e) { console.error(e); }
  };

  const handleAddCustomer = async (e) => {
      e.preventDefault();
      console.log("DEBUG: handleAddCustomer triggered", newCustomer);
      
      if (!newCustomer.phone) {
          alert('Phone number is required');
          return;
      }

      // Phone number validation: exactly 10 digits
      const phoneDigits = newCustomer.phone.replace(/\D/g, '');
      if (phoneDigits.length !== 10) {
          alert('Phone number must be exactly 10 digits');
          return;
      }

      try {
          console.log("DEBUG: Sending request to /api/customers/");
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/customers/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ ...newCustomer, phone: phoneDigits })
          });
          
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
              const data = await res.json();
              console.log("DEBUG: Received response", res.status, data);
              
              if (res.ok) {
                  alert(`Customer Added successfully! Unique ID: ${data.customer_id_code}`);
                  fetchCustomers();
                  setNewCustomer({ name: '', email: '', phone: '', address: '', dob: '' });
              } else {
                  alert(data.message || 'Failed to add customer');
              }
          } else {
              const text = await res.text();
              console.error("Non-JSON response received:", text);
              alert(`Server error (non-JSON). This usually means the backend is crashing. Check terminal logs.`);
          }
      } catch (e) { 
          console.error("DEBUG: Error in handleAddCustomer", e);
          alert(`Network/Server Error: ${e.message}`);
      }
  };

  const handleNotifyDiscount = async (product) => {
      console.log("Button Clicked for product:", product);
      if(!window.confirm(`Send discount email to ALL customers for ${product.name}?`)) return;
      
      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/customers/notify-discount', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ product_id: product.id })
          });
          
          const data = await res.json();
          if (res.ok) {
              alert(data.message);
          } else {
              alert('Failed to send notifications');
          }
      } catch (e) { console.error(e); }
  };

  const fetchSuppliers = async () => {
      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/supplier/list', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) setSuppliers(await res.json());
      } catch (e) { console.error(e); }
  };
  const fetchLinkedSuppliers = async () => {
      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/supplier/linked-for-shop', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) setLinkedSuppliers(await res.json());
      } catch (e) {}
  };
  const fetchRequests = async () => {
      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/requests', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res.ok) setRequests(await res.json());
      } catch (e) {}
  };
  const acceptQuote = async (quoteId) => {
      if (!quoteId) {
          alert("Invalid Quote ID");
          return;
      }
      if (!token) {
          alert("Your session has expired. Please login again.");
          return;
      }
      try {
          const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/inventory/quotes/${quoteId}/accept`, { 
              method: 'POST', 
              headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify({ accept: true }) // Send a dummy body to ensure preflight and server handling
          });
          
          let data;
          try {
              data = await res.json();
          } catch (e) {
              console.error("JSON Parse Error:", e);
              data = { message: `Server returned an invalid response (${res.status} ${res.statusText})` };
          }

          if (res.ok) {
              alert('Quote accepted and bill generated. Redirecting to Bills...');
              fetchBills();
              fetchRequests();
              setActiveTab('bills');
          } else {
              alert(data.message || 'Failed to accept quote');
          }
      } catch (e) { 
          console.error('Accept quote error:', e);
          alert(`Network error: ${e.message}. This might be a CORS or backend connection issue.`); 
      }
  };

  const handlePayBill = (bill) => {
      setSelectedBill(bill);
      setShowPaymentModal(true);
  };

  const handleRetryRestock = async (billId) => {
      if (!window.confirm('Would you like to send the restock request again for this failed order?')) return;
      try {
          const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/inventory/bills/${billId}/retry-restock`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok) {
              alert('New restock request generated successfully');
              fetchBills();
              fetchRequests();
              setActiveTab('suppliers');
          } else {
              alert(data.message || 'Failed to retry restock');
          }
      } catch (e) {
          alert('Network error retrying restock');
      }
  };

  const processPayment = async () => {
      if (!selectedBill) return;
      setIsPaying(true);
      try {
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/billing/pay/${selectedBill.id}`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
              alert('Payment Successful! Order is now active.');
              setShowPaymentModal(false);
              setSelectedBill(null);
              fetchBills();
              setActiveTab('orders'); // Move to My Orders page
          } else {
              const data = await res.json();
              alert(data.message || 'Payment failed');
          }
      } catch (e) {
          alert('Network error during payment');
      } finally {
          setIsPaying(false);
      }
  };

  const handleAssignSupplier = async (id) => {
      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/supplier/assign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ supplier_id: id })
          });
          const data = await res.json();
          if (res.ok) {
              alert('Supplier added to your shop');
          } else {
              alert(data.message || 'Failed to assign supplier');
          }
      } catch (e) {
          alert('Network error assigning supplier');
      }
  };

  const fetchHistory = async () => {
      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/history', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
              const data = await res.json();
              console.log("DEBUG: History data received:", data.length, "records");
              setHistory(data);
          } else {
              const errorData = await res.json();
              console.error("DEBUG: History fetch failed:", errorData.message);
              // alert(`Failed to load history: ${errorData.message}`);
          }
      } catch (e) { 
          console.error("DEBUG: History network error:", e);
      }
  };

  const fetchProducts = async () => {
    try {
      console.log("DEBUG: Fetching products for role:", role);
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log("DEBUG: Product fetch status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("DEBUG: Products fetched:", data.length);
        setProducts(data);
      } else {
        const text = await res.text();
        console.error("DEBUG: Product fetch failed:", text);
      }
    } catch (err) { console.error("DEBUG: Product fetch error:", err); }
  };

  const fetchWeather = async () => {
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/analytics/weather?city=New York');
      if (res.ok) setWeather(await res.json());
    } catch (e) {}
  };

  const fetchExpired = async () => {
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/expired', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setExpired(await res.json());
    } catch (e) {}
  };
  const viewExpiredSales = async (expiredId) => {
    try {
      const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/inventory/expired/${expiredId}/sales`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setExpiredSales({ ...expiredSales, [expiredId]: data.daily || [] });
        setExpandedExpired({ ...expandedExpired, [expiredId]: !expandedExpired[expiredId] });
      }
    } catch (e) {}
  };
  const handleNotRestock = (expiredId) => {
    alert('Not restocking this item now.');
  };

  const fetchSalesSummary = async () => {
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/sales/summary', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setSalesSummary(await res.json());
    } catch (e) {}
  };

  const fetchDailyFor = async (productId, name) => {
    try {
      setDailyForProduct({ product_id: productId, name });
      const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/inventory/sales/daily?product_id=${productId}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setDailySales(await res.json());
    } catch (e) {}
  };

  const fetchBills = async () => {
    try {
      const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/billing/shop', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setBills(await res.json());
    } catch (e) {}
  };

  const fetchAnalytics = async () => {
      try {
          const res1 = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/analytics/demand', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res1.ok) setDemand(await res1.json());
          
          const res2 = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/analytics/market-basket', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res2.ok) setRules(await res2.json());
          
          const res3 = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/analytics/sales', { headers: { 'Authorization': `Bearer ${token}` } });
          if (res3.ok) {
              const data = await res3.json();
              setChartData({
                  labels: data.map(d => d.date),
                  revenue: data.map(d => d.revenue),
                  profit: data.map(d => d.profit)
              });
          }
      } catch (e) {}
  };

  const handleSale = async (id) => {
      const quantity = saleQuantities[id] || 1;
      try {
        const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ product_id: id, type: 'SALE', quantity: parseInt(quantity) })
        });
        if (res.ok) {
            fetchProducts();
            fetchHistory();
            alert('Sale recorded!');
            setSaleQuantities({ ...saleQuantities, [id]: '' }); // Reset input
        } else {
            let msg = res.statusText;
            try {
              const data = await res.json();
              if (data && data.message) msg = data.message;
            } catch {}
            alert(`Failed: ${msg}`);
        }
      } catch (e) {
        alert(`Request error: ${e.message}`);
      }
  };

  const handleDeleteProduct = async (id) => {
      if (!window.confirm("Are you sure you want to delete this product?")) return;
      
      try {
          // Trying POST method to avoid CORS DELETE issues
          const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/inventory/${id}/delete`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (res.ok) {
              alert('Product deleted successfully');
              fetchProducts();
          } else {
              const data = await res.json();
              alert(`Failed to delete: ${data.message || res.statusText} (${res.status})`);
          }
      } catch (err) {
          console.error(err);
          alert('Network/Server Error: ' + err.message);
      }
  };

  const handleRestock = async (expiredId) => {
      const qty = parseInt(restockQty[expiredId] || '0');
      if (!qty || qty <= 0) { alert('Enter a valid quantity'); return; }
      try {
          const res = await fetch(`https://smart-inventory-backend-pa1g.onrender.com/api/inventory/expired/${expiredId}/restock-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ quantity: qty })
          });
          let msg = res.statusText;
          try {
            const data = await res.json();
            if (data && data.message) msg = data.message;
          } catch {}
          if (res.ok) {
              alert(msg || 'Restock request emailed to supplier');
              fetchExpired();
              setRestockQty({ ...restockQty, [expiredId]: '' });
          } else {
              alert(`Failed: ${msg}`);
          }
      } catch (e) {
          alert('Network error');
      }
  };

  const handleAddProduct = async (e) => {
      e.preventDefault();
      const name = (newProduct.name || '').trim();
      const sku = (newProduct.sku || '').trim();
      const category = (newProduct.category || 'General').trim();
      const expiry = newProduct.expiry_date ? newProduct.expiry_date : null;

      // Validate Unit Options (now includes stock fields)
      const validUnitOptions = newProduct.unit_options.length > 0 && newProduct.unit_options.every(opt => 
        opt.unit_value !== '' && !Number.isNaN(parseFloat(opt.unit_value)) && 
        opt.cost_price !== '' && !Number.isNaN(parseFloat(opt.cost_price)) && 
        opt.selling_price !== '' && !Number.isNaN(parseFloat(opt.selling_price)) &&
        opt.stock_quantity !== '' && !Number.isNaN(parseInt(opt.stock_quantity))
      );

      if (!name || !sku || !validUnitOptions) {
          alert('Please fill Name, SKU and all Unit Variation fields (Value, Cost, Selling, Stock).');
          return;
      }

      try {
          const res = await fetch('https://smart-inventory-backend-pa1g.onrender.com/api/inventory/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                  name,
                  sku,
                  category,
                  expiry_date: expiry,
                  shelf_life_days: newProduct.shelf_life_days ? parseInt(newProduct.shelf_life_days) : null,
                  unit_options: newProduct.unit_options
              })
          });
          
          let data;
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
              data = await res.json();
          } else {
              data = { message: await res.text() };
          }
          
          if (res.ok) {
              alert('Product Added Successfully!');
              setActiveTab('inventory');
              fetchProducts();
              fetchExpired();
              setNewProduct({ 
                name: '', sku: '', category: 'General', expiry_date: '', shelf_life_days: '',
                unit_options: [{ unit_type: 'litres', unit_value: '', cost_price: '', selling_price: '', stock_quantity: '', reorder_level: '10', restock_quantity: '50' }]
              });
          } else {
              alert('Failed to add product: ' + (data.message || res.statusText || `HTTP ${res.status}`));
          }
      } catch (err) {
          alert('Request failed: ' + err.message);
      }
  };

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => {
        console.log(`DEBUG: Switching to tab ${id}`);
        setActiveTab(id);
      }} 
      className={`w-full flex items-center space-x-3 px-6 py-3 transition-colors duration-200 ${
        activeTab === id 
          ? 'bg-indigo-600 text-white border-r-4 border-white' 
          : 'text-indigo-100 hover:bg-indigo-700'
      }`}
    >
      <Icon className="text-lg" />
      <span className="font-medium">{label}</span>
    </button>
  );

  const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="text-white text-xl" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-gray-800">{value}</span>
        {subtext && <span className="text-xs text-gray-500 mt-1">{subtext}</span>}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-72 bg-indigo-800 text-white shadow-xl flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <FaShoppingCart className="text-indigo-300" />
            <span>{shopName || 'SmartStore'}</span>
          </h1>
          <p className="text-indigo-300 text-sm mt-1">{shopName ? 'Shop Management' : 'Inventory Management'}</p>
        </div>
        
        <nav className="flex-1 mt-6">
          <SidebarItem id="inventory" icon={FaBox} label="Inventory" />
          {role === 'shop_owner' && <SidebarItem id="add_product" icon={FaPlusCircle} label="Add Product" />}
          {role === 'shop_owner' && <SidebarItem id="customers" icon={FaUsers} label="Customers" />}
          <SidebarItem id="history" icon={FaHistory} label={role === 'salesman' ? "My Sales History" : "Sales History"} />
          {(role === 'shop_owner' || role === 'salesman') && <SidebarItem id="product_sales" icon={FaChartLine} label="Product Sales" />}
          {role === 'shop_owner' && <SidebarItem id="analytics" icon={FaChartLine} label="Analytics & AI" />}
          {role === 'shop_owner' && <SidebarItem id="bills" icon={FaBell} label="Bills" />}
          {role === 'shop_owner' && <SidebarItem id="orders" icon={FaBox} label="My Orders" />}
          {role === 'shop_owner' && <SidebarItem id="suppliers" icon={FaEnvelope} label="Suppliers" />}
          {role === 'shop_owner' && <SidebarItem id="ration_orders" icon={FaClipboardList} label="Ration Orders" />}
          <SidebarItem id="salesmen" icon={FaUsers} label={role === 'salesman' ? "My Salary" : "Salesmen"} />
        </nav>

        <div className="p-6 border-t border-indigo-700">
          <button 
            onClick={() => { localStorage.clear(); navigate('/login'); }} 
            className="flex items-center space-x-3 text-indigo-200 hover:text-white transition-colors w-full"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Top Header */}
        <header className="bg-white shadow-sm px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            {activeTab === 'inventory' && 'Inventory Overview'}
            {activeTab === 'add_product' && 'New Product Entry'}
            {activeTab === 'history' && (role === 'salesman' ? 'My Sales History' : 'Transaction History')}
            {activeTab === 'product_sales' && 'Product Sales'}
            {activeTab === 'analytics' && 'Business Intelligence'}
            {activeTab === 'bills' && 'Supplier Bills'}
            {activeTab === 'orders' && 'My Orders'}
            {activeTab === 'suppliers' && 'Manage Suppliers'}
            {activeTab === 'ration_orders' && 'Customer Ration Orders'}
            {activeTab === 'salesmen' && (role === 'salesman' ? 'My Salary & Profile' : 'Manage Salesmen')}
          </h2>
          <div className="flex items-center space-x-4">
             <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{role === 'salesman' ? salesmanProfile?.name : 'Shop Owner'}</p>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider text-indigo-600">{shopName || (role === 'salesman' ? 'Salesman' : 'Owner')}</p>
             </div>
             <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                {role === 'salesman' ? salesmanProfile?.name?.[0]?.toUpperCase() : 'SO'}
             </div>
          </div>
        </header>

        <main className="p-8">
          {/* FAILED DELIVERY ALERTS */}
          {bills.filter(b => b.status === 'Failed').length > 0 && (
            <div className="mb-8 animate-in slide-in-from-top-4 duration-500">
              {bills.filter(b => b.status === 'Failed').map(bill => (
                <div key={bill.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm mb-3 flex justify-between items-center">
                  <div className="flex items-center">
                    <FaExclamationTriangle className="text-red-500 mr-3 text-xl" />
                    <div>
                      <p className="text-red-800 font-bold text-sm">Delivery Failed: {bill.product}</p>
                      <p className="text-red-600 text-xs">Reason: Payment not received within 3 days. Stock remains low.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRetryRestock(bill.id)}
                    className="bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-700 text-xs font-bold transition-all shadow-sm"
                  >
                    Retry Restock Request?
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Stats Row */}
          {activeTab === 'inventory' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <StatCard 
                title="Total Products" 
                value={products.length} 
                icon={FaBox} 
                color="bg-blue-500" 
              />
              <StatCard 
                title="Inventory Value" 
                value={`₹${products.reduce((acc, p) => acc + ((p.discounted_price || p.price) * (p.stock || 0)), 0).toLocaleString('en-IN')}`} 
                icon={FaMoneyBillWave} 
                color="bg-green-500"
                subtext="Potential Revenue"
              />
              <StatCard 
                title="Low Stock Alerts" 
                value={products.filter(p => p.status === 'Low Stock').length} 
                icon={FaExclamationTriangle} 
                color="bg-red-500"
                subtext="Items needing restock"
              />
              <StatCard 
                title="Local Weather" 
                value={`${weather.temp}°C`} 
                icon={FaCloudSun} 
                color="bg-orange-400"
                subtext={weather.condition}
              />
            </div>
          )}

          {/* INVENTORY TAB */}
          {activeTab === 'inventory' && (
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiry</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          {role === 'salesman' && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quick Sell</th>}
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                      </thead>
                      <tbody>
                      {products.map((product) => {
                          const currentUnit = selectedUnitsInList[product.id] || (product.unit_options?.length > 0 ? product.unit_options[0] : null);
                          const priceToDisplay = currentUnit ? currentUnit.selling_price : product.price;
                          const discountedPrice = product.discounted_price ? (currentUnit ? currentUnit.selling_price * 0.8 : product.discounted_price) : null;
                          
                          // Dynamic Stock Logic for Variation
                          const displayStock = currentUnit ? currentUnit.stock_quantity : product.stock;
                          const displayStatus = currentUnit 
                            ? (currentUnit.stock_quantity <= currentUnit.reorder_level ? 'Low Stock' : 'In Stock')
                            : product.status;

                          return (
                          <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            <div className="text-xs text-gray-500">{product.sku}</div>
                            
                            {/* Variation Dropdown in List */}
                            {product.unit_options?.length > 0 && (
                              <div className="mt-2">
                                <select 
                                  className="text-[10px] font-bold border border-indigo-100 rounded bg-indigo-50 text-indigo-600 px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400"
                                  value={currentUnit?.id || ''}
                                  onChange={(e) => {
                                    const opt = product.unit_options.find(o => o.id === parseInt(e.target.value));
                                    setSelectedUnitsInList({...selectedUnitsInList, [product.id]: opt});
                                  }}
                                >
                                  {product.unit_options.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.unit_value} {opt.unit_type}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            
                            <div className="text-[10px] text-indigo-600 font-mono font-bold mt-1 bg-indigo-50 px-1.5 py-0.5 rounded w-fit">OQ: {product.qr_code}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                              {discountedPrice ? (
                                  <div className="flex flex-col">
                                      <span className="line-through text-gray-400 text-xs">₹{priceToDisplay.toLocaleString('en-IN')}</span>
                                      <span className="text-red-600 font-bold">₹{discountedPrice.toLocaleString('en-IN')}</span>
                                      <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-full w-fit mt-1">20% OFF</span>
                                  </div>
                              ) : (
                                  <span className="text-sm font-medium text-gray-900">₹{priceToDisplay.toLocaleString('en-IN')}</span>
                              )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`font-medium ${currentUnit ? (displayStock <= currentUnit.reorder_level ? 'text-red-600' : 'text-gray-900') : (displayStock <= 10 ? 'text-red-600' : 'text-gray-900')}`}>{displayStock}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.expiry_date || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${displayStatus === 'Low Stock' ? 'bg-red-100 text-red-800' : 
                                  displayStatus === 'Expiring Soon' ? 'bg-yellow-100 text-yellow-800' :
                                  displayStatus === 'Expired' ? 'bg-gray-200 text-gray-800' :
                                  'bg-green-100 text-green-800'}`}>
                              {displayStatus}
                              </span>
                              {displayStatus === 'Expiring Soon' && role === 'shop_owner' && (
                                  <button onClick={() => handleNotifyDiscount(product)} className="ml-2 text-indigo-600 hover:text-indigo-800" title="Send Discount Email">
                                      <FaEnvelope />
                                  </button>
                              )}
                          </td>
                          {role === 'salesman' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="number" 
                                        min="1" 
                                        className="w-16 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                        placeholder="Qty"
                                        value={saleQuantities[product.id] || ''}
                                        onChange={(e) => setSaleQuantities({...saleQuantities, [product.id]: e.target.value})}
                                    />
                                    <button onClick={() => {
                                      // Pass the currently selected variation to the sell modal
                                      handleOpenSellModal(product, currentUnit);
                                    }} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm">
                                      Sell
                                    </button>
                                </div>
                            </td>
                          )}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {role === 'shop_owner' && (
                              <button onClick={() => handleDeleteProduct(product.id)} className="text-red-600 hover:text-red-800">
                                <FaTrash />
                              </button>
                            )}
                          </td>
                          </tr>
                      )})}
                      
                      </tbody>
                      
                  </table>
                </div>
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                  <h3 className="text-md font-bold text-gray-800">Expired Products</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Stock</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Expiry</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Sold</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Review Sales</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Restock Decision</th>
                      </tr>
                    </thead>
                    
                    <tbody className="bg-white divide-y divide-gray-200">
                      {expired.map(p => (
                        <React.Fragment key={p.id}>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{p.name}</div>
                              <div className="text-xs text-gray-500">{p.sku}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p.category}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p.stock}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p.expiry_date}</td>
                            <td className="px-6 py-4 text-sm text-gray-500">{p.total_sold}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button onClick={() => viewExpiredSales(p.id)} className="text-indigo-600 hover:text-indigo-900 text-sm">
                                {expandedExpired[p.id] ? 'Hide Sales' : 'View Sales'}
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <input type="number" min="1" className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={restockQty[p.id] || ''} onChange={e=>setRestockQty({...restockQty, [p.id]: e.target.value})} />
                                <button onClick={() => handleRestock(p.id)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 text-sm font-medium">Restock</button>
                                <button onClick={() => handleNotRestock(p.id)} className="bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-300 text-sm font-medium">Do Not Restock</button>
                              </div>
                            </td>
                          </tr>
                          {expandedExpired[p.id] && (
                            <tr>
                              <td colSpan="7" className="px-6 py-4 bg-gray-50">
                                <div className="text-sm font-semibold text-gray-700 mb-2">Daily Sales</div>
                                <table className="min-w-full divide-y divide-gray-200 bg-white rounded">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(expiredSales[p.id] || []).map(d => (
                                      <tr key={d.date} className="border-t">
                                        <td className="px-4 py-2 text-sm text-gray-700">{d.date}</td>
                                        <td className="px-4 py-2 text-sm text-gray-700">{d.quantity}</td>
                                      </tr>
                                    ))}
                                    {(!expiredSales[p.id] || expiredSales[p.id].length === 0) && (
                                      <tr><td colSpan="2" className="px-4 py-3 text-sm text-gray-500">No daily data.</td></tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {expired.length === 0 && (
                        <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No expired items.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
          )}

          {/* ADD PRODUCT TAB */}
          {activeTab === 'add_product' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-3xl mx-auto">
                  <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Product Details</h3>
                  <form onSubmit={handleAddProduct} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                              <input type="text" required className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-2 border" 
                                  value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} placeholder="e.g. Milk Carton" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">SKU Code</label>
                              <input type="text" required className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-2 border" 
                                  value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} placeholder="e.g. MK-001" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                              <select className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-2 border"
                                  value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                                  <option>General</option>
                                  <option>Perishable Goods</option>
                                  <option>Pharmaceuticals</option>
                                  <option>Clothes</option>
                                  <option>Electronics</option>
                                  <option>Consumables</option>
                                  <option>High-Value Items</option>
                              </select>
                          </div>
                          {/* UNIT VARIATIONS SECTION */}
                          <div className="col-span-2 border-t pt-6 mt-4">
                              <div className="flex justify-between items-center mb-4">
                                  <h4 className="text-md font-bold text-gray-800">Unit Variations & Pricing</h4>
                                  <button type="button" onClick={() => {
                                      setNewProduct({...newProduct, unit_options: [...newProduct.unit_options, { unit_type: 'litres', unit_value: '', cost_price: '', selling_price: '', stock_quantity: '', reorder_level: '10', restock_quantity: '50' }]});
                                  }} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-bold flex items-center">
                                      <FaPlusCircle className="mr-1" /> Add Variation
                                  </button>
                              </div>
                              <div className="space-y-3">
                                  {newProduct.unit_options.map((opt, index) => (
                                      <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-gray-50 p-4 rounded-xl border border-gray-100 group">
                                          <div className="md:col-span-2">
                                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Value (Qty)</label>
                                              <input type="number" step="0.1" required className="w-full border-gray-300 rounded-lg px-3 py-2 border text-sm" 
                                                  value={opt.unit_value} onChange={e => {
                                                      const newOpts = [...newProduct.unit_options];
                                                      newOpts[index].unit_value = e.target.value;
                                                      setNewProduct({...newProduct, unit_options: newOpts});
                                                  }} placeholder="e.g. 0.5" />
                                          </div>
                                          <div className="md:col-span-3">
                                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Unit</label>
                                              <select className="w-full border-gray-300 rounded-lg px-3 py-2 border text-sm"
                                                  value={opt.unit_type} onChange={e => {
                                                      const newOpts = [...newProduct.unit_options];
                                                      newOpts[index].unit_type = e.target.value;
                                                      setNewProduct({...newProduct, unit_options: newOpts});
                                                  }}>
                                                  <option value="kg">kg (Kilograms)</option>
                                                  <option value="grams">grams</option>
                                                  <option value="litres">litres</option>
                                                  <option value="ml">ml (Millilitres)</option>
                                                  <option value="units">units / pcs</option>
                                                  <option value="packets">packets</option>
                                              </select>
                                          </div>
                                          <div className="md:col-span-3">
                                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cost Price (₹)</label>
                                              <input type="number" required className="w-full border-gray-300 rounded-lg px-3 py-2 border text-sm" 
                                                  value={opt.cost_price} onChange={e => {
                                                      const newOpts = [...newProduct.unit_options];
                                                      newOpts[index].cost_price = e.target.value;
                                                      setNewProduct({...newProduct, unit_options: newOpts});
                                                  }} placeholder="Cost" />
                                          </div>
                                          <div className="md:col-span-3">
                                              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Selling Price (₹)</label>
                                              <input type="number" required className="w-full border-gray-300 rounded-lg px-3 py-2 border text-sm font-bold text-green-700" 
                                                  value={opt.selling_price} onChange={e => {
                                                      const newOpts = [...newProduct.unit_options];
                                                      newOpts[index].selling_price = e.target.value;
                                                      setNewProduct({...newProduct, unit_options: newOpts});
                                                  }} placeholder="Selling" />
                                          </div>
                                          
                                          {/* Individual Stock Fields for Variation */}
                                          <div className="md:col-span-12 grid grid-cols-3 gap-3 mt-2 border-t border-gray-100 pt-2">
                                              <div>
                                                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Stock Qty</label>
                                                  <input type="number" required className="w-full border-gray-200 rounded-lg px-3 py-1.5 border text-xs" 
                                                      value={opt.stock_quantity} onChange={e => {
                                                          const newOpts = [...newProduct.unit_options];
                                                          newOpts[index].stock_quantity = e.target.value;
                                                          setNewProduct({...newProduct, unit_options: newOpts});
                                                      }} placeholder="Stock" />
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Reorder Lvl</label>
                                                  <input type="number" required className="w-full border-gray-200 rounded-lg px-3 py-1.5 border text-xs" 
                                                      value={opt.reorder_level} onChange={e => {
                                                          const newOpts = [...newProduct.unit_options];
                                                          newOpts[index].reorder_level = e.target.value;
                                                          setNewProduct({...newProduct, unit_options: newOpts});
                                                      }} placeholder="Min" />
                                              </div>
                                              <div>
                                                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Restock Qty</label>
                                                  <input type="number" required className="w-full border-gray-200 rounded-lg px-3 py-1.5 border text-xs" 
                                                      value={opt.restock_quantity} onChange={e => {
                                                          const newOpts = [...newProduct.unit_options];
                                                          newOpts[index].restock_quantity = e.target.value;
                                                          setNewProduct({...newProduct, unit_options: newOpts});
                                                      }} placeholder="Request" />
                                              </div>
                                          </div>

                                          <div className="md:col-span-1 flex justify-end">
                                              {newProduct.unit_options.length > 1 && (
                                                  <button type="button" onClick={() => {
                                                      const newOpts = newProduct.unit_options.filter((_, i) => i !== index);
                                                      setNewProduct({...newProduct, unit_options: newOpts});
                                                  }} className="p-2 text-red-400 hover:text-red-600 transition-colors">
                                                      <FaTrash size={14} />
                                                  </button>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-2 italic">* For milk example: 0.5 litres - ₹30, 1.0 litres - ₹42, etc.</p>
                          </div>

                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Shelf Life (days)</label>
                              <input type="number" className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-2 border" 
                                  value={newProduct.shelf_life_days || ''} onChange={e => setNewProduct({...newProduct, shelf_life_days: e.target.value})} />
                          </div>
                          <div className="col-span-2">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (Optional)</label>
                              <input type="date" className="w-full border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-4 py-2 border" 
                                  value={newProduct.expiry_date} onChange={e => setNewProduct({...newProduct, expiry_date: e.target.value})} />
                          </div>
                      </div>
                      <div className="pt-4">
                        <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold shadow-md transition-all transform hover:scale-[1.01]">
                            Save Product to Inventory
                        </button>
                      </div>
                  </form>
              </div>
          )}

          {/* CUSTOMERS TAB */}
          {activeTab === 'customers' && (
              <div className="space-y-8">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Add New Customer</h3>
                      <form onSubmit={handleAddCustomer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                              <input type="text" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" 
                                  value={newCustomer.name} onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} placeholder="John Doe" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Mail ID</label>
                              <input type="email" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" 
                                  value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} placeholder="john@example.com" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                              <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" 
                                  value={newCustomer.phone} maxLength="10" onChange={e => setNewCustomer({...newCustomer, phone: e.target.value.replace(/\D/g, '')})} placeholder="10-digit number" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                              <input type="date" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" 
                                  value={newCustomer.dob} onChange={e => setNewCustomer({...newCustomer, dob: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                              <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none" 
                                  value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} placeholder="Street, City" />
                          </div>
                          <div className="lg:col-span-4 flex justify-end">
                            <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 font-bold shadow-lg transition-all transform hover:scale-[1.02]">
                              Add Customer to Records
                            </button>
                          </div>
                      </form>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                          <h3 className="text-lg font-bold text-gray-800">Customer List</h3>
                          <span className="text-sm text-gray-500">{customers.length} total customers</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Mail ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Phone</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">DOB</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Address</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {customers.map(customer => (
                                    <tr key={customer.id}>
                                        <td className="px-6 py-4 text-sm font-bold text-indigo-600">{customer.customer_id_code || '-'}</td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{customer.email}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{customer.phone || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{customer.dob || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{customer.address || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{customer.joined}</td>
                                    </tr>
                                ))}
                                {customers.length === 0 && (
                                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-500">No customers found. Add one above to get started!</td></tr>
                                )}
                            </tbody>
                        </table>
                      </div>
                  </div>
              </div>
          )}

          {/* SALES HISTORY TAB */}
          {activeTab === 'history' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-8 py-6 border-b border-gray-100">
                      <h3 className="text-lg font-bold text-gray-800">Recent Transactions</h3>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Salesman</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Badge</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                      {Array.isArray(history) && history.map((record) => (
                          <tr key={record.id || Math.random()} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{String(record.date || 'N/A')}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{record.product_name || 'Unknown'}</div>
                            {record.unit_type && (
                              <div className="text-[10px] text-indigo-500 font-bold uppercase">{record.unit_value} {record.unit_type} pack</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{record.product_id || '?'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.quantity || 0}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-medium">{record.customer_name || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-medium">{record.salesman || 'System'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {record.historical_badge && (
                              <span className={`px-3 py-1 inline-flex text-xs font-semibold rounded-full ${
                                record.historical_badge === 'Most Sold' ? 'bg-green-100 text-green-800' :
                                record.historical_badge === 'Moderately Sold' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {record.historical_badge}
                              </span>
                            )}
                            {record.is_birthday_sale === true && (
                              <span className="ml-2 px-3 py-1 inline-flex text-xs font-bold rounded-full bg-purple-100 text-purple-800 animate-pulse border border-purple-200">
                                🎂 Birthday Discount
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">₹{Number(record.total_price || 0).toLocaleString('en-IN')}</td>
                          </tr>
                      ))}
                      {(!Array.isArray(history) || history.length === 0) && (
                        <tr>
                          <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                            <FaHistory className="mx-auto text-4xl mb-4 opacity-20" />
                            <p className="text-lg font-medium">No sales records found.</p>
                            <p className="text-sm">New transactions will appear here once recorded.</p>
                          </td>
                        </tr>
                      )}
                      </tbody>
                  </table>
              </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
              <div className="space-y-8">
                  
                  {/* Sales & Profit Chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                      <h3 className="text-lg font-bold text-gray-800 mb-6">Financial Overview</h3>
                      <div className="h-80">
                          <Line 
                              data={{
                                  labels: chartData.labels,
                                  datasets: [
                                      {
                                          label: 'Revenue (₹)',
                                          data: chartData.revenue,
                                          borderColor: 'rgb(99, 102, 241)', // Indigo 500
                                          backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                          tension: 0.4,
                                          fill: true
                                      },
                                      {
                                          label: 'Profit (₹)',
                                          data: chartData.profit,
                                          borderColor: 'rgb(34, 197, 94)', // Green 500
                                          backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                          tension: 0.4,
                                          fill: true
                                      }
                                  ]
                              }}
                              options={{ 
                                responsive: true, 
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: { position: 'top' },
                                },
                                scales: {
                                  y: { grid: { borderDash: [2, 4] } },
                                  x: { grid: { display: false } }
                                }
                              }}
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Demand Forecast */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center space-x-3 mb-6">
                          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                            <FaChartLine />
                          </div>
                          <h3 className="text-lg font-bold text-gray-800">AI Demand Forecast</h3>
                        </div>
                        
                        {demand ? (
                            <div className="text-center py-4">
                                <p className="text-sm text-gray-500 uppercase tracking-wide">Predicted Sales (Next 24h)</p>
                                <p className="text-5xl font-extrabold text-indigo-600 mt-2">{demand.predicted_next_day_sales}</p>
                                <p className="text-sm text-gray-400 mt-2 font-medium">Units Expected</p>
                                <div className="mt-6 p-4 bg-indigo-50 rounded-lg text-sm text-indigo-700">
                                  {demand.note}
                                </div>
                            </div>
                        ) : <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-gray-200 rounded w-3/4"></div></div></div>}
                    </div>

                    {/* Market Basket */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                        <div className="flex items-center space-x-3 mb-6">
                          <div className="p-2 bg-yellow-100 rounded-lg text-yellow-600">
                            <FaShoppingCart />
                          </div>
                          <h3 className="text-lg font-bold text-gray-800">Smart Recommendations</h3>
                        </div>

                        {rules.length > 0 ? (
                            <div className="space-y-4">
                                {rules.map((rule, idx) => (
                                    <div key={idx} className="border border-yellow-100 p-4 rounded-xl bg-yellow-50/50 hover:bg-yellow-50 transition-colors">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <p className="text-sm text-gray-500 mb-1">If customer buys:</p>
                                            <p className="font-semibold text-gray-800">{rule.bought.join(', ')}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-sm text-gray-500 mb-1">Recommend:</p>
                                            <p className="font-bold text-green-600">{rule.recommend.join(', ')}</p>
                                          </div>
                                        </div>
                                        <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${rule.confidence * 100}%` }}></div>
                                        </div>
                                        <p className="text-xs text-right text-gray-400 mt-1">{Math.round(rule.confidence * 100)}% Confidence</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-400">
                              <p>Not enough sales data to generate patterns.</p>
                            </div>
                        )}
                    </div>
                  </div>
              </div>
          )}

          {/* PRODUCT SALES TAB */}
          {activeTab === 'product_sales' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-gray-800">Monthly Sales by Product</h3>
                  <button onClick={fetchSalesSummary} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Refresh</button>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Month Qty</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Badge</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesSummary.map(p => (
                      <tr key={p.product_id}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{p.month_qty}</td>
                        <td className="px-6 py-4">
                          {p.badge === 'most' && <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">Most Sold</span>}
                          {p.badge === 'least' && <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold">Least Sold</span>}
                        </td>
                        <td className="px-6 py-4">
                          <button onClick={() => fetchDailyFor(p.product_id, p.name)} className="text-indigo-600 hover:text-indigo-900 text-sm">View Daily</button>
                        </td>
                      </tr>
                    ))}
                    {salesSummary.length === 0 && <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No sales yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              {dailyForProduct && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-md font-bold text-gray-800">Daily Sales: {dailyForProduct.name}</h4>
                    <button onClick={() => { setDailyForProduct(null); setDailySales([]); }} className="text-sm text-gray-600 hover:text-gray-800">Close</button>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {dailySales.map(d => (
                        <tr key={d.date}>
                          <td className="px-6 py-3 text-sm text-gray-700">{d.date}</td>
                          <td className="px-6 py-3 text-sm text-gray-700">{d.quantity}</td>
                        </tr>
                      ))}
                      {dailySales.length === 0 && <tr><td colSpan="2" className="px-6 py-6 text-center text-gray-500">No daily data.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* BILLS TAB */}
          {activeTab === 'bills' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">Pending Supplier Bills</h3>
                <span className="text-sm text-gray-500">{bills.filter(b => b.status === 'Awaiting Payment').length} awaiting payment</span>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">GST (18%)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Grand Total</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bills.filter(b => b.status === 'Awaiting Payment' || b.status === 'Pending').map(b => (
                    <tr key={b.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{b.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.supplier}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {b.product}
                        {b.unit_type && b.unit_value && (
                          <span className="ml-2 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {b.unit_value} {b.unit_type}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 italic">₹{(b.gst_amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">₹{(b.grand_total || b.total).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${b.status === 'Awaiting Payment' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {b.status === 'Awaiting Payment' && (
                          <button 
                            onClick={() => handlePayBill(b)}
                            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-all"
                          >
                            Pay Bill
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bills.filter(b => b.status === 'Awaiting Payment' || b.status === 'Pending').length === 0 && (
                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No pending bills.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* MY ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">My Orders</h3>
                <span className="text-sm text-gray-500">{bills.filter(b => b.status === 'Paid').length} successful orders</span>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Order Date</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Amount (Excl. GST)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">GST (18%)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Grand Total Paid</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bills.filter(b => b.status === 'Paid' || b.status === 'Failed').map(b => (
                    <tr key={b.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{b.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.supplier}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {b.product}
                        {b.unit_type && b.unit_value && (
                          <span className="ml-2 bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            {b.unit_value} {b.unit_type}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{b.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">₹{b.total.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 italic">₹{(b.gst_amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">₹{(b.grand_total || b.total).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          b.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {b.status === 'Failed' ? 'Delivery Failed (Payment Denied)' : b.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {b.status === 'Failed' && (
                          <button 
                            onClick={() => handleRetryRestock(b.id)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-bold underline"
                          >
                            Retry Restock?
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {bills.filter(b => b.status === 'Paid' || b.status === 'Failed').length === 0 && (
                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No order history.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* EXPIRED TAB */}
          {activeTab === 'expired' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">Expired Products</h3>
                <span className="text-sm text-gray-500">{expired.length} items</span>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Stock</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Expiry</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Shelf Life</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Sold</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Last Sale</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Restock</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expired.map(p => (
                    <tr key={p.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.sku}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.stock}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.expiry_date}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.shelf_life_days || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.total_sold}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{p.last_sale || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <input type="number" min="1" className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={restockQty[p.id] || ''} onChange={e=>setRestockQty({...restockQty, [p.id]: e.target.value})} />
                          <button onClick={() => handleRestock(p.id)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 text-sm font-medium">Request Restock</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {expired.length === 0 && (
                    <tr><td colSpan="8" className="px-6 py-8 text-center text-gray-500">No expired items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* RATION ORDERS TAB */}
          {activeTab === 'ration_orders' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">Customer Monthly Ration Orders</h3>
                <button onClick={fetchRationOrders} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Refresh</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Order Details</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Products</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Payment</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Array.isArray(rationOrders) && rationOrders.map(order => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">#ORD-{order.id?.toString().padStart(6, '0')}</div>
                          <div className="text-xs text-gray-500">{order.created_at}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                          <div className="text-xs text-gray-500">{order.customer_phone}</div>
                          <div className="text-[10px] text-indigo-600 max-w-[150px] truncate" title={order.delivery_address}>{order.delivery_address}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs space-y-1">
                            {Array.isArray(order.items) && order.items.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="text-gray-600">{item.name} x {item.quantity}{item.unit}</div>
                            ))}
                            {Array.isArray(order.items) && order.items.length > 2 && <div className="text-indigo-500 font-medium">+{order.items.length - 2} more...</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">₹{parseFloat(order.total_amount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {order.payment_method} / {order.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            order.delivery_status === 'delivered' ? 'bg-green-100 text-green-700' : 
                            order.delivery_status === 'shipped' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {order.delivery_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          {order.payment_method === 'online' ? (
                            // Online Payment Flow: Payment is already done, show Ship or Deliver
                            <>
                              {order.delivery_status === 'pending' && (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateRationOrderStatus(order.id, { delivery_status: 'shipped' }); }}
                                  className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                                >
                                  Ship Order
                                </button>
                              )}
                              {order.delivery_status === 'shipped' && (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateRationOrderStatus(order.id, { delivery_status: 'delivered' }); }}
                                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                >
                                  Deliver
                                </button>
                              )}
                              {order.delivery_status === 'delivered' && (
                                <span className="text-xs text-green-600 font-bold flex items-center justify-end">
                                  <FaCheckCircle className="mr-1" /> Complete
                                </span>
                              )}
                            </>
                          ) : (
                            // COD Flow: Payment is pending, show Ship or Deliver (which marks as paid)
                            <>
                              {order.delivery_status === 'pending' && (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateRationOrderStatus(order.id, { delivery_status: 'shipped' }); }}
                                  className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                                >
                                  Ship Order
                                </button>
                              )}
                              {order.delivery_status === 'shipped' && (
                                <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); updateRationOrderStatus(order.id, { delivery_status: 'delivered', payment_status: 'paid' }); }}
                                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors"
                                >
                                  Deliver & Collect Cash
                                </button>
                              )}
                              {order.delivery_status === 'delivered' && (
                                <span className="text-xs text-green-600 font-bold flex items-center justify-end">
                                  <FaCheckCircle className="mr-1" /> Paid & Delivered
                                </span>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!Array.isArray(rationOrders) || rationOrders.length === 0) && (
                      <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No ration orders received yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
           )}
 
           {/* SUPPLIERS TAB */}
          {activeTab === 'suppliers' && (
            <div className="space-y-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Linked Suppliers</h3>
                  <span className="text-sm text-gray-500">{linkedSuppliers.length} linked</span>
                </div>
                {linkedSuppliers.length === 0 ? (
                  <p className="text-gray-500">No suppliers linked to your shop yet.</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Company Name</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Phone Number</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Address</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {linkedSuppliers.map(s => (
                        <tr key={s.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{s.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.company_name || s.name || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.phone || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.address || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Supplier Quotes</h3>
                  <button onClick={fetchRequests} className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">Refresh</button>
                </div>
                {requests.length === 0 ? (
                  <p className="text-gray-500">No restock requests yet.</p>
                ) : (
                  <div className="space-y-6">
                    {requests.map(r => (
                      <div key={r.id} className="border border-gray-100 rounded-lg">
                        <div className="px-6 py-4 flex items-center justify-between bg-gray-50">
                          <div>
                            <div className="font-semibold text-gray-900">
                              {r.product_name}
                              {r.unit_type && r.unit_value && (
                                <span className="ml-2 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold border border-indigo-100">
                                  {r.unit_value} {r.unit_type}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              Request #{r.id} • Qty {r.quantity} 
                              {r.unit_type && r.unit_value && ` (${r.unit_value} ${r.unit_type} packs)`} 
                              • {r.reason}
                            </div>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            r.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                            r.status === 'Shipped' ? 'bg-blue-100 text-blue-800' :
                            r.status === 'Paid' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>{r.status}</span>
                        </div>
                        <div className="p-6">
                          {r.quotes && r.quotes.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Unit Price</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Discount %</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">GST (18%)</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Grand Total</th>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                  <th className="px-4 py-2"></th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {r.quotes.sort((a,b)=>a.total-b.total).map(q => (
                                  <tr key={q.id}>
                                    <td className="px-4 py-2 text-sm">{q.supplier}</td>
                                    <td className="px-4 py-2 text-sm">₹{q.unit_price}</td>
                                    <td className="px-4 py-2 text-sm">{q.discount_percent}</td>
                                    <td className="px-4 py-2 text-sm text-gray-700 font-medium">₹{q.total.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500 italic">₹{(q.gst_amount || 0).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm font-bold text-green-700">₹{(q.grand_total || q.total).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm">
                                      {q.status === 'Accepted' ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Accepted</span>
                                      ) : q.status === 'Rejected' ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Rejected</span>
                                      ) : q.is_provisional ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Provisional</span>
                                      ) : (
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">{q.status}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right">
                                      {r.status === 'Awaiting Approval' || r.status === 'Quotes Received' || r.status === 'Pending' || r.status === 'Awaiting Selection' ? (
                                        q.status === 'Offered' ? (
                                          <button onClick={() => acceptQuote(q.id)} className="bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 text-sm font-medium">Accept</button>
                                        ) : q.is_provisional ? (
                                          <button onClick={() => acceptQuote(q.id)} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm font-medium">Accept Provisional</button>
                                        ) : null
                                      ) : null}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-sm text-gray-500">No quotes yet.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800">Available Suppliers</h3>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {suppliers.map(s => (
                      <tr key={s.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{s.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{s.company_name || s.name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.phone || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{s.address || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button onClick={() => handleAssignSupplier(s.id)} className="text-indigo-600 hover:text-indigo-900">
                            Add as Supplier
                          </button>
                        </td>
                      </tr>
                    ))}
                    {suppliers.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No suppliers available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SALESMEN / SALARY TAB */}
          {activeTab === 'salesmen' && (
            <div className="space-y-8">
              {role === 'salesman' ? (
                salesmanProfile ? (
                  <div className="max-w-4xl mx-auto space-y-6">
                    {/* Salary Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <StatCard 
                        title="Today's Sales" 
                        value={`${salesmanProfile.daily_sales_qty || 0} Items`} 
                        icon={FaShoppingCart} 
                        color="bg-blue-500" 
                      />
                      <StatCard 
                        title="Monthly Incentives" 
                        value={`₹${(salesmanProfile.incentives || 0)}`} 
                        icon={FaMoneyBillWave} 
                        color="bg-green-500" 
                      />
                      <StatCard 
                        title="Estimated Monthly Salary" 
                        value={`₹${(salesmanProfile.estimated_salary || 0)}`} 
                        icon={FaChartLine} 
                        color="bg-indigo-600"
                        subtext="Base 15,000 + Monthly Incentives"
                      />
                    </div>

                    {/* Profile Details */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                      <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                        <FaUsers className="mr-2 text-indigo-600" />
                        My Registration Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex flex-col p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                            <span className="text-xs text-indigo-400 uppercase font-bold mb-1">Automated Unique ID</span>
                            <span className="text-2xl font-mono font-black text-indigo-700">{salesmanProfile.salesman_id_code || 'N/A'}</span>
                          </div>
                          <div className="flex flex-col pt-2">
                            <span className="text-xs text-gray-400 uppercase font-bold">Full Name</span>
                            <span className="text-lg font-medium text-gray-800">{salesmanProfile.name || 'N/A'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 uppercase font-bold">Gender</span>
                            <span className="text-lg text-gray-700">{salesmanProfile.gender || 'Not specified'}</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 uppercase font-bold">Contact Number</span>
                            <span className="text-lg text-gray-700">{salesmanProfile.phone || 'N/A'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 uppercase font-bold">Mail ID</span>
                            <span className="text-lg text-gray-700">{salesmanProfile.email || 'Not provided'}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-400 uppercase font-bold">Bank Account Number</span>
                            <span className="text-lg font-mono text-gray-700">{salesmanProfile.account_number || 'Not provided'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-8 pt-6 border-t border-gray-100">
                        <div className="flex items-center text-sm text-gray-500">
                          <FaStore className="mr-2" />
                          Working at: <span className="ml-1 font-bold text-gray-800">{salesmanProfile.shop_name || 'My Store'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Individual Sales History for Salesman */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-800 flex items-center">
                          <FaHistory className="mr-2 text-indigo-600" />
                          My Recent Sales
                        </h3>
                        <span className="text-sm text-indigo-600 font-medium">{history.length} sales found</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Qty</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Badge</th>
                              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {history.slice(0, 10).map((record) => (
                              <tr key={record.id || Math.random()} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{String(record.date || 'N/A').split(' ')[0]}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.product_name || 'Unknown'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{record.quantity || 0}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {record.historical_badge && (
                                    <span className={`px-2 py-0.5 inline-flex text-[10px] font-bold rounded-full ${
                                      record.historical_badge === 'Most Sold' ? 'bg-green-100 text-green-800' :
                                      record.historical_badge === 'Moderately Sold' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-red-100 text-red-800'
                                    }`}>
                                      {record.historical_badge}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">₹{(record.total_price || 0)}</td>
                              </tr>
                            ))}
                            {history.length === 0 && (
                              <tr>
                                <td colSpan="5" className="px-6 py-8 text-center text-gray-500 italic">No sales recorded yet today.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {history.length > 10 && (
                        <div className="px-8 py-4 bg-gray-50 text-center border-t border-gray-100">
                          <button onClick={() => setActiveTab('history')} className="text-sm text-indigo-600 font-bold hover:underline">View All My Sales History</button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                    <p className="text-gray-500 font-medium">{profileError || 'Loading your salary and profile details...'}</p>
                    {profileError && (
                      <button 
                        onClick={fetchSalesmanProfile}
                        className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                      >
                        Try Again
                      </button>
                    )}
                  </div>
                )
              ) : role === 'shop_owner' ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-800">Salesman Performance & Details</h3>
                    <button onClick={fetchSalesmen} className="text-sm text-indigo-600 hover:underline">Refresh Data</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Salesman ID</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Today's Sales</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Incentives</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Monthly Salary</th>
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {salesmen.map(s => (
                          <tr key={s.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600">{s.salesman_id_code}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.name}</td>
                            <td className="px-6 py-4 text-xs text-gray-500">
                              <div>{s.email}</div>
                              <div>{s.phone}</div>
                              <div className="font-medium text-indigo-600">{s.gender}</div>
                              <div className="italic text-[10px] mt-1">Acc: {s.account_number || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.daily_sales_qty} items</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-bold">₹{(s.incentives || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">₹{(s.estimated_salary || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                              <button onClick={() => handleDeleteSalesman(s.id)} className="text-red-600 hover:text-red-800">
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {salesmen.length === 0 && (
                          <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No salesmen registered yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>

      {/* QUICK SELL MODAL */}
      {showSellModal && sellingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 px-8 py-6 text-white">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Quick Sell</h3>
                <button onClick={() => setShowSellModal(false)} className="text-white hover:text-indigo-100">
                  <FaPlusCircle className="transform rotate-45 text-2xl" />
                </button>
              </div>
              <p className="text-indigo-100 text-sm mt-1">{sellingProduct.name} (Stock: {selectedUnit ? selectedUnit.stock_quantity : sellingProduct.stock})</p>
            </div>
            
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Salesman Identity - Restored as requested */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Selling as</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUsers className="text-gray-400" />
                  </div>
                  <div className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl font-bold ${
                    profileError ? 'border-red-200 bg-red-50 text-red-700' : 'border-indigo-100 bg-indigo-50 text-indigo-700'
                  }`}>
                    {salesmanProfile ? `${salesmanProfile.name} (ID: ${salesmanProfile.salesman_id_code})` : (profileError || 'Fetching identity...')}
                  </div>
                </div>
              </div>

              {/* Customer Details - Added as "Sell To" */}
              <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 space-y-4">
                <h4 className="text-sm font-bold text-gray-800 flex items-center border-b border-gray-200 pb-2">
                  <FaUserTag className="mr-2 text-indigo-600" /> Sell To:
                </h4>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Contact Number</label>
                      <input 
                        type="text" 
                        placeholder="10-digit phone" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                        value={sellCustomer.phone}
                        maxLength="10"
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setSellCustomer({ ...sellCustomer, phone: val });
                          if (val.length === 10) handleSearchCustomer(val);
                        }}
                      />
                      {isSearchingCustomer && <p className="text-[10px] text-indigo-600 animate-pulse mt-1">Searching...</p>}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Full Name</label>
                      <input 
                        type="text" 
                        placeholder="Customer Name" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                        value={sellCustomer.name}
                        onChange={(e) => setSellCustomer({ ...sellCustomer, name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Mail ID</label>
                      <input 
                        type="email" 
                        placeholder="customer@example.com" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                        value={sellCustomer.email}
                        onChange={(e) => setSellCustomer({ ...sellCustomer, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date of Birth</label>
                      <input 
                        type="date" 
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                        value={sellCustomer.dob}
                        onChange={(e) => setSellCustomer({ ...sellCustomer, dob: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Address (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="Customer Address" 
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                      value={sellCustomer.address}
                      onChange={(e) => setSellCustomer({ ...sellCustomer, address: e.target.value })}
                    />
                  </div>

                  {sellCustomer.phone && !isSearchingCustomer && (
                    <div className="flex items-center space-x-2 pt-1">
                      <input 
                        type="checkbox" 
                        id="save_profile"
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                        checked={sellCustomer.save_profile}
                        onChange={(e) => setSellCustomer({ ...sellCustomer, save_profile: e.target.checked })}
                      />
                      <label htmlFor="save_profile" className="text-xs text-indigo-700 font-bold">Register / Remember Customer</label>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Scan Section - Restored as requested */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Scan Product (OQ Code)</label>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaBox className="text-gray-400" />
                      </div>
                      <input 
                        type="text" 
                        placeholder="Scan code..." 
                        className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl outline-none transition-all ${
                          isScanned ? 'border-green-500 bg-green-50' : 'border-gray-100 bg-gray-50 focus:border-indigo-500'
                        }`}
                        value={scannedCode}
                        onChange={(e) => {
                          setScannedCode(e.target.value);
                          if (e.target.value === sellingProduct.qr_code) setIsScanned(true);
                          else setIsScanned(false);
                        }}
                      />
                    </div>
                    <button 
                      onClick={() => {
                        setScannedCode(sellingProduct.qr_code);
                        setIsScanned(true);
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 text-xs font-bold"
                    >
                      Simulate Barcode
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Expected Code: <span className="font-mono text-indigo-600 font-bold">{sellingProduct.qr_code}</span></p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity of Product</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input 
                      type="number" 
                      min="1" 
                      max={selectedUnit ? selectedUnit.stock_quantity : sellingProduct.stock}
                      className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 bg-gray-50 outline-none focus:border-indigo-500"
                      value={sellQuantity}
                      onChange={(e) => setSellQuantity(parseInt(e.target.value) || 1)}
                    />
                    {sellingProduct.unit_options && sellingProduct.unit_options.length > 0 ? (
                      <select
                        className="w-full border-2 border-gray-100 rounded-xl px-4 py-3 bg-gray-50 outline-none focus:border-indigo-500 text-sm font-medium"
                        value={selectedUnit?.id || ''}
                        onChange={(e) => {
                          const opt = sellingProduct.unit_options.find(o => o.id === parseInt(e.target.value));
                          setSelectedUnit(opt);
                        }}
                      >
                        {sellingProduct.unit_options.map(opt => (
                          <option key={opt.id} value={opt.id}>
                            {opt.unit_value} {opt.unit_type} - ₹{opt.selling_price}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center px-4 py-3 bg-gray-100 rounded-xl text-gray-500 text-sm italic">
                        Standard Unit
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                {sellCustomer.is_birthday && sellCustomer.birthday_discount > 0 && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl border border-indigo-200 animate-pulse">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">🎂</span>
                        <div>
                          <p className="text-xs font-bold text-indigo-800 uppercase">Birthday Offer Applied!</p>
                          <p className="text-lg font-black text-indigo-600">{sellCustomer.birthday_discount}% Discount</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Code</p>
                        <p className="font-mono text-xs font-bold text-indigo-700">{sellCustomer.offer_code}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center mb-4">
                  <span className="text-gray-500">Total Price</span>
                  <div className="text-right">
                    {(() => {
                      const currentPrice = selectedUnit ? selectedUnit.selling_price : sellingProduct.price;
                      const baseTotal = currentPrice * sellQuantity;
                      if (sellCustomer.is_birthday && sellCustomer.birthday_discount > 0) {
                        return (
                          <>
                            <span className="text-sm line-through text-gray-400 mr-2">₹{baseTotal.toFixed(2)}</span>
                            <span className="text-xl font-bold text-green-600">
                              ₹{(baseTotal * (1 - sellCustomer.birthday_discount / 100)).toFixed(2)}
                            </span>
                          </>
                        );
                      }
                      return <span className="text-xl font-bold text-green-600">₹{baseTotal.toFixed(2)}</span>;
                    })()}
                  </div>
                </div>
                <button 
                  onClick={handleSellProduct}
                  disabled={!isScanned}
                  className={`w-full py-4 rounded-xl font-bold text-white transition-all shadow-lg ${
                    !isScanned ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:transform active:scale-95'
                  }`}
                >
                    {isScanned ? 'Confirm Sell' : 'Scan Product to Continue'}
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEMO PAYMENT MODAL */}
      {showPaymentModal && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 px-8 py-6 text-white">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Secure Checkout</h3>
                <button onClick={() => !isPaying && setShowPaymentModal(false)} className="text-white hover:text-indigo-100 transition-colors">
                  <FaPlusCircle className="transform rotate-45 text-2xl" />
                </button>
              </div>
              <p className="text-indigo-100 text-sm mt-1">Order Summary: {selectedBill.product}</p>
            </div>
            
            <div className="p-8">
              <div className="mb-8 border-b border-gray-100 pb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-gray-500 text-sm">Subtotal</span>
                  <span className="text-gray-700 font-medium">₹{selectedBill.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-500 text-sm">GST (18%)</span>
                  <span className="text-gray-700 font-medium">₹{(selectedBill.gst_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                  <span className="text-gray-600 font-bold">Total Payable</span>
                  <span className="text-2xl font-bold text-indigo-600">₹{(selectedBill.grand_total || selectedBill.total).toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-400 mt-2 italic text-right">Supplier: {selectedBill.supplier}</div>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Card Number</label>
                  <div className="flex items-center border-2 border-gray-100 rounded-xl px-4 py-3 bg-gray-50">
                    <FaMoneyBillWave className="text-gray-400 mr-3" />
                    <input type="text" placeholder="XXXX XXXX XXXX 1234" className="bg-transparent w-full outline-none text-gray-700" readOnly />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Expiry</label>
                    <input type="text" placeholder="MM/YY" className="border-2 border-gray-100 rounded-xl px-4 py-3 bg-gray-50 w-full outline-none text-gray-700" readOnly />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">CVV</label>
                    <input type="text" placeholder="XXX" className="border-2 border-gray-100 rounded-xl px-4 py-3 bg-gray-50 w-full outline-none text-gray-700" readOnly />
                  </div>
                </div>
              </div>

              <button 
                onClick={processPayment}
                disabled={isPaying}
                className={`w-full mt-8 py-4 rounded-xl font-bold text-white transition-all shadow-lg ${
                  isPaying ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:transform active:scale-95'
                }`}
              >
                {isPaying ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Processing Payment...
                  </div>
                ) : (
                  `Pay ₹${(selectedBill.grand_total || selectedBill.total).toFixed(2)}`
                )}
              </button>
              
              <p className="text-center text-xs text-gray-400 mt-6 flex items-center justify-center">
                <FaBox className="mr-2" /> Secure 256-bit SSL Encrypted Payment
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShopDashboard;
