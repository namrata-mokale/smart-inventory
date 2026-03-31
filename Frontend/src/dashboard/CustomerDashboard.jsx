import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaStore, FaHistory, FaSignOutAlt, FaMapMarkerAlt, FaPhone, FaEnvelope, FaIdCard, FaLink, FaCalendarAlt, FaClipboardList, FaPlus, FaTrash, FaCheckCircle, FaEdit, FaQrcode } from 'react-icons/fa';
import { API_BASE_URL } from '../config';

const CustomerDashboard = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState(null);
  const [shops, setShops] = useState([]);
  const [history, setHistory] = useState([]);
  const [offers, setOffers] = useState([]);
  const [birthdayOffers, setBirthdayOffers] = useState([]);
  const [linking, setLinking] = useState(false);
  const [selectedShopForRation, setSelectedShopForRation] = useState(null);
  const [shopProducts, setShopProducts] = useState([]);
  const [monthlyRation, setMonthlyRation] = useState([]);
  const [existingRations, setExistingRations] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [isSavingRation, setIsSavingRation] = useState(false);
  const [isSubmittingRation, setIsSubmittingRation] = useState(false);
  const [myRationOrders, setMyRationOrders] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [deliveryDetails, setDeliveryDetails] = useState({
    name: '',
    address: '',
    phone: ''
  });

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) navigate('/login');
    fetchProfile();
    fetchShops();
    fetchHistory();
    fetchOffers();
    fetchBirthdayOffers();
    fetchExistingRations();
    fetchMyRationOrders();
  }, []);

  const fetchMyRationOrders = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/my-ration-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        console.log("DEBUG: My Ration Orders:", data);
        setMyRationOrders(data);
      }
    } catch (e) { console.error(e); }
  };

  const fetchExistingRations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/monthly-ration`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const rations = await res.json();
        setExistingRations(rations);
        
        // If we have a selected shop, update the current ration state with its items
        if (selectedShopForRation) {
          const existing = rations.find(r => r.shop_id === selectedShopForRation.id);
          if (existing) {
            // Map the items to include the all_options for UI consistency
            const itemsWithOpts = existing.items.map(item => {
              // Find the full product from shopProducts to get its unit_options
              const fullProd = shopProducts.find(p => p.id === item.product_id);
              return {
                ...item,
                all_options: fullProd ? fullProd.unit_options : []
              };
            });
            setMonthlyRation(itemsWithOpts);
          }
        }
      }
    } catch (e) { console.error(e); }
  };

  const fetchShopProducts = async (shopId) => {
    setLoadingProducts(true);
    setShopProducts([]); // Clear previous products immediately
    try {
      const res = await fetch(`${API_BASE_URL}/customers/shop-products/${shopId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const products = await res.json();
        setShopProducts(products);
        
        // Load existing ration for this shop if any
        const existing = existingRations.find(r => r.shop_id === shopId);
        if (existing) {
          // Ensure items have their unit options for the dropdowns
          const itemsWithOpts = existing.items.map(item => {
            const fullProd = products.find(p => p.id === item.product_id);
            return {
              ...item,
              all_options: fullProd ? fullProd.unit_options : []
            };
          });
          setMonthlyRation(itemsWithOpts);
        } else {
          setMonthlyRation([]);
        }
      } else {
        console.error(`Error fetching products: ${res.status}`);
        alert("Failed to load products for this shop.");
      }
    } catch (e) { 
      console.error(e);
      alert("Network error while loading products.");
    } finally {
      setLoadingProducts(false);
    }
  };

  const addToRation = (product) => {
    const exists = monthlyRation.find(item => item.product_id === product.id);
    if (exists) return;
    
    // Default to the first unit variation if available, otherwise fallback
    const firstOption = product.unit_options?.length > 0 ? product.unit_options[0] : null;
    
    setMonthlyRation([...monthlyRation, {
      product_id: product.id,
      product_name: product.name,
      quantity: 1,
      unit: firstOption ? `${firstOption.unit_value} ${firstOption.unit_type}` : 'units',
      price: firstOption ? firstOption.selling_price : product.price,
      unit_option_id: firstOption ? firstOption.id : null,
      all_options: product.unit_options || []
    }]);
  };

  const updateRationItem = (productId, field, value) => {
    setMonthlyRation(monthlyRation.map(item => {
      if (item.product_id === productId) {
        if (field === 'unit_option_id') {
          const selectedOpt = item.all_options.find(opt => opt.id === parseInt(value));
          if (selectedOpt) {
            return { 
              ...item, 
              unit_option_id: selectedOpt.id, 
              unit: `${selectedOpt.unit_value} ${selectedOpt.unit_type}`,
              price: selectedOpt.selling_price 
            };
          }
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const removeFromRation = (productId) => {
    setMonthlyRation(monthlyRation.filter(item => item.product_id !== productId));
  };

  const saveRation = async () => {
    if (!selectedShopForRation) return;
    setIsSavingRation(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/monthly-ration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shop_id: selectedShopForRation.id,
          items: monthlyRation
        })
      });
      if (res.ok) {
        alert('Monthly ration saved successfully');
        fetchExistingRations();
      }
    } catch (e) { console.error(e); }
    setIsSavingRation(false);
  };

  const [selectedBirthdayOffer, setSelectedBirthdayOffer] = useState(null);

  const submitRation = async (rationId, paymentMethod) => {
    console.log("DEBUG: submitRation called", { rationId, paymentMethod, selectedBirthdayOffer });
    if (!rationId) {
      alert("Error: Ration ID is missing.");
      return;
    }

    if (!deliveryDetails.name || !deliveryDetails.address || !deliveryDetails.phone) {
      alert("Please fill in all delivery details (Name, Address, Phone).");
      return;
    }

    if (deliveryDetails.phone.length !== 10) {
      alert("Please enter a valid 10-digit phone number.");
      return;
    }

    setIsSubmittingRation(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/submit-ration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          ration_id: rationId,
          payment_method: paymentMethod,
          delivery_name: deliveryDetails.name,
          delivery_phone: deliveryDetails.phone,
          delivery_address: deliveryDetails.address,
          birthday_offer_code: selectedBirthdayOffer ? selectedBirthdayOffer.offer_code : null
        })
      });
      
      const result = await res.json();
      console.log("DEBUG: submitRation response", result);

      if (res.ok) {
        console.log("DEBUG: Order success result:", result);
        
        // Use local deliveryDetails as primary for the alert to ensure NO "N/A"
        const finalName = deliveryDetails.name || result.bill?.name || "Customer";
        const finalAddress = deliveryDetails.address || result.bill?.address || "Address provided";
        const finalTotal = result.bill?.total || result.total || (pendingOrder.items || []).reduce((acc, i) => {
          const itemTotal = i.price * i.quantity;
          const discountFactor = selectedBirthdayOffer ? (1 - selectedBirthdayOffer.discount_percent / 100) : 1;
          const gstRate = i.gst_rate || 0.18;
          return acc + (itemTotal * discountFactor * (1 + gstRate));
        }, 0);
        const finalOrderId = result.order_id || result.bill?.order_id || "NEW";
        
        alert(`✅ Order Placed Successfully!\n\nOrder ID: #ORD-${finalOrderId}\nCustomer: ${finalName}\nTotal: ₹${parseFloat(finalTotal).toFixed(2)}\nDelivery to: ${finalAddress}${selectedBirthdayOffer ? `\n\n🎂 Birthday Discount Applied: ${selectedBirthdayOffer.discount_percent}% OFF` : ''}`);
        
        setShowPaymentModal(false);
        setShowQR(false);
        setDeliveryDetails({ name: '', address: '', phone: '' }); // Reset local form
        setSelectedBirthdayOffer(null); // Reset offer
        fetchExistingRations();
        fetchMyRationOrders();
        fetchBirthdayOffers(); // Refresh offers (to hide used one)
      } else {
        alert(`❌ Failed to place order: ${result.message || "Unknown error"}`);
      }
    } catch (e) { 
      console.error("DEBUG: submitRation error", e);
      alert(`Network error: ${e.message}`);
    } finally {
      setIsSubmittingRation(false);
    }
  };

  useEffect(() => {
    if (profile && (!profile.linked_shops || profile.linked_shops.length === 0)) {
      setActiveTab('shops');
    }
  }, [profile]);

  const fetchBirthdayOffers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/birthday-offers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setBirthdayOffers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchOffers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/offers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setOffers(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProfile(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchShops = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/customers/all-shops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setShops(await res.json());
    } catch (e) { console.error(e); }
  };

  const handleLinkShop = async (shopId) => {
    setLinking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/customers/link-shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ shop_id: shopId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchProfile();
      } else {
        alert(data.message || 'Failed to link shop');
      }
    } catch (e) { 
      alert(`Network/Server Error: ${e.message}`);
    }
    setLinking(false);
  };

  const SidebarItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => {
        console.log(`DEBUG: Customer switching to tab ${id}`);
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

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <div className="w-72 bg-indigo-800 text-white shadow-xl flex flex-col">
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <FaUser className="text-indigo-300" />
            <span>Customer Portal</span>
          </h1>
          <p className="text-indigo-300 text-sm mt-1">SmartStore Rewards</p>
        </div>
        
        <nav className="flex-1 mt-6">
          <SidebarItem id="profile" icon={FaUser} label="My Profile" />
          <SidebarItem id="shops" icon={FaStore} label="Browse Shops" />
          <SidebarItem id="history" icon={FaHistory} label="My Purchases" />
          <SidebarItem id="ration" icon={FaClipboardList} label="Monthly Ration" />
          <SidebarItem id="my-orders" icon={FaClipboardList} label="My Ration Orders" />
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
        <header className="bg-white shadow-sm px-8 py-5 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            {activeTab === 'profile' && 'My Profile'}
            {activeTab === 'shops' && 'Partner Shops'}
            {activeTab === 'history' && 'Purchase History'}
            {activeTab === 'ration' && 'Monthly Ration Planning'}
            {activeTab === 'my-orders' && 'My Ration Orders'}
          </h2>
          {profile && (
            <div className="flex items-center space-x-4">
               <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{profile.name}</p>
                  <p className="text-xs text-gray-500">{profile.customer_id_code}</p>
               </div>
               <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
                  {profile.name[0].toUpperCase()}
               </div>
            </div>
          )}
        </header>

        <main className="p-8">
          {birthdayOffers.length > 0 && (
            <div className="mb-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl p-6 text-white shadow-lg animate-bounce-slow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-4xl">🎂</div>
                  <div>
                    <h3 className="text-xl font-bold">Happy Birthday, {profile?.name}!</h3>
                    <p className="text-indigo-100">You have special birthday discounts waiting for you!</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {birthdayOffers.map(offer => (
                  <div key={offer.id} className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-100">{offer.shop_name}</p>
                        <p className="text-2xl font-black">{offer.discount_percent}% OFF</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="bg-white text-indigo-600 text-[10px] px-2 py-1 rounded-full font-bold mb-2">ACTIVE</div>
                        <div className="bg-indigo-900/40 border border-white/20 px-2 py-1 rounded font-mono text-[10px] font-bold tracking-wider">
                          {offer.offer_code}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm mt-2 text-indigo-50">{offer.offer_text}</p>
                    <p className="text-[10px] mt-2 text-indigo-200 font-medium italic">Valid until: {offer.valid_until}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {profile && (!profile.linked_shops || profile.linked_shops.length === 0) && (
            <div className="mb-8 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-6 text-center animate-pulse">
              <FaStore className="mx-auto text-indigo-400 text-4xl mb-3" />
              <h3 className="text-xl font-bold text-indigo-900">Welcome to SmartStore!</h3>
              <p className="text-indigo-600 font-medium">Please link at least one shop below to start earning rewards and tracking purchases.</p>
            </div>
          )}

          {activeTab === 'profile' && profile && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <div className="flex items-center space-x-6 mb-8">
                  <div className="h-24 w-24 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-4xl font-bold">
                    {profile.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-800">{profile.name}</h3>
                    <p className="text-indigo-600 font-semibold">{profile.customer_id_code}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-3 p-4 bg-indigo-50 rounded-xl col-span-2 border border-indigo-100">
                    <div className="h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl">
                      <FaHistory />
                    </div>
                    <div>
                      <p className="text-xs text-indigo-600 uppercase font-bold tracking-wider">SmartStore Rewards Points</p>
                      <p className="text-2xl font-black text-indigo-900">{profile.loyalty_points || 0} Points</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                    <FaEnvelope className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Email</p>
                      <p className="text-gray-800">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl">
                    <FaPhone className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Phone</p>
                      <p className="text-gray-800">{profile.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl col-span-1">
                    <FaCalendarAlt className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Date of Birth</p>
                      <p className="text-gray-800">{profile.dob || 'Not provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl col-span-2">
                    <FaMapMarkerAlt className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold">Address</p>
                      <p className="text-gray-800">{profile.address || 'No address provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-900 flex items-center space-x-2 mb-4">
                    <FaStore />
                    <span>Linked Shops</span>
                  </h4>
                  {profile.linked_shops && profile.linked_shops.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        {profile.linked_shops.map(shop => (
                          <div 
                            key={shop.id} 
                            onClick={() => {
                              setActiveTab('ration');
                              setSelectedShopForRation(shop);
                              fetchShopProducts(shop.id);
                            }}
                            className="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm flex justify-between items-center cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
                          >
                            <div>
                              <p className="font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">{shop.name}</p>
                              <p className="text-xs text-gray-500">{shop.location}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-1 rounded-full font-bold uppercase">Linked</span>
                              <FaClipboardList className="text-indigo-300 group-hover:text-indigo-600 transition-colors" />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {offers.length > 0 && (
                        <div className="mt-6 bg-white rounded-xl p-4 border border-indigo-100 shadow-sm">
                          <h5 className="text-sm font-bold text-indigo-800 mb-3 flex items-center">
                            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full mr-2">LIVE OFFERS</span>
                            Available Clearance Discounts
                          </h5>
                          <div className="grid grid-cols-1 gap-3">
                            {offers.map(offer => (
                              <div key={offer.id} className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-lg border border-indigo-50">
                                <div>
                                  <p className="font-bold text-gray-800 text-sm">{offer.name}</p>
                                  <p className="text-[10px] text-gray-500">Expires: {offer.expiry_date}</p>
                                </div>
                                <div className="text-right">
                                  <span className="line-through text-[10px] text-gray-400">₹{offer.original_price}</span>
                                  <p className="text-red-600 font-black text-sm">₹{offer.discounted_price}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-indigo-600 italic text-sm">No shops linked. Browse shops to link and start earning rewards!</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shops' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shops.map(shop => (
                <div key={shop.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
                      <FaStore className="text-xl" />
                    </div>
                    {profile?.linked_shops?.some(s => s.name === shop.name) && (
                      <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-bold">Linked</span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">{shop.name}</h3>
                  <p className="text-gray-500 text-sm flex items-center mt-1">
                    <FaMapMarkerAlt className="mr-2" /> {shop.location}
                  </p>
                  <div className="mt-6">
                    {profile?.linked_shops?.some(s => s.name === shop.name) ? (
                      <button disabled className="w-full py-2 bg-gray-100 text-gray-400 font-bold rounded-lg cursor-not-allowed">
                        Already Linked
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleLinkShop(shop.id)}
                        disabled={linking}
                        className="w-full py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        {linking ? 'Linking...' : 'Link to Shop'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {history.length > 0 ? (
                history.map(sale => (
                  <div key={sale.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Transaction ID</span>
                        <p className="text-sm font-mono font-bold text-gray-800">#TRX-{sale.id.toString().padStart(6, '0')}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Date</span>
                        <p className="text-sm font-bold text-gray-800">{sale.date}</p>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                          <FaStore />
                        </div>
                        <h4 className="font-bold text-gray-800 text-lg">{sale.shop_name}</h4>
                      </div>
                      <div className="space-y-3">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">
                              {item.product_name}
                              <span className="text-gray-400"> x{item.quantity}</span>
                              {item.unit && (
                                <span className="ml-2 bg-indigo-50 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  {item.unit}
                                </span>
                              )}
                            </span>
                            <span className="font-semibold text-gray-800">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center">
                        <span className="font-bold text-gray-800">Total Amount</span>
                        <span className="text-xl font-black text-indigo-600">₹{sale.total_amount.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center py-20">
                  <FaHistory className="mx-auto text-gray-200 text-6xl mb-4" />
                  <h3 className="text-xl font-bold text-gray-800">No Purchase History</h3>
                  <p className="text-gray-500 mt-2">Start shopping at our partner stores to see your records here.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'ration' && (
            <div className="space-y-8">
              {/* Shop Selection for Ration */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <FaStore className="mr-2 text-indigo-600" />
                  Select Linked Shop for Ration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {profile?.linked_shops?.map(shop => (
                    <button
                      key={shop.id}
                      onClick={() => {
                        setSelectedShopForRation(shop);
                        fetchShopProducts(shop.id);
                      }}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedShopForRation?.id === shop.id
                          ? 'border-indigo-600 bg-indigo-50 shadow-sm'
                          : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-bold text-gray-800">{shop.name}</p>
                      <p className="text-xs text-gray-500">{shop.location}</p>
                      {existingRations.some(r => r.shop_id === shop.id) && (
                        <span className="mt-2 inline-block bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">HAS RATION</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedShopForRation && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Product Catalog */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <FaPlus className="mr-2 text-indigo-600" />
                        Available Products
                      </h3>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                        {shopProducts.length} Items
                      </span>
                    </div>
                    
                    {loadingProducts ? (
                      <div className="text-center py-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="text-gray-500 mt-4 font-medium">Loading products...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {shopProducts.map(product => (
                          <div key={product.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-indigo-50/50 transition-colors border border-transparent hover:border-indigo-100 group">
                            <div>
                              <p className="font-bold text-gray-800">{product.name}</p>
                              <p className="text-xs text-gray-500">{product.category} • ₹{product.price}</p>
                            </div>
                            <button
                              onClick={() => addToRation(product)}
                              disabled={monthlyRation.some(item => item.product_id === product.id)}
                              className={`p-2 rounded-lg transition-all ${
                                monthlyRation.some(item => item.product_id === product.id)
                                  ? 'bg-green-100 text-green-600'
                                  : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              {monthlyRation.some(item => item.product_id === product.id) ? <FaCheckCircle /> : <FaPlus />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* My Monthly Ration */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <FaClipboardList className="mr-2 text-indigo-600" />
                        My Monthly Ration
                      </h3>
                      <div className="flex space-x-2">
                        <button 
                          onClick={saveRation}
                          disabled={isSavingRation || monthlyRation.length === 0}
                          className="text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 flex items-center"
                        >
                          {isSavingRation ? 'Saving...' : 'Save Draft'}
                        </button>
                        {existingRations.find(r => r.shop_id === selectedShopForRation.id) && (
                          <button 
                            onClick={() => {
                              setPendingOrder(existingRations.find(r => r.shop_id === selectedShopForRation.id));
                              setShowPaymentModal(true);
                            }}
                            disabled={isSubmittingRation || monthlyRation.length === 0}
                            className="text-xs font-bold bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:bg-gray-300 flex items-center"
                          >
                            <FaCheckCircle className="mr-1" />
                            Place Order
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {monthlyRation.length > 0 ? (
                        monthlyRation.map(item => (
                          <div key={item.product_id} className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                            <div className="flex justify-between items-start">
                              <p className="font-bold text-gray-800">{item.product_name}</p>
                              <button onClick={() => removeFromRation(item.product_id)} className="text-red-400 hover:text-red-600 p-1">
                                <FaTrash size={14} />
                              </button>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex-1">
                                <label className="text-[10px] uppercase font-black text-indigo-400 block mb-1">Quantity</label>
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  value={item.quantity}
                                  onChange={(e) => updateRationItem(item.product_id, 'quantity', parseFloat(e.target.value))}
                                  className="w-full bg-white border border-indigo-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] uppercase font-black text-indigo-400 block mb-1">Unit / Variation</label>
                                {item.all_options && item.all_options.length > 0 ? (
                                  <select
                                    value={item.unit_option_id || ''}
                                    onChange={(e) => updateRationItem(item.product_id, 'unit_option_id', e.target.value)}
                                    className="w-full bg-white border border-indigo-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-indigo-700"
                                  >
                                    {item.all_options.map(opt => (
                                      <option key={opt.id} value={opt.id}>
                                        {opt.unit_value} {opt.unit_type} - ₹{opt.selling_price}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <select
                                    value={item.unit}
                                    onChange={(e) => updateRationItem(item.product_id, 'unit', e.target.value)}
                                    className="w-full bg-white border border-indigo-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                  >
                                    <option value="kg">kg (Kilograms)</option>
                                    <option value="grams">grams</option>
                                    <option value="litres">litres</option>
                                    <option value="ml">ml (Millilitres)</option>
                                    <option value="units">units / pcs</option>
                                    <option value="packets">packets</option>
                                  </select>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-indigo-50">
                              <span className="text-xs text-indigo-400 font-medium">Estimated Total:</span>
                              <span className="text-sm font-black text-indigo-600">₹{(item.price * (item.quantity || 0)).toLocaleString('en-IN')}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          <FaPlus className="mx-auto text-gray-300 text-4xl mb-3" />
                          <p className="text-gray-500 font-medium">No items in ration yet.</p>
                          <p className="text-xs text-gray-400 mt-1">Select products from the catalog to add them.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'my-orders' && (
            <div className="space-y-6">
              {myRationOrders.length > 0 ? (
                myRationOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <div>
                        <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Order ID</span>
                        <p className="text-sm font-mono font-bold text-gray-800">#ORD-{order.id.toString().padStart(6, '0')}</p>
                      </div>
                      <div className="text-right flex space-x-4">
                        <div>
                          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Status</span>
                          <p className={`text-sm font-bold uppercase ${
                            order.delivery_status === 'delivered' ? 'text-green-600' : 
                            order.delivery_status === 'shipped' ? 'text-blue-600' : 'text-orange-600'
                          }`}>{order.delivery_status}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Date</span>
                          <p className="text-sm font-bold text-gray-800">{order.created_at}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                            <FaStore className="mr-2 text-indigo-600" />
                            {order.shop_name}
                          </h4>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-600">
                                  {item.product_name || item.name} 
                                  <span className="text-gray-400"> ({item.quantity} {item.unit})</span>
                                </span>
                                <span className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                            <div className="pt-2 border-t flex justify-between font-bold text-indigo-600">
                              <span>Total Amount</span>
                              <span>₹{order.total_amount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="bg-indigo-50/50 p-4 rounded-xl space-y-3">
                          <h5 className="text-xs font-black uppercase text-indigo-400">Delivery & Payment Bill</h5>
                          <div className="text-sm space-y-2">
                            <p className="flex justify-between">
                              <span className="text-gray-500">Payment Mode:</span>
                              <span className="font-bold uppercase">{order.payment_method}</span>
                            </p>
                            <p className="flex justify-between">
                              <span className="text-gray-500">Payment Status:</span>
                              <span className={`font-bold uppercase ${order.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>
                                {order.payment_status}
                              </span>
                            </p>
                            <p className="pt-2 border-t border-indigo-100">
                              <span className="text-gray-500 block mb-1">Delivery Address:</span>
                              <span className="font-medium text-gray-800">{order.delivery_address}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center py-20">
                  <FaClipboardList className="mx-auto text-gray-200 text-6xl mb-4" />
                  <h3 className="text-xl font-bold text-gray-800">No Ration Orders Yet</h3>
                  <p className="text-gray-500 mt-2">Place your first monthly ration order from the Planning tab.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && pendingOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-indigo-600 p-6 text-white text-center relative shrink-0">
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
              >
                <FaPlus className="transform rotate-45 text-xl" />
              </button>
              <h3 className="text-xl font-bold">Complete Your Order</h3>
              <p className="text-indigo-100 text-sm mt-1">Select payment method for your monthly ration</p>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              {!showQR ? (
                <>
                  {/* Delivery Details Form */}
                  <div className="space-y-4 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-xs font-black uppercase text-indigo-400 tracking-wider">Delivery Details</h4>
                    <div className="space-y-3">
                      <div>
                        <input
                          type="text"
                          placeholder="Recipient Name"
                          value={deliveryDetails.name}
                          onChange={(e) => setDeliveryDetails({ ...deliveryDetails, name: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          maxLength="10"
                          placeholder="Phone Number (10 digits)"
                          value={deliveryDetails.phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, ''); // Numeric only
                            if (val.length <= 10) setDeliveryDetails({ ...deliveryDetails, phone: val });
                          }}
                          className={`w-full bg-white border rounded-xl px-4 py-3 text-sm focus:ring-2 outline-none transition-all ${
                            deliveryDetails.phone.length > 0 && deliveryDetails.phone.length !== 10 
                              ? 'border-red-300 focus:ring-red-500' 
                              : 'border-gray-200 focus:ring-indigo-500'
                          }`}
                        />
                        {deliveryDetails.phone.length > 0 && deliveryDetails.phone.length !== 10 && (
                          <p className="text-[10px] text-red-500 mt-1 ml-1 font-bold italic">Must be exactly 10 digits</p>
                        )}
                      </div>
                      <div>
                        <textarea
                          placeholder="Delivery Address"
                          rows="2"
                          value={deliveryDetails.address}
                          onChange={(e) => setDeliveryDetails({ ...deliveryDetails, address: e.target.value })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        ></textarea>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Birthday Offer Selection */}
                    {birthdayOffers.some(o => o.shop_id === pendingOrder.shop_id) && (
                      <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
                        <label className="text-xs font-black uppercase text-purple-600 tracking-wider flex items-center mb-2">
                          <span className="mr-2">🎂</span> Birthday Discount Available!
                        </label>
                        <select 
                          className="w-full bg-white border border-purple-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-bold text-purple-700"
                          value={selectedBirthdayOffer?.id || ''}
                          onChange={(e) => {
                            const offer = birthdayOffers.find(o => o.id === parseInt(e.target.value));
                            setSelectedBirthdayOffer(offer || null);
                          }}
                        >
                          <option value="">Don't apply discount</option>
                          {birthdayOffers.filter(o => o.shop_id === pendingOrder.shop_id).map(offer => (
                            <option key={offer.id} value={offer.id}>
                              {offer.discount_percent}% OFF - {offer.offer_code}
                            </option>
                          ))}
                        </select>
                        {selectedBirthdayOffer && (
                          <p className="text-[10px] text-purple-500 mt-2 font-medium italic">
                            Discount of ₹{(( (pendingOrder.items || []).reduce((acc, i) => acc + (i.price * i.quantity), 0) * selectedBirthdayOffer.discount_percent ) / 100).toFixed(2)} will be applied!
                          </p>
                        )}
                      </div>
                    )}

                    <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
                      <span className="text-gray-600 font-medium">Items Subtotal:</span>
                      <div className="text-right">
                        {selectedBirthdayOffer && (
                          <span className="text-xs text-gray-400 line-through block">₹{ (pendingOrder.items || []).reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2) }</span>
                        )}
                        <span className="text-lg font-bold text-gray-800">
                          ₹{ (
                            (pendingOrder.items || []).reduce((acc, i) => acc + (i.price * i.quantity), 0) *
                            (selectedBirthdayOffer ? (1 - selectedBirthdayOffer.discount_percent / 100) : 1)
                          ).toFixed(2) }
                        </span>
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-2xl p-4 flex justify-between items-center border border-blue-100">
                      <span className="text-blue-700 font-medium">GST (Dynamic):</span>
                      <span className="text-lg font-bold text-blue-700">₹{ (
                        (pendingOrder.items || []).reduce((acc, i) => {
                          const itemTotal = i.price * i.quantity;
                          const discountFactor = selectedBirthdayOffer ? (1 - selectedBirthdayOffer.discount_percent / 100) : 1;
                          return acc + (itemTotal * discountFactor * (i.gst_rate || 0.18));
                        }, 0)
                      ).toFixed(2) }</span>
                    </div>
                    <div className="bg-green-50 rounded-2xl p-4 flex justify-between items-center border border-green-200">
                      <span className="text-green-700 font-bold">Grand Total:</span>
                      <span className="text-xl font-black text-green-700">₹{ (
                        (pendingOrder.items || []).reduce((acc, i) => {
                          const itemTotal = i.price * i.quantity;
                          const discountFactor = selectedBirthdayOffer ? (1 - selectedBirthdayOffer.discount_percent / 100) : 1;
                          const gstRate = i.gst_rate || 0.18;
                          return acc + (itemTotal * discountFactor * (1 + gstRate));
                        }, 0)
                      ).toFixed(2) }</span>
                    </div>
                  </div>

                  <div className="space-y-3 shrink-0">
                    <button
                      onClick={() => setShowQR(true)}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center space-x-3 shadow-lg shadow-indigo-100"
                    >
                      <FaQrcode />
                      <span>Pay Online</span>
                    </button>
                    <button
                      onClick={() => submitRation(pendingOrder.id, 'cod')}
                      disabled={isSubmittingRation}
                      className="w-full py-4 border-2 border-indigo-100 text-indigo-600 rounded-2xl font-bold hover:bg-indigo-50 transition-all flex items-center justify-center space-x-3"
                    >
                      <FaStore />
                      <span>Cash on Delivery (COD)</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-6">
                  <div className="bg-white p-6 border-2 border-indigo-100 rounded-3xl inline-block mx-auto shadow-sm">
                    {/* Placeholder for QR Code */}
                    <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center border-4 border-indigo-600">
                      <FaQrcode className="text-indigo-600 text-8xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-gray-800 text-lg">Scan to Pay ₹{ (
                      (pendingOrder.items || []).reduce((acc, i) => {
                        const itemTotal = i.price * i.quantity;
                        const discountFactor = selectedBirthdayOffer ? (1 - selectedBirthdayOffer.discount_percent / 100) : 1;
                        const gstRate = i.gst_rate || 0.18;
                        return acc + (itemTotal * discountFactor * (1 + gstRate));
                      }, 0)
                    ).toFixed(2) }</p>
                    <p className="text-xs text-gray-500">Scan this QR with any UPI app (GPay, PhonePe, etc.) to complete your order.</p>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => setShowQR(false)}
                      className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button 
                      onClick={() => {
                        submitRation(pendingOrder.id, 'online');
                        setShowQR(false);
                      }}
                      disabled={isSubmittingRation}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-100 flex items-center justify-center"
                    >
                      <FaCheckCircle className="mr-2" />
                      Done Payment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;
