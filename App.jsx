import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import { Building2, Search, DollarSign, Wallet, Info, ArrowRightLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

// npm run dev

// Helper: Moves map when center changes
function MapUpdater({ center }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

// Simple Tooltip Component
function Tooltip({ text, children }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 text-center">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}

// NEW: Helper to calculate color based on price range
const getMarkerColor = (price, min, max) => {
  if (min === max) return '#3b82f6'; // Default blue if only one price
  
  // Calculate relative position (0 to 1)
  let ratio = (price - min) / (max - min);
  if (ratio < 0) ratio = 0;
  if (ratio > 1) ratio = 1;
  
  // Calculate Hue: 120 (Green) -> 60 (Yellow) -> 0 (Red)
  const hue = ((1 - ratio) * 120).toString(10);
  return `hsl(${hue}, 80%, 45%)`;
};

function App() {
  // --- STATE ---
  const [dataOptions, setDataOptions] = useState({ allTypes: [], locationTree: {} });
  const [selections, setSelections] = useState({ state: '', district: '', houseType: '' });
  const [districtList, setDistrictList] = useState([]);
  const [validTypesForArea, setValidTypesForArea] = useState(null);
  
  const [result, setResult] = useState(null);
  const [mapCenter, setMapCenter] = useState([3.1319, 101.6841]); 
  const [loading, setLoading] = useState(true);
  
  // State for collapsible search
  const [isSearchOpen, setIsSearchOpen] = useState(true);

  // --- 1. LOAD OPTIONS ---
  useEffect(() => {
    fetch('http://127.0.0.1:8000/options')
      .then(res => res.json())
      .then(data => {
        setDataOptions({ allTypes: data.all_types, locationTree: data.location_tree });
        setLoading(false);
      })
      .catch(err => console.error("Failed to load options", err));
  }, []);

  // --- 2. CORE SEARCH LOGIC ---
  const executeSearch = async (searchParams) => {
    if (!searchParams.state || !searchParams.district || !searchParams.houseType) return;

    try {
      const q = new URLSearchParams(searchParams).toString();
      const response = await fetch(`http://127.0.0.1:8000/search?${q}`);
      const data = await response.json();

      if (data.found) {
        setResult({ ...data, query: searchParams });
        if (data.points.length > 0) {
            setMapCenter(data.coordinates);
        }
      } else {
        alert("No data found.");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  // --- 3. HANDLERS ---
  const handleStateChange = (e) => {
    const s = e.target.value;
    setSelections(prev => ({ ...prev, state: s, district: '', houseType: '' }));
    setValidTypesForArea(null);
    setResult(null);

    if (s && dataOptions.locationTree[s]) {
      setDistrictList(Object.keys(dataOptions.locationTree[s]).sort());
    } else {
      setDistrictList([]);
    }
  };

  const handleDistrictChange = (e) => {
    const d = e.target.value;
    setSelections(prev => ({ ...prev, district: d, houseType: '' }));
    setResult(null);

    if (selections.state && d) {
      setValidTypesForArea(dataOptions.locationTree[selections.state][d]);
    } else {
      setValidTypesForArea(null);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    executeSearch(selections);
  };

  const handleCompareClick = (newType) => {
    const newSelections = { ...selections, houseType: newType };
    setSelections(newSelections); 
    executeSearch(newSelections); 
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      
      {/* NAVBAR */}
      <nav className="bg-white border-b border-gray-200 h-14 flex items-center px-6 shrink-0 z-50 sticky top-0">
        <div className="flex items-center gap-2 text-blue-700">
          <Building2 size={24} />
          <span className="text-lg font-bold tracking-tight">RentVision</span>
        </div>
      </nav>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* HEADER SECTION */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 shrink-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Rental Market Analysis</h1>
            <p className="text-gray-600 leading-relaxed max-w-4xl">
              Select a region below to see median rental prices, affordability metrics based on the 30% rule, and available property features.
            </p>
        </div>

        {/* CONTENT GRID (Split View) */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          
          {/* LEFT COLUMN: MAP & SEARCH */}
          <div className="w-full lg:w-3/5 flex flex-col gap-3">
              
              {/* MAP CARD */}
              <div className="h-[650px] bg-white rounded-xl shadow-md border border-gray-200 relative overflow-hidden group">
                  <MapContainer center={mapCenter} zoom={12} className="h-full w-full z-0">
                      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                      <MapUpdater center={mapCenter} />

                      {/* DISTRIBUTION DOTS WITH GRADIENT */}
                      {result && result.points && result.points.map((pt, idx) => {
                          // pt[0] = Lat, pt[1] = Lng, pt[2] = Price
                          const color = getMarkerColor(pt[2], result.mapMin, result.mapMax);
                          return (
                            <CircleMarker 
                                key={idx}
                                center={[pt[0], pt[1]]}
                                radius={4}
                                pathOptions={{ 
                                  color: "#000000", 
                                  fillColor: color, 
                                  fillOpacity: 0.7, 
                                  weight: 1 // Remove border for cleaner gradient look
                                }} 
                            />
                          )
                      })}
                  </MapContainer>

                  {/* PRICE LEGEND (Only if results exist) */}
                  {result && (
                    <div className="absolute bottom-4 right-4 z-[999] bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-md border border-gray-200 text-xs">
                       <div className="font-bold mb-1 text-gray-700">Price Heatmap</div>
                       <div className="flex items-center gap-2">
                          <span className="text-gray-500">Low</span>
                          <div className="w-24 h-2 rounded bg-gradient-to-r from-green-500 via-yellow-400 to-red-500"></div>
                          <span className="text-gray-500">High</span>
                       </div>
                    </div>
                  )}

                  {/* FLOATING SEARCH FORM */}
                  <div 
                    className={`absolute top-4 left-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 transition-all duration-300 ease-in-out ${isSearchOpen ? 'w-80 p-5' : 'w-auto p-3'}`}
                  >
                      <div 
                        className="flex items-center justify-between gap-4 cursor-pointer"
                        onClick={() => setIsSearchOpen(!isSearchOpen)}
                      >
                        <div className="flex items-center gap-2 text-blue-700">
                            <Search size={18} />
                            {isSearchOpen ? (
                                <h2 className="font-semibold text-sm whitespace-nowrap">Find Rental Data</h2>
                            ) : (
                                <h2 className="font-semibold text-sm whitespace-nowrap">Search Filters</h2>
                            )}
                        </div>
                        <button className="text-gray-400 hover:text-blue-600 transition-colors">
                            {isSearchOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                      
                      <div className={`overflow-hidden transition-all duration-300 ${isSearchOpen ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}>
                        {loading ? (
                            <div className="text-xs text-center text-gray-400 py-4">Loading database...</div>
                        ) : (
                            <form onSubmit={handleSearchSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">State</label>
                                    <select className="w-full text-sm p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={selections.state} onChange={handleStateChange}>
                                        <option value="">Select State</option>
                                        {Object.keys(dataOptions.locationTree).sort().map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">District</label>
                                    <select className="w-full text-sm p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                        value={selections.district} onChange={handleDistrictChange} disabled={!selections.state}>
                                        <option value="">{selections.state ? "Select District" : "--"}</option>
                                        {districtList.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Property Type</label>
                                    <select className="w-full text-sm p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                        value={selections.houseType} 
                                        onChange={e => setSelections(p => ({...p, houseType: e.target.value}))} 
                                        disabled={!selections.district}
                                    >
                                        <option value="">{selections.district ? "Select Type" : "--"}</option>
                                        {dataOptions.allTypes.map(type => {
                                            const isAvailable = validTypesForArea ? validTypesForArea.includes(type) : true;
                                            return <option key={type} value={type} disabled={!isAvailable} className={!isAvailable ? "text-gray-400 bg-gray-50" : ""}>{type}</option>
                                        })}
                                    </select>
                                </div>
                                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-md shadow-sm transition duration-200">
                                    Analyze Market
                                </button>
                            </form>
                        )}
                      </div>
                  </div>
              </div>

              {/* FOOTER NOTE */}
              <div className="bg-white border border-gray-300 rounded-lg p-3 text-center shadow-sm">
                  <p className="text-sm font-medium italic text-gray-700">
                    Note: The distribution within the map only shows the rental listing with spatial information.
                  </p>
              </div>
          </div>

          {/* RIGHT COLUMN: ANALYSIS RESULTS */}
          <div className="w-full lg:w-2/5 bg-white p-6 rounded-xl shadow-md border border-gray-200 min-h-[650px] flex flex-col">
            <h3 className="text-xl font-bold text-gray-900 mb-6 leading-snug">
                {result 
                    ? `Analysis Result of ${result.query.houseType} in ${result.query.district}, ${result.query.state}` 
                    : "Analysis Result"}
            </h3>
            
            {result ? (
              <div className="space-y-8 flex-1 animate-in fade-in duration-500 flex flex-col">
                {/* Metrics */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <DollarSign size={20} className="text-blue-500" />
                      <span className="font-medium">Median Rent</span>
                    </div>
                    <span className="font-bold text-2xl text-gray-900">RM {result.medianRent}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Wallet size={20} className="text-green-500" />
                      <span className="font-medium">Suggested Income</span>
                      <Tooltip text="The suggested income is based on the suggested worldwide benchmark on spending 30% of income for rent.">
                        <Info size={16} className="text-gray-400 cursor-help hover:text-blue-500 transition-colors" />
                      </Tooltip>
                    </div>
                    <span className="font-bold text-2xl text-gray-900">RM {result.suitableIncome}</span>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">Common Characteristics</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.commonFeatures.length > 0 ? (
                      result.commonFeatures.map((f, i) => (
                        <span key={i} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md text-sm font-medium border border-gray-200">
                          {f}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 italic text-sm">No common features found.</span>
                    )}
                  </div>
                </div>

                 {/* Compare */}
                <div className="pt-6 border-t border-gray-100 flex-1">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <ArrowRightLeft size={16} className="text-gray-400"/> 
                    Compare in {result.location.split(',')[0]}
                  </h4>
                  <div className="space-y-3 overflow-y-auto max-h-[240px] custom-scrollbar pr-1">
                    {result.comparison && result.comparison.length > 0 ? (
                      result.comparison.map((item, idx) => (
                        <div 
                          key={idx}
                          onClick={() => handleCompareClick(item.type)}
                          className="group flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition-all"
                        >
                          <div>
                            <p className="font-semibold text-sm text-gray-700 group-hover:text-blue-700">
                              {item.type}
                            </p>
                            <p className="text-xs text-gray-400">
                              {item.diff > 0 ? `+RM ${item.diff}` : `-RM ${Math.abs(item.diff)}`} vs current
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 group-hover:text-blue-700">RM {item.medianRent}</p>
                            <p className="text-[10px] text-gray-400">Median</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded-lg text-center">
                        No other property types available to compare in this district.
                      </div>
                    )}
                  </div>
                </div>
                <div className="pt-4 text-right text-xs text-gray-400 italic">
                    Based on {result.count} listings.
                </div>
              </div>
            ) : (
              // Empty State
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3">
                <Search size={48} className="text-gray-200" />
                <p className="text-lg font-medium">No analysis generated yet.</p>
                <p className="text-sm text-center max-w-xs">Use the search form on the map to find rental data for a specific region.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* MARKET INSIGHTS SECTION */}
        {result && (
        <div className="flex flex-col gap-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            
            {/* 1. PRICE TREND CHART */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 w-full">
                <h3 className="font-bold text-gray-900 mb-6 border-b pb-2">Price Trend History</h3>
                
                <div className="flex flex-col md:flex-row gap-6">
                    {/* LEFT: INFO */}
                    <div className="w-full md:w-1/5 space-y-4 pt-4">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">State</p>
                            <p className="font-medium text-gray-900">{result.query.state}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">District</p>
                            <p className="font-medium text-gray-900">{result.query.district}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">Property Type</p>
                            <p className="font-medium text-gray-900">{result.query.houseType}</p>
                        </div>
                    </div>

                    {/* RIGHT: CHART */}
                    <div className="w-full md:w-4/5 h-72">
                        {result.trends && result.trends.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={result.trends}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} tickFormatter={(value) => `RM ${value}`} />
                            <RechartsTooltip contentStyle={{backgroundColor: '#1f2937', color: '#fff', borderRadius: '8px', border: 'none'}} itemStyle={{color: '#fff'}} formatter={(value) => [`RM ${value}`, "Median Rent"]} />
                            <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={3} dot={{r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                            </LineChart>
                        </ResponsiveContainer>
                        ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">Not enough historical data.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. PRICE DISTRIBUTION CHART */}
            <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 w-full">
                <h3 className="font-bold text-gray-900 mb-6 border-b pb-2">Price Distribution</h3>
                
                <div className="flex flex-col md:flex-row gap-6">
                    {/* LEFT: INFO */}
                    <div className="w-full md:w-1/5 space-y-4 pt-4">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">State</p>
                            <p className="font-medium text-gray-900">{result.query.state}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">District</p>
                            <p className="font-medium text-gray-900">{result.query.district}</p>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase">Property Type</p>
                            <p className="font-medium text-gray-900">{result.query.houseType}</p>
                        </div>
                    </div>

                    {/* RIGHT: CHART */}
                    <div className="w-full md:w-4/5 h-72">
                        {result.distribution && result.distribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={result.distribution}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="range" tick={{fontSize: 10, fill: '#6b7280'}} axisLine={false} tickLine={false}/>
                            <RechartsTooltip cursor={{fill: '#f3f4f6'}} contentStyle={{backgroundColor: '#1f2937', color: '#fff', borderRadius: '8px', border: 'none'}} itemStyle={{color: '#fff'}} />
                            <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                        ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">No distribution data available.</div>
                        )}
                    </div>
                </div>
            </div>

        </div>
        )}
      </main>
    </div>
  );
}

export default App;