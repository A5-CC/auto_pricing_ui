'use client';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Palette } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your application preferences and system configuration</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/settings/appearance" className="block group">
          <Card className="transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent group-hover:bg-primary/10 transition-colors">
                  <Palette className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Appearance</CardTitle>
                  <CardDescription>Customize colors and fonts</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/system-status" className="block group">
          <Card className="transition-all hover:shadow-md hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent group-hover:bg-primary/10 transition-colors">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">System Status</CardTitle>
                  <CardDescription>View API health and version info</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
