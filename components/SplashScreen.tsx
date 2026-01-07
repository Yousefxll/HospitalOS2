'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { appConfig } from '@/lib/config';

interface SplashScreenProps {
  onComplete: () => void;
}

/**
 * Splash Screen Component
 * 
 * Displays an animated splash screen with logo, title, and slogan.
 * Shows only once per browser session (using sessionStorage).
 * 
 * Animation sequence:
 * 1. Logo appears with subtle pulse
 * 2. Title "SYRA" fades in
 * 3. Slogan "UNIFIED INTELLIGENCE PLATFORM" fades in
 * 4. After ~2 seconds, content animates upward and fades out
 * 5. onComplete callback is triggered to reveal login page
 */
export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showLogo, setShowLogo] = useState(false);
  const [showTitle, setShowTitle] = useState(false);
  const [showSlogan, setShowSlogan] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Step 1: Show logo immediately
    setShowLogo(true);

    // Step 2: Show title after 400ms
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
    }, 400);

    // Step 3: Show slogan after 800ms
    const sloganTimer = setTimeout(() => {
      setShowSlogan(true);
    }, 800);

    // Step 4: Start exit animation after 2.5 seconds total (2 seconds after slogan appears)
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      // Trigger onComplete after animation completes
      setTimeout(() => {
        onComplete();
      }, 800); // Match transition duration
    }, 2500);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(sloganTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-white dark:bg-[#0f172a] z-50 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${
        isExiting ? 'opacity-0 translate-y-[-50px]' : 'opacity-100 translate-y-0'
      }`}
    >
      {/* Logo with pulse animation - Large and clear */}
      <div
        className={`transition-all duration-500 ${
          showLogo
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95'
        } ${isExiting ? 'scale-90' : ''}`}
      >
        <div className="relative">
          <Image
            src="/branding/SYRA.PNG"
            alt="SYRA Logo"
            width={350}
            height={350}
            className="object-contain drop-shadow-2xl animate-pulse"
            priority
            style={{ 
              width: '350px',
              height: '350px',
              maxWidth: '500px',
              maxHeight: '500px'
            }}
          />
        </div>
      </div>

      {/* Title - Large and bold */}
      <h1
        className={`mt-10 text-6xl md:text-7xl font-bold text-foreground transition-all duration-500 ${
          showTitle
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        } ${isExiting ? 'opacity-0 translate-y-[-20px]' : ''}`}
        style={{ transitionDelay: showTitle ? '0ms' : '0ms', letterSpacing: '0.05em' }}
      >
        {appConfig.name}
      </h1>

      {/* Slogan - Clear and readable */}
      <p
        className={`mt-6 text-xl md:text-2xl text-muted-foreground font-semibold tracking-wider transition-all duration-500 ${
          showSlogan
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        } ${isExiting ? 'opacity-0 translate-y-[-20px]' : ''}`}
        style={{ transitionDelay: showSlogan ? '0ms' : '0ms' }}
      >
        UNIFIED INTELLIGENCE PLATFORM
      </p>
    </div>
  );
}

