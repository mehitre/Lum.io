/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { 
  ShoppingBag, 
  Package, 
  Clock, 
  Plus, 
  ChevronRight, 
  MapPin, 
  ArrowLeft, 
  CheckCircle2,
  User,
  History,
  Home,
  Settings,
  AlertTriangle,
  X,
  ImageIcon,
  Calendar,
  Smartphone,
} from 'lucide-react';
import { cn } from './lib/utils';
import { CATEGORIES, Errand, ErrandCategory } from './types';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapAutoCenter({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [coords, map]);
  return null;
}

export default function App() {
  const [view, setView] = useState<'home' | 'order' | 'order-details' | 'history'>('home');
  const [selectedCategory, setSelectedCategory] = useState<ErrandCategory | null>(null);
  const [errands, setErrands] = useState<Errand[]>([]);
  const [currentErrand, setCurrentErrand] = useState<Errand | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [distance, setDistance] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropLocation, setDropLocation] = useState('');
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [dropCoords, setDropCoords] = useState<[number, number] | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [isPickingLocation, setIsPickingLocation] = useState<'pickup' | 'drop' | null>(null);
  const [bookingDuration, setBookingDuration] = useState<number>(30);

  // Automatic distance calculation
  useEffect(() => {
    if (selectedCategory !== 'delivery') return;
    if (!pickupLocation || !dropLocation) {
      setDistance(0);
      setRoutePoints([]);
      return;
    }

    const timer = setTimeout(() => {
      calculateDistance();
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [pickupLocation, dropLocation, selectedCategory]);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Request notification permission
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    // Initialize Socket.io
    socketRef.current = io();

    socketRef.current.on('status_update', (data: { orderId: string, status: string, message: string }) => {
      setErrands(prev => prev.map(e => 
        e.id === data.orderId ? { ...e, status: data.status as any } : e
      ));

      if (currentErrand?.id === data.orderId) {
        setCurrentErrand(prev => prev ? { ...prev, status: data.status as any } : null);
      }

      // Show browser notification
      if (Notification.permission === "granted") {
        new Notification("lum.io Update", {
          body: data.message,
          icon: "/favicon.ico" // Fallback icon
        });
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [currentErrand?.id]);

  const handleStartOrder = (category: ErrandCategory) => {
    setSelectedCategory(category);
    setPickupLocation('');
    setDropLocation('');
    setPickupCoords(null);
    setDropCoords(null);
    setRoutePoints([]);
    setDistance(0);
    setView('order');
  };

  const handleSubmitOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const scheduledDate = formData.get('date') as string;
    const scheduledTime = formData.get('time') as string;
    let scheduledAt: number | undefined;

    if (isScheduled && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).getTime();
    }

    let price: number | string = 49 + Math.floor(Math.random() * 50);
    if (selectedCategory === 'delivery') {
      price = 49 + (distance * 15);
    } else if (selectedCategory === 'shopping') {
      price = (bookingDuration / 30) * 69;
    } else if (selectedCategory === 'waiting') {
      price = (bookingDuration / 30) * 60;
    } else if (selectedCategory === 'custom') {
      price = "49-150";
    }

    const newErrand: Errand = {
      id: Math.random().toString(36).substr(2, 9),
      category: selectedCategory!,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      location: selectedCategory === 'delivery' ? `${pickupLocation} to ${dropLocation}` : ((selectedCategory === 'shopping' || selectedCategory === 'waiting') ? dropLocation : formData.get('location') as string),
      pickupLocation: selectedCategory === 'delivery' ? pickupLocation : undefined,
      dropLocation: (selectedCategory === 'delivery' || selectedCategory === 'shopping' || selectedCategory === 'waiting') ? dropLocation : undefined,
      pickupCoords: selectedCategory === 'delivery' ? (pickupCoords || undefined) : undefined,
      dropCoords: (selectedCategory === 'delivery' || selectedCategory === 'shopping' || selectedCategory === 'waiting') ? (dropCoords || undefined) : undefined,
      routePoints: selectedCategory === 'delivery' ? (routePoints.length > 0 ? routePoints : undefined) : undefined,
      status: 'pending',
      price,
      timestamp: Date.now(),
      imageUrl: CATEGORIES.find(c => c.id === selectedCategory)?.image,
      scheduledAt,
      duration: (selectedCategory === 'shopping' || selectedCategory === 'waiting') ? bookingDuration : undefined,
    };
    setErrands([newErrand, ...errands]);
    setCurrentErrand(newErrand);
    setView('history');

    // Join socket room for this order
    socketRef.current?.emit('join_order', newErrand.id);

    // Notify server to start simulation (only if not scheduled for far future, 
    // but for simplicity we'll let the server handle it or just start it)
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: newErrand.id,
          scheduledAt: newErrand.scheduledAt 
        }),
      });
    } catch (err) {
      console.error("Failed to notify server about new order", err);
    }

    // Send WhatsApp notification
    const phoneNumber = "916009812736";
    const scheduleText = newErrand.scheduledAt 
      ? `\n*Scheduled for:* ${new Date(newErrand.scheduledAt).toLocaleString()}`
      : "\n*Type:* On-demand";
    
    let locationText = `*Location:* ${newErrand.location}`;
    if (newErrand.pickupLocation && newErrand.dropLocation) {
      const pickupLink = newErrand.pickupCoords ? `\n*Pickup Link:* https://www.google.com/maps?q=${newErrand.pickupCoords[0]},${newErrand.pickupCoords[1]}` : '';
      const dropLink = newErrand.dropCoords ? `\n*Drop Link:* https://www.google.com/maps?q=${newErrand.dropCoords[0]},${newErrand.dropCoords[1]}` : '';
      locationText = `*Pickup:* ${newErrand.pickupLocation}${pickupLink}\n*Drop:* ${newErrand.dropLocation}${dropLink}`;
    } else if (newErrand.dropLocation) {
      const dropLink = newErrand.dropCoords ? `\n*Drop Link:* https://www.google.com/maps?q=${newErrand.dropCoords[0]},${newErrand.dropCoords[1]}` : '';
      locationText = `*Drop Location:* ${newErrand.dropLocation}${dropLink}`;
    }

    const message = `*New Errand Order!* 🚀\n\n*ID:* #${newErrand.id}\n*Category:* ${newErrand.category.toUpperCase()}\n*Title:* ${newErrand.title}\n${locationText}${newErrand.duration ? `\n*Duration:* ${newErrand.duration} mins` : ''}\n*Price:* ₹${typeof newErrand.price === 'number' ? newErrand.price.toFixed(2) : newErrand.price}${scheduleText}`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    // Open WhatsApp in a new tab
    window.open(whatsappUrl, '_blank');
  };

  const handleViewDetails = (errand: Errand) => {
    setCurrentErrand(errand);
    setView('order-details');
  };

  const handleCancelOrder = async () => {
    if (!currentErrand) return;
    
    const cancelledErrand = { ...currentErrand, status: 'cancelled' as const };
    
    setErrands(prev => prev.map(e => 
      e.id === currentErrand.id ? { ...e, status: 'cancelled' } : e
    ));
    setCurrentErrand(cancelledErrand);
    setShowCancelConfirm(false);

    // Notify server to stop simulation
    try {
      await fetch(`/api/orders/${currentErrand.id}/cancel`, {
        method: 'POST',
      });
    } catch (err) {
      console.error("Failed to notify server about cancellation", err);
    }

    // Send WhatsApp notification for cancellation
    const phoneNumber = "916009812736";
    const message = `*Errand Order Cancelled* ❌\n\n*ID:* #${currentErrand.id}\n*Title:* ${currentErrand.title}\n*Location:* ${currentErrand.location}\n\nThis errand has been cancelled by the user.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const geocode = async (address: string): Promise<[number, number] | null> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const data = await response.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
    }
    return null;
  };

  const reverseGeocode = async (lat: number, lon: number): Promise<string | null> => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await response.json();
      return data.display_name || null;
    } catch (error) {
      console.error("Reverse geocoding failed:", error);
    }
    return null;
  };

  const calculateDistance = async () => {
    if (!pickupLocation || !dropLocation) return;
    
    setIsCalculating(true);
    try {
      const pCoords = await geocode(pickupLocation);
      const dCoords = await geocode(dropLocation);

      if (pCoords && dCoords) {
        setPickupCoords(pCoords);
        setDropCoords(dCoords);
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${pCoords[1]},${pCoords[0]};${dCoords[1]},${dCoords[0]}?overview=full&geometries=geojson`);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
          const distKm = data.routes[0].distance / 1000;
          setDistance(distKm);
          // OSRM returns [lon, lat], Leaflet wants [lat, lon]
          const points = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          setRoutePoints(points);
        }
      }
    } catch (error) {
      console.error("Distance calculation failed:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleMapClick = async (lat: number, lon: number) => {
    if (!isPickingLocation) return;
    
    const address = await reverseGeocode(lat, lon);
    if (address) {
      if (isPickingLocation === 'pickup') {
        setPickupLocation(address);
        setPickupCoords([lat, lon]);
      } else {
        setDropLocation(address);
        setDropCoords([lat, lon]);
      }
    }
    setIsPickingLocation(null);
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            if (isPickingLocation === 'pickup') {
              setPickupLocation(address);
              setPickupCoords([latitude, longitude]);
            } else {
              setDropLocation(address);
              setDropCoords([latitude, longitude]);
            }
          }
          setIsPickingLocation(null);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not access your location. Please check your permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 max-w-md mx-auto shadow-xl relative overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        {view !== 'home' ? (
          <button onClick={() => setView('home')} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center overflow-hidden">
              <img 
                src="https://api.dicebear.com/7.x/initials/svg?seed=LUM&backgroundColor=000000&fontFamily=serif" 
                alt="lum.io logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <h1 className="text-xl font-serif font-bold tracking-tight">lum.io</h1>
          </div>
        )}
        <div className="flex items-center gap-4">
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 space-y-8"
            >
              <section className="text-center py-10 space-y-6">
                <h2 className="text-3xl md:text-4xl font-light tracking-tight text-gray-900 leading-[1.15]">
                  We complete your errands while you focus on <span className="italic font-serif">what actually matters.</span>
                </h2>
                <div className="w-12 h-[1px] bg-gray-200 mx-auto" />
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400 font-semibold">
                  Book your first hour of freedom now
                </p>
              </section>

              <div className="grid grid-cols-1 gap-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleStartOrder(cat.id as ErrandCategory)}
                    className="flex items-center p-4 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all text-left group"
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-white mr-4 shrink-0", cat.color)}>
                      {cat.icon === 'ShoppingBag' && <ShoppingBag className="w-6 h-6" />}
                      {cat.icon === 'Package' && <Package className="w-6 h-6" />}
                      {cat.icon === 'Clock' && <Clock className="w-6 h-6" />}
                      {cat.icon === 'Plus' && <Plus className="w-6 h-6" />}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{cat.title}</h3>
                      <p className="text-sm text-gray-500">{cat.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </button>
                ))}
              </div>

              {errands.length > 0 && (
                <section className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold">Recent Errands</h2>
                    <button onClick={() => setView('history')} className="text-sm font-medium text-blue-600">View all</button>
                  </div>
                  <div className="space-y-3">
                    {errands.slice(0, 2).map((errand) => (
                      <button 
                        key={errand.id} 
                        onClick={() => handleViewDetails(errand)}
                        className="w-full p-4 bg-white rounded-xl border border-gray-100 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                          <img 
                            src={errand.imageUrl} 
                            alt={errand.title} 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{errand.title}</p>
                          <p className="text-xs text-gray-500 capitalize">{errand.status.replace('-', ' ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₹{errand.price}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {view === 'order' && (
            <motion.div
              key="order"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6"
            >
              <h2 className="text-2xl font-bold mb-6">Errand Details</h2>
              <form onSubmit={handleSubmitOrder} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">What do you need?</label>
                  <input
                    required
                    name="title"
                    placeholder={
                      selectedCategory === 'shopping' 
                        ? "e.g. Mall shopping" 
                        : selectedCategory === 'waiting'
                          ? "e.g. Payment counter at DTO office, etc."
                          : selectedCategory === 'custom'
                            ? "e.g. Helper, Chef, Friend, Rent, etc."
                            : "e.g. Pickup dry cleaning"
                    }
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">Description</label>
                  <textarea
                    required
                    name="description"
                    rows={4}
                    placeholder={
                      selectedCategory === 'custom'
                        ? "e.g. Need chef for dinner, friend for rent, help carrying things, etc."
                        : "Provide details, item lists, or special instructions..."
                    }
                    className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all resize-none"
                  />
                </div>

                {(selectedCategory === 'shopping' || selectedCategory === 'waiting') && (
                  <div className="space-y-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Booking Duration
                      </label>
                      <span className="text-sm font-bold text-blue-600">
                        {bookingDuration} mins
                      </span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="240"
                      step="30"
                      value={bookingDuration}
                      onChange={(e) => setBookingDuration(parseInt(e.target.value))}
                      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                      <span>30m</span>
                      <span>1h</span>
                      <span>2h</span>
                      <span>3h</span>
                      <span>4h</span>
                    </div>
                    <div className="pt-2 flex items-center justify-between border-t border-blue-100">
                      <span className="text-xs text-gray-500">Estimated Cost:</span>
                      <span className="text-lg font-bold text-blue-700">
                        ₹{selectedCategory === 'shopping' 
                          ? ((bookingDuration / 30) * 69).toFixed(2)
                          : ((bookingDuration / 30) * 60).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">
                    {selectedCategory === 'delivery' ? 'Pickup Location' : (selectedCategory === 'shopping' ? 'Drop Location' : (selectedCategory === 'waiting' ? 'Line Location' : 'Location'))}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      required
                      name="location"
                      value={selectedCategory === 'delivery' ? pickupLocation : ((selectedCategory === 'shopping' || selectedCategory === 'waiting') ? dropLocation : undefined)}
                      onChange={(e) => {
                        if (selectedCategory === 'delivery') setPickupLocation(e.target.value);
                        else if (selectedCategory === 'shopping' || selectedCategory === 'waiting') setDropLocation(e.target.value);
                      }}
                      placeholder={selectedCategory === 'delivery' ? "Enter pickup address" : ((selectedCategory === 'shopping' || selectedCategory === 'waiting') ? "Enter address" : "Enter address")}
                      className="w-full p-4 pl-12 pr-24 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                    />
                    {(selectedCategory === 'delivery' || selectedCategory === 'shopping' || selectedCategory === 'waiting') && (
                      <button
                        type="button"
                        onClick={() => setIsPickingLocation(selectedCategory === 'delivery' ? 'pickup' : 'drop')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all"
                      >
                        Pick Map
                      </button>
                    )}
                  </div>
                </div>

                {selectedCategory === 'delivery' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Drop Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          required
                          name="dropLocation"
                          value={dropLocation}
                          onChange={(e) => setDropLocation(e.target.value)}
                          placeholder="Enter drop address"
                          className="w-full p-4 pl-12 pr-24 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setIsPickingLocation('drop')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all"
                        >
                          Pick Map
                        </button>
                      </div>
                    </div>

                    {isCalculating && (
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
                        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span>Calculating distance...</span>
                      </div>
                    )}

                    {distance > 0 && (
                      <>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm font-medium flex items-center justify-between">
                          <span>Estimated Distance:</span>
                          <span>{distance.toFixed(2)} km</span>
                        </div>
                        <div className="h-48 w-full rounded-xl overflow-hidden border border-gray-200 shadow-inner z-0">
                          <MapContainer 
                            center={pickupCoords || [25.5788, 91.8933]} 
                            zoom={13} 
                            style={{ height: '100%', width: '100%' }}
                            zoomControl={false}
                          >
                            <TileLayer 
                              url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                              attribution='&copy; Google Maps'
                            />
                            {pickupCoords && <Marker position={pickupCoords} />}
                            {dropCoords && <Marker position={dropCoords} />}
                            {routePoints.length > 0 && <Polyline positions={routePoints} color="white" weight={4} opacity={0.8} />}
                            <MapAutoCenter coords={routePoints.length > 0 ? routePoints : (pickupCoords && dropCoords ? [pickupCoords, dropCoords] : [])} />
                          </MapContainer>
                        </div>
                      </>
                    )}
                  </>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", isScheduled ? "bg-blue-600" : "bg-gray-400")}>
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Schedule for later</p>
                        <p className="text-xs text-gray-500">Pick a date and time</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsScheduled(!isScheduled)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-colors relative",
                        isScheduled ? "bg-black" : "bg-gray-300"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                        isScheduled ? "left-7" : "left-1"
                      )} />
                    </button>
                  </div>

                  {isScheduled && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
                        <input
                          required={isScheduled}
                          type="date"
                          name="date"
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Time</label>
                        <input
                          required={isScheduled}
                          type="time"
                          name="time"
                          className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {selectedCategory !== 'shopping' && selectedCategory !== 'waiting' && (
                  <div className="bg-gray-100 p-4 rounded-xl flex items-center justify-between">
                    <span className="text-sm text-gray-600">Estimated Cost</span>
                    <span className="font-bold text-lg">
                      {selectedCategory === 'delivery' 
                        ? `₹${(49 + (distance * 15)).toFixed(2)}`
                        : selectedCategory === 'custom'
                          ? '₹49.00 - ₹150.00'
                          : '₹49.00 onwards'}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-black text-white rounded-xl font-bold text-lg hover:bg-gray-800 active:scale-[0.98] transition-all"
                >
                  Confirm Order
                </button>
              </form>
            </motion.div>
          )}

          {view === 'order-details' && currentErrand && (
            <motion.div
              key="order-details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Order Details</h2>
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold uppercase",
                  currentErrand.status === 'pending' ? "bg-blue-100 text-blue-700" :
                  currentErrand.status === 'assigned' ? "bg-yellow-100 text-yellow-700" :
                  currentErrand.status === 'in-progress' ? "bg-purple-100 text-purple-700" :
                  currentErrand.status === 'completed' ? "bg-green-100 text-green-700" :
                  "bg-red-100 text-red-700"
                )}>
                  {currentErrand.status.replace('-', ' ')}
                </div>
              </div>

              <div className="w-full h-48 rounded-2xl overflow-hidden bg-gray-100 shadow-sm">
                <img 
                  src={currentErrand.imageUrl} 
                  alt={currentErrand.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Errand</p>
                  <h3 className="text-xl font-bold">{currentErrand.title}</h3>
                  <p className="text-gray-600 mt-1">{currentErrand.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Price</p>
                    <p className="text-lg font-bold">₹{currentErrand.price}</p>
                  </div>
                  <div className="p-4 bg-white border border-gray-100 rounded-2xl">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Order ID</p>
                    <p className="text-sm font-mono font-bold">#{currentErrand.id}</p>
                  </div>
                </div>

                {currentErrand.duration && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Booking Duration</p>
                      <p className="font-bold">{currentErrand.duration} minutes</p>
                    </div>
                  </div>
                )}

                {currentErrand.scheduledAt && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Scheduled For</p>
                      <p className="font-bold">{new Date(currentErrand.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-white border border-gray-100 rounded-2xl space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Location</p>
                  {currentErrand.pickupLocation && currentErrand.dropLocation ? (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <div className="w-2 h-2 rounded-full bg-blue-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Pickup</p>
                          <p className="text-sm text-gray-700">{currentErrand.pickupLocation}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-3 h-3 text-green-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">Drop</p>
                          <p className="text-sm text-gray-700">{currentErrand.dropLocation}</p>
                        </div>
                      </div>
                    </div>
                  ) : currentErrand.dropLocation ? (
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-3 h-3 text-green-600" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Drop Location</p>
                        <p className="text-sm text-gray-700">{currentErrand.dropLocation}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium">{currentErrand.location}</span>
                    </div>
                  )}
                </div>

                {(currentErrand.dropCoords || (currentErrand.pickupCoords && currentErrand.dropCoords)) && (
                  <div className="h-48 w-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm z-0">
                    <MapContainer 
                      center={currentErrand.dropCoords || currentErrand.pickupCoords || [25.5788, 91.8933]} 
                      zoom={13} 
                      style={{ height: '100%', width: '100%' }}
                      zoomControl={false}
                    >
                      <TileLayer 
                        url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        attribution='&copy; Google Maps'
                      />
                      {currentErrand.pickupCoords && <Marker position={currentErrand.pickupCoords} />}
                      {currentErrand.dropCoords && <Marker position={currentErrand.dropCoords} />}
                      {currentErrand.routePoints && <Polyline positions={currentErrand.routePoints} color="white" weight={4} opacity={0.8} />}
                      <MapAutoCenter coords={currentErrand.routePoints || (currentErrand.pickupCoords && currentErrand.dropCoords ? [currentErrand.pickupCoords, currentErrand.dropCoords] : [currentErrand.dropCoords || currentErrand.pickupCoords || [25.5788, 91.8933]])} />
                    </MapContainer>
                  </div>
                )}

                {/* Status Timeline */}
                <div className="p-4 bg-white border border-gray-100 rounded-2xl space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status Timeline</p>
                  <div className="space-y-4">
                    {[
                      { status: 'pending', label: 'Order Placed', time: 'Just now' },
                      { status: 'assigned', label: 'Runner Assigned', time: 'Processing' },
                      { status: 'in-progress', label: 'Errand in Progress', time: 'Processing' },
                      { status: 'completed', label: 'Completed', time: 'Final' }
                    ].map((step, idx) => {
                      const isCompleted = errands.find(e => e.id === currentErrand.id)?.status === step.status || 
                                        (step.status === 'pending' && currentErrand.status !== 'cancelled');
                      const isActive = currentErrand.status === step.status;
                      
                      return (
                        <div key={step.status} className={cn("flex gap-3", !isCompleted && !isActive && "opacity-30")}>
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0",
                              isCompleted || isActive ? "bg-black" : "bg-gray-200"
                            )}>
                              {isCompleted && <CheckCircle2 className="w-3 h-3" />}
                            </div>
                            {idx < 3 && <div className="w-0.5 h-full bg-gray-100 my-1" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{step.label}</p>
                            {isActive && <p className="text-xs text-blue-600 font-medium animate-pulse">Current Status</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {currentErrand.status !== 'completed' && currentErrand.status !== 'cancelled' && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-4 text-red-600 font-bold border-2 border-red-50 border-dashed rounded-2xl hover:bg-red-50 transition-colors"
                >
                  Cancel Errand
                </button>
              )}
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-6"
            >
              <h2 className="text-2xl font-bold">Order History</h2>
              {errands.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
                    <History className="w-8 h-8" />
                  </div>
                  <p className="text-gray-500">No errands yet. Start your first one!</p>
                  <button 
                    onClick={() => setView('home')}
                    className="text-blue-600 font-bold"
                  >
                    Go to Home
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {errands.map((errand) => (
                    <div key={errand.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", CATEGORIES.find(c => c.id === errand.category)?.color)}>
                            {errand.category === 'shopping' && <ShoppingBag className="w-5 h-5" />}
                            {errand.category === 'delivery' && <Package className="w-5 h-5" />}
                            {errand.category === 'waiting' && <Clock className="w-5 h-5" />}
                            {errand.category === 'custom' && <Plus className="w-5 h-5" />}
                          </div>
                          <div>
                            <h3 className="font-bold">{errand.title}</h3>
                            <p className="text-xs text-gray-500">
                              {errand.scheduledAt 
                                ? `Scheduled: ${new Date(errand.scheduledAt).toLocaleDateString()}` 
                                : new Date(errand.timestamp).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-lg">₹{errand.price}</span>
                      </div>

                      <div className="w-full h-32 rounded-xl overflow-hidden bg-gray-100">
                        <img 
                          src={errand.imageUrl} 
                          alt={errand.title} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>

                      <div className="flex items-start gap-2 text-xs text-gray-500">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        {errand.pickupLocation && errand.dropLocation ? (
                          <div className="flex flex-col gap-0.5 truncate">
                            <span className="truncate"><span className="font-bold text-blue-600">P:</span> {errand.pickupLocation}</span>
                            <span className="truncate"><span className="font-bold text-green-600">D:</span> {errand.dropLocation}</span>
                          </div>
                        ) : (
                          <span className="truncate">{errand.location}</span>
                        )}
                      </div>
                      <div className="pt-2 border-t border-gray-50 flex justify-between items-center">
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          errand.status === 'pending' ? "text-blue-600" :
                          errand.status === 'assigned' ? "text-yellow-600" :
                          errand.status === 'in-progress' ? "text-purple-600" :
                          errand.status === 'completed' ? "text-green-600" :
                          "text-red-600"
                        )}>
                          {errand.status.replace('-', ' ')}
                        </span>
                        <button 
                          onClick={() => handleViewDetails(errand)}
                          className="text-xs font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Cancellation Confirmation Dialog */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCancelConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <button 
                  onClick={() => setShowCancelConfirm(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold">Cancel Errand?</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Are you sure you want to cancel this errand? This action cannot be undone.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCancelOrder}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                >
                  Yes, Cancel Order
                </button>
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Keep Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-100 px-6 py-3 flex items-center justify-around sticky bottom-0 z-10 safe-area-bottom">
        <button 
          onClick={() => setView('home')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'home' ? "text-black" : "text-gray-400")}
        >
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button 
          onClick={() => setView('history')}
          className={cn("flex flex-col items-center gap-1 transition-colors", view === 'history' ? "text-black" : "text-gray-400")}
        >
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Orders</span>
        </button>
      </nav>
      <AnimatePresence>
        {isPickingLocation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[80vh]"
            >
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg capitalize">Pick {isPickingLocation} Location</h3>
                  <p className="text-xs text-gray-500">Click on the map to select a point</p>
                </div>
                <button 
                  onClick={() => setIsPickingLocation(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="flex-1 relative">
                <MapContainer 
                  center={[25.5788, 91.8933]} 
                  zoom={14} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer 
                    url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    attribution='&copy; Google Maps'
                  />
                  <MapEvents onMapClick={handleMapClick} />
                  {isPickingLocation === 'pickup' && pickupCoords && <Marker position={pickupCoords} />}
                  {isPickingLocation === 'drop' && dropCoords && <Marker position={dropCoords} />}
                </MapContainer>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-3">
                  <button
                    onClick={handleUseMyLocation}
                    className="bg-white text-black px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 hover:bg-gray-100 transition-colors"
                  >
                    <Smartphone className="w-3 h-3" />
                    Use My Location
                  </button>
                  <div className="bg-black/80 text-white px-4 py-2 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    Tap anywhere to select
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
