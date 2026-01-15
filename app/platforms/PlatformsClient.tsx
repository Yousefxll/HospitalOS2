'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Settings, LogOut } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useMe } from '@/lib/hooks/useMe';
import { usePlatform } from '@/lib/hooks/usePlatform';

interface PlatformEntitlements {
  sam: boolean;
  siraHealth: boolean;
  edrac: boolean;
  cvision: boolean;
}

interface PlatformsClientProps {
  userName: string;
  hospitalName?: string | null;
  entitlements: PlatformEntitlements;
}

interface Platform {
  id: string;
  name: string;
  tagline: string;
  logo: string;
  route: string;
  enabled: boolean;
  status: 'available' | 'coming-soon';
}

export default function PlatformsClient({ userName, hospitalName, entitlements }: PlatformsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { language } = useTranslation();
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const { platform: platformData, mutate: mutatePlatform } = usePlatform();
  const currentPlatform = platformData?.platform || null;

  // Check if user is admin or owner
  const { me } = useMe();
  
  useEffect(() => {
    if (!me) return;
    setIsAdmin(me.user?.role === 'admin');
    setIsOwner(me.user?.role === 'syra-owner');
  }, [me]);

  const platforms: Platform[] = useMemo(() => {
    // SAM platform name
    const samPlatformName = language === 'ar' ? 'سَم' : 'SAM';
    // SYRA Health platform name
    const siraHealthPlatformName = language === 'ar' ? 'سِيرَه صِحة' : 'SYRA Health';
    
    // SERVER-SIDE FILTERING: Only include platforms user is entitled to
    // This prevents unauthorized platforms from ever rendering (no flicker)
    const platformList: Platform[] = [];
    
    // Only add SAM if user is entitled
    if (entitlements.sam) {
      platformList.push({
        id: 'sam',
        name: samPlatformName,
        tagline: 'From Policy to Compliance',
        logo: '/brand/sam.png',
        route: '/platforms/sam',
        enabled: true,
        status: 'available',
      });
    }
    
    // Only add SYRA Health if user is entitled
    if (entitlements.siraHealth) {
      platformList.push({
        id: 'siraHealth',
        name: siraHealthPlatformName,
        tagline: 'One Platform, Total Care',
        logo: '/branding/SYRA-Health.png',
        route: '/platforms/syra-health',
        enabled: true,
        status: 'available',
      });
    }
    
    // Never include edrac or cvision (always coming-soon, filtered out)
    // If user is entitled to them in future, they will be added here
    
    return platformList;
  }, [language, entitlements]);

  const handlePlatformClick = async (platform: Platform) => {
    if (!platform.enabled || platform.status !== 'available') {
      return; // Don't allow clicking locked platforms
    }

    // Map platform ID to cookie value
    const platformValue = platform.id === 'sam' ? 'sam' : platform.id === 'siraHealth' ? 'health' : null;
    
    if (!platformValue) {
      return; // Invalid platform
    }

    // If already on this platform, just navigate
    if (currentPlatform === platformValue) {
      router.push(platform.route);
      return;
    }

    setIsSwitching(platformValue);

    try {
      // Switch platform via API (checks entitlements)
      const response = await fetch('/api/platform/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformValue }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        // Revalidate platform cache to get updated value
        await mutatePlatform();
        
        // Wait a bit for cookie to be set, then navigate
        setTimeout(() => {
          router.push(platform.route);
          router.refresh();
        }, 100);
      } else if (response.status === 403) {
        // Not entitled to this platform
        toast({
          title: 'Access Denied',
          description: data.message || 'You are not entitled to access this platform',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to switch platform',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error switching platform:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch platform. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSwitching(null);
    }
  };

  // Staggered animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15, // 150ms delay between each platform
      },
    },
  };

  const tileVariants = {
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.95,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
      },
    },
  };

  // Check if platform is currently active
  const isPlatformActive = (platformId: string) => {
    const platformValue = platformId === 'sam' ? 'sam' : platformId === 'siraHealth' ? 'health' : null;
    return currentPlatform === platformValue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-4">
            <h1 className="text-4xl font-bold">Choose your platform</h1>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/owner')}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Owner
                </Button>
              )}
              {isAdmin && !isOwner && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/admin')}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Admin
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await fetch('/api/auth/logout', { 
                      method: 'POST',
                      credentials: 'include',
                    });
                    router.push('/login');
                    router.refresh();
                  } catch (error) {
                    console.error('Logout failed:', error);
                  }
                }}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
          {hospitalName && (
            <p className="text-lg text-muted-foreground">{hospitalName}</p>
          )}
          <p className="text-muted-foreground">Welcome, {userName}</p>
        </motion.div>

        {/* Platforms Grid - Logo First Design */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto"
        >
          {platforms.map((platform, index) => {
            const isAvailable = platform.enabled && platform.status === 'available';
            const isActive = isPlatformActive(platform.id);
            const isDisabled = !isAvailable;

            return (
              <motion.div
                key={platform.id}
                variants={tileVariants}
                whileHover={isAvailable ? {
                  scale: 1.03,
                  y: -4,
                  transition: { duration: 0.2 },
                } : {}}
                className="relative"
                data-platform={platform.id}
                data-enabled={platform.enabled}
                data-testid={`platform-tile-${platform.id}`}
              >
                <div
                  onClick={() => {
                    if (isAvailable) {
                      handlePlatformClick(platform);
                    }
                  }}
                  className={`
                    relative
                    h-80
                    rounded-2xl
                    border-2
                    overflow-hidden
                    transition-all
                    duration-300
                    ${isAvailable 
                      ? 'cursor-pointer border-primary/20 hover:border-primary/40 bg-gradient-to-br from-white to-gray-50 dark:from-slate-800 dark:to-slate-900' 
                      : 'cursor-not-allowed border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-slate-800 opacity-60 grayscale'
                    }
                    ${isActive && isAvailable
                      ? 'ring-4 ring-primary/30 shadow-xl'
                      : ''
                    }
                  `}
                >
                  {/* Shimmer effect overlay for available platforms */}
                  {isAvailable && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
                      <div className="shimmer-effect" />
                    </div>
                  )}

                  {/* Glow effect for available platforms */}
                  {isAvailable && (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none z-0" />
                  )}

                  {/* Content */}
                  <div className="relative h-full flex flex-col items-center justify-center p-8 space-y-6">
                    {/* Logo */}
                    <motion.div 
                      className="relative w-64 h-40 flex items-center justify-center"
                      animate={isAvailable ? {
                        scale: [1, 1.02, 1],
                      } : {}}
                      transition={isAvailable ? {
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      } : {}}
                    >
                      <Image
                        src={platform.logo}
                        alt={platform.name}
                        width={256}
                        height={160}
                        className={`object-contain transition-all duration-300 ${
                          isAvailable ? '' : 'grayscale opacity-50'
                        }`}
                        style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
                        priority={index < 2} // Prioritize first two platforms
                        unoptimized={false}
                      />
                    </motion.div>

                    {/* Platform Name */}
                    <div className="text-center space-y-2">
                      <h2 className={`text-2xl font-bold ${
                        isAvailable 
                          ? 'text-foreground' 
                          : 'text-muted-foreground'
                      }`}>
                        {platform.name}
                      </h2>
                      
                      {/* Tagline */}
                      <p className={`text-sm ${
                        isAvailable
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/60'
                      }`}>
                        {platform.tagline}
                      </p>
                    </div>

                    {/* Current Badge */}
                    {isActive && isAvailable && (
                      <Badge 
                        variant="default" 
                        className="absolute top-4 right-4"
                      >
                        Current
                      </Badge>
                    )}

                    {/* Coming Soon Badge */}
                    {!isAvailable && (
                      <Badge 
                        variant="secondary" 
                        className="absolute top-4 right-4"
                      >
                        Coming Soon
                      </Badge>
                    )}

                    {/* Loading indicator */}
                    {isSwitching === (platform.id === 'sam' ? 'sam' : platform.id === 'siraHealth' ? 'health' : null) && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <div className="text-center space-y-2">
                          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-sm text-muted-foreground">Switching...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Shimmer CSS */}
      <style jsx global>{`
        .shimmer-effect {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.08) 50%,
            transparent 100%
          );
          animation: shimmer 4s infinite;
        }

        @keyframes shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
}
