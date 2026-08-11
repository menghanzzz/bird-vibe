"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useBirdStore } from '@/store/useBirdStore';

export default function BirdMap() {
  const [mounted, setMounted] = useState(false);
  const birdRecords = useBirdStore((state) => state.birdRecords);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 过滤出真正带有经纬度记录的小鸟
  const mapPins = Object.entries(birdRecords).filter(
    ([name, record]) => record.lat && record.lng
  );

  // 设定默认中心点 (新加坡)
  const center: [number, number] = [1.3521, 103.8198];

  // 🌟 核心魔法：用原生 HTML + Tailwind 渲染带有小鸟照片的大头针！
  const createCustomIcon = (name: string, photo: string) => {
    const fallbackImage = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2'%3E%3Cpath d='M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E";
    const imgSrc = photo || fallbackImage;

    return L.divIcon({
      className: 'bg-transparent border-none', // 清除默认白底
      html: `
        <div class="flex flex-col items-center transform hover:scale-110 hover:-translate-y-2 transition-all duration-300 drop-shadow-xl cursor-pointer">
          
          <div class="relative w-14 h-14 z-10">
            <div class="w-full h-full rounded-full border-[3px] border-emerald-500 bg-white shadow-inner overflow-hidden flex items-center justify-center">
              <img 
                src="${imgSrc}" 
                onerror="this.onerror=null;this.src='${fallbackImage}';" 
                class="w-full h-full object-cover block" 
                alt="${name}"
              />
            </div>
            
            <div class="absolute -bottom-2 -right-4 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md whitespace-nowrap border-2 border-white z-20">
              ${name}
            </div>
          </div>

          <div class="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-emerald-500 -mt-[2px] z-0 filter drop-shadow-sm"></div>
        </div>
      `,
      iconSize: [56, 70], 
      iconAnchor: [28, 70], 
      popupAnchor: [0, -70], 
    });
  };

  return (
    <div className="w-full h-[650px] rounded-[2.5rem] overflow-hidden border-4 border-emerald-100 shadow-2xl relative z-0">
      {mounted && (
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {mapPins.map(([name, record]) => (
            <Marker
              key={name}
              position={[record.lat!, record.lng!]}
              icon={createCustomIcon(name, record.photos?.[0] ?? '')}
            >
              <Popup className="rounded-2xl">
                <div className="text-center p-2 min-w-[120px]">
                  <h3 className="font-black text-emerald-900 text-base">{name}</h3>
                  <p className="text-xs text-zinc-500 mt-1.5 font-bold flex items-center justify-center gap-1">
                    📍 {record.firstLocation}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-1 bg-zinc-50 py-1 rounded-md">初次邂逅: {record.firstDate}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
    </div>
  );
}