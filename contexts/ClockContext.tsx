"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

interface ClockContextType {
  time: string;
  
  chronoTime: number;
  chronoRunning: boolean;
  toggleChrono: () => void;
  resetChrono: () => void;
  
  timerTime: number;
  timerRunning: boolean;
  toggleTimer: () => void;
  resetTimer: () => void;
  setCustomTimer: (minutes: number) => void;
}

const ClockContext = createContext<ClockContextType | undefined>(undefined);

export function ClockProvider({ children }: { children: React.ReactNode }) {
  const [time, setTime] = useState<string>("00:00:00");
  
  const [chronoTime, setChronoTime] = useState(0);
  const [chronoRunning, setChronoRunning] = useState(false);
  const chronoRef = useRef<NodeJS.Timeout | null>(null);

  const [timerTime, setTimerTime] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [initialTimerMinutes, setInitialTimerMinutes] = useState(25);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Global Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("it-IT", { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Chrono Logic
  const toggleChrono = () => {
    if (chronoRunning) {
      if (chronoRef.current) clearInterval(chronoRef.current);
      setChronoRunning(false);
    } else {
      setChronoRunning(true);
      chronoRef.current = setInterval(() => {
        setChronoTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const resetChrono = () => {
    if (chronoRef.current) clearInterval(chronoRef.current);
    setChronoRunning(false);
    setChronoTime(0);
  };

  // Timer Logic
  const toggleTimer = () => {
    if (timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      setTimerRunning(false);
    } else {
      if (timerTime === 0) setTimerTime(initialTimerMinutes * 60);
      setTimerRunning(true);
      timerRef.current = setInterval(() => {
        setTimerTime((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
    setTimerTime(initialTimerMinutes * 60);
  };

  const setCustomTimer = (minutes: number) => {
    const min = Math.max(1, minutes); // at least 1 minute
    setInitialTimerMinutes(min);
    setTimerTime(min * 60);
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(false);
  };

  return (
    <ClockContext.Provider value={{
      time,
      chronoTime, chronoRunning, toggleChrono, resetChrono,
      timerTime, timerRunning, toggleTimer, resetTimer, setCustomTimer
    }}>
      {children}
    </ClockContext.Provider>
  );
}

export function useClock() {
  const context = useContext(ClockContext);
  if (context === undefined) {
    throw new Error("useClock must be used within a ClockProvider");
  }
  return context;
}
