'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAirportSearch, type Airport } from '@/hooks/use-airport-search';

interface AirportInputProps {
  value: string;           // IATA code
  onChange: (iata: string, airport?: Airport) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

// Country flag emoji helper
function countryFlag(code: string) {
  if (!code || code.length !== 2) return '';
  const codePoints = [...code.toUpperCase()].map(
    (c) => 0x1f1e6 + c.charCodeAt(0) - 65,
  );
  return String.fromCodePoint(...codePoints);
}

export function AirportInput({
  value,
  onChange,
  placeholder = 'IATA hoặc tên sân bay...',
  label,
  required,
  disabled,
  className,
  id,
}: AirportInputProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading } = useAirportSearch(
    selectedAirport ? '' : inputValue, // stop searching after selection
  );

  // Sync when value changes externally (e.g. form reset)
  useEffect(() => {
    if (value !== selectedAirport?.iata) {
      setInputValue(value || '');
      setSelectedAirport(null);
    }
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectAirport = useCallback((airport: Airport) => {
    setSelectedAirport(airport);
    setInputValue(airport.iata);
    onChange(airport.iata, airport);
    setOpen(false);
    setActiveIndex(0);
  }, [onChange]);

  const handleClear = () => {
    setSelectedAirport(null);
    setInputValue('');
    onChange('', undefined);
    inputRef.current?.focus();
    setOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); if (results[activeIndex]) selectAirport(results[activeIndex]); }
    if (e.key === 'Escape') setOpen(false);
  };

  const showDropdown = open && (results.length > 0 || loading);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
          {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className={cn(
        'relative flex items-center rounded-md border border-border bg-background',
        'transition-all duration-150',
        open && 'ring-1 ring-primary border-primary',
      )}>
        {/* Left icon / IATA badge */}
        <div className="flex items-center justify-center h-9 pl-2.5 pr-1.5 flex-shrink-0">
          {selectedAirport ? (
            <span className="text-[11px] font-mono font-bold text-foreground bg-foreground/10 px-1.5 py-0.5 rounded">
              {selectedAirport.iata}
            </span>
          ) : (
            <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>

        {/* Text Input */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={selectedAirport ? `${selectedAirport.name} (${selectedAirport.iata})` : inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setSelectedAirport(null);
            setInputValue(e.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => { if (!selectedAirport) setOpen(true); }}
          onKeyDown={handleKeyDown}
          className={cn(
            'flex-1 h-9 bg-transparent text-[13px] text-foreground outline-none pr-1',
            'placeholder:text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed',
            selectedAirport && 'text-foreground',
          )}
        />

        {/* Clear / Search icon */}
        <div className="flex items-center pr-2">
          {selectedAirport ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          ) : loading ? (
            <Search className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className={cn(
          'absolute z-50 top-full mt-1 left-0 right-0',
          'bg-popover border border-border rounded-md shadow-lg overflow-hidden',
          'max-h-[280px] overflow-y-auto',
        )}>
          {results.length === 0 && loading ? (
            <div className="px-4 py-3 text-[13px] text-muted-foreground">Đang tìm kiếm...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-muted-foreground">Không tìm thấy sân bay</div>
          ) : (
            results.map((airport, index) => (
              <button
                key={airport.iata}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectAirport(airport)}
                className={cn(
                  'w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors',
                  'border-b border-border/50 last:border-0',
                  index === activeIndex
                    ? 'bg-accent text-foreground'
                    : 'hover:bg-accent/50 text-foreground',
                )}
              >
                {/* IATA badge */}
                <span className="text-[11px] font-mono font-bold text-foreground bg-foreground/10 px-1.5 py-0.5 rounded flex-shrink-0 w-10 text-center">
                  {airport.iata}
                </span>

                {/* Name + country */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground truncate">{airport.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {countryFlag(airport.country)} {airport.region}, {airport.country}
                  </p>
                </div>

                {/* ICAO if exists */}
                {airport.icao && (
                  <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                    {airport.icao}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
