'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getSystemHealth, getVersionInfo } from '@/lib/api/client/system';
import { Activity, CheckCircle2, ChevronLeft, Clock, Info, RefreshCw, Server, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type SystemStatus = 'operational' | 'offline' | 'checking';

export default function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatus>('checking');
  const [lastCheck, setLastCheck] = useState<string>('');
  const [versionInfo, setVersionInfo] = useState<{ version: string; release_date: string; api: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkHealth = async () => {
    setIsRefreshing(true);
    setStatus('checking');

    try {
      const health = await getSystemHealth();
      const version = await getVersionInfo();

      setStatus(health.status === 'ok' ? 'operational' : 'offline');
      setLastCheck(health.timestamp);
      setVersionInfo(version);
    } catch {
      setStatus('offline');
      setLastCheck(new Date().toISOString());
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkHealth();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(checkHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = () => {
    switch (status) {
      case 'operational':
        return (
          <Badge variant="outline" className="border-green-500/50 bg-green-50 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Operational
          </Badge>
        );
      case 'offline':
        return (
          <Badge variant="outline" className="border-red-500/50 bg-red-50 text-red-700">
            <XCircle className="h-3 w-3 mr-1" />
            Offline
          </Badge>
        );
      case 'checking':
        return (
          <Badge variant="outline" className="border-muted bg-muted">
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
              Checking...
            </div>
          </Badge>
        );
    }
  };

  const getStatusIndicator = () => {
    switch (status) {
      case 'operational':
        return (
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-500 animate-ping opacity-75" />
            </div>
            <span className="text-sm font-medium">All systems operational</span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-red-500" />
            <span className="text-sm font-medium">System offline</span>
          </div>
        );
      case 'checking':
        return (
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-3 w-3 rounded-full bg-muted-foreground/50" />
              <div className="absolute inset-0 h-3 w-3 rounded-full bg-muted-foreground/50 animate-pulse" />
            </div>
            <span className="text-sm font-medium">Checking status...</span>
          </div>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Breadcrumb */}
      <Link 
        href="/settings" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Settings
      </Link>

      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">System Status</h1>
          <p className="text-muted-foreground">
            Monitor API health, view version information, and check system diagnostics.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={checkHealth}
          disabled={isRefreshing}
          className="mt-1"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-6">
        {/* System Health Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Health
                </CardTitle>
                <CardDescription>Current operational status</CardDescription>
              </div>
              {getStatusBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {getStatusIndicator()}
            
            {lastCheck && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Last checked: {new Date(lastCheck).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              API Information
            </CardTitle>
            <CardDescription>Backend service details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {versionInfo ? (
              <>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Version</span>
                  <span className="text-sm text-muted-foreground font-mono">{versionInfo.version}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-sm font-medium">Release Date</span>
                  <span className="text-sm text-muted-foreground">{versionInfo.release_date}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">API Endpoint</span>
                  <span className="text-sm text-muted-foreground font-mono">{versionInfo.api}</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Info className="h-4 w-4" />
                Version information unavailable. Check API connectivity.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Developer Note */}
        <Card className="border-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4" />
              Developer Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This page provides system diagnostics and health monitoring. 
              Status indicators have been moved here to maintain a clean user interface on main application pages.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
