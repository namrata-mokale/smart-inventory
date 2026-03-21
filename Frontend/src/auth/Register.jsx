import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaUser, FaEnvelope, FaLock, FaPhone, FaBuilding, FaStore, FaUserTag, FaMapMarkerAlt, FaMapPin, FaUniversity, FaSearch, FaCalendarAlt, FaTimes } from 'react-icons/fa';
import { API_BASE_URL } from '../config';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'shop_owner',
    phone: '',
    shop_name: '',
    company_name: '',
    address: '',
    pincode: '',
    gender: 'Male',
    account_number: '',
    shop_id: '',
    dob: '',
    selected_shops: [] // Array of shop objects {id, name}
  });
  const [error, setError] = useState('');
  const [shops, setShops] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (formData.role === 'salesman') {
      fetchShops();
    }
  }, [formData.role]);

  const fetchShops = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/shops`);
      if (res.ok) {
        setShops(await res.json());
      } else {
        setError("Failed to load shop list. Please refresh.");
      }
    } catch (e) { 
      setError("Network error loading shops. Please check connection.");
    }
  };

  const filteredShops = shops.filter(shop => 
    shop.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
    !formData.selected_shops.some(s => s.id === shop.id)
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectShop = (shop) => {
    if (formData.role === 'customer') {
      setFormData({
        ...formData,
        selected_shops: [...formData.selected_shops, { id: shop.id, name: shop.name }]
      });
      setSearchTerm('');
    } else {
      setFormData({ ...formData, shop_id: shop.id });
      setSearchTerm(shop.name);
    }
    setIsDropdownOpen(false);
  };

  const handleRemoveShop = (shopId) => {
    setFormData({
      ...formData,
      selected_shops: formData.selected_shops.filter(s => s.id !== shopId)
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Strict 10-digit phone validation
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      setError('Contact number must be exactly 10 digits');
      return;
    }

    try {
      const payload = { 
        ...formData, 
        phone: phoneDigits,
        shop_ids: formData.role === 'customer' ? [] : [formData.shop_id]
      };

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        
        if (response.ok) {
          navigate('/login');
        } else {
          setError(data.message || 'Registration failed');
        }
      } else {
        const text = await response.text();
        console.error("Non-JSON response received:", text);
        setError(`Server error (non-JSON). Check if backend is running on port 5001.`);
      }
    } catch (err) {
      console.error("REGISTER_ERROR:", err);
      setError(`Network error: ${err.message}. Check if server is running on 5001.`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 py-10">
      <div className="w-full max-w-2xl p-8 space-y-8 bg-white rounded-2xl shadow-2xl transform transition-all">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-500">Join our platform today</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center font-medium border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">I want to register as a</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUserTag className="text-gray-400" />
              </div>
              <select name="role" value={formData.role} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white">
                <option value="shop_owner">Shop Owner</option>
                <option value="salesman">Salesman</option>
                <option value="supplier">Supplier</option>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {formData.role === 'salesman' && (
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Shop
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search and select shop..."
                  value={searchTerm}
                  onFocus={() => {
                    setIsDropdownOpen(true);
                  }}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {filteredShops.map(shop => (
                      <div
                        key={shop.id}
                        className="px-4 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                        onClick={() => handleSelectShop(shop)}
                      >
                        {shop.name} <span className="text-xs text-gray-400">({shop.location})</span>
                      </div>
                    ))}
                    {filteredShops.length === 0 && (
                      <div className="px-4 py-2 text-sm text-gray-500 italic">No shops found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {formData.role === 'salesman' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaUniversity className="text-gray-400" />
                  </div>
                  <input name="account_number" type="text" onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="Account Number" />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUser className="text-gray-400" />
              </div>
              <input name="name" type="text" onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="John Doe" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mail ID</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaEnvelope className="text-gray-400" />
              </div>
              <input name="email" type="email" onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="john@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaLock className="text-gray-400" />
              </div>
              <input name="password" type="password" onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="••••••••" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaPhone className="text-gray-400" />
              </div>
              <input name="phone" type="text" value={formData.phone} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="9876543210" maxLength="10" required />
            </div>
          </div>

          {formData.role === 'customer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaCalendarAlt className="text-gray-400" />
                </div>
                <input name="dob" type="date" onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required={formData.role === 'customer'} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaMapPin className="text-gray-400" />
              </div>
              <input name="pincode" type="text" value={formData.pincode} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="123456" maxLength="6" />
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Address {formData.role === 'customer' && '(Optional)'}</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaMapMarkerAlt className="text-gray-400" />
              </div>
              <input name="address" type="text" value={formData.address} onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required={formData.role !== 'customer'} placeholder="123 Main St, City, State" />
            </div>
          </div>

          {formData.role === 'shop_owner' && (
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaStore className="text-gray-400" />
                </div>
                <input name="shop_name" type="text" onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="My Awesome Store" />
              </div>
            </div>
          )}

          {formData.role === 'supplier' && (
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaBuilding className="text-gray-400" />
                </div>
                <input name="company_name" type="text" onChange={handleChange} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" required placeholder="Global Supplies Inc." />
              </div>
            </div>
          )}

          <div className="col-span-1 md:col-span-2 pt-4">
            <button type="submit" className="w-full px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
              Create Account
            </button>
          </div>
        </form>

        <p className="text-sm text-center text-gray-600">
          Already have an account? <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline transition-colors">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
