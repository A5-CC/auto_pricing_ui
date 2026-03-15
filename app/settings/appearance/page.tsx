'use client';

import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FONT_LABELS, type FontFamily } from '@/lib/theme/fonts';
import { ChevronLeft, Palette, RotateCcw, Type } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function AppearancePage() {
  const { colors, font, setColors, setFont, resetTheme } = useTheme();
  
  const [localColors, setLocalColors] = useState(colors);

  const handleColorChange = (key: keyof typeof colors, value: string) => {
    const newColors = { ...localColors, [key]: value };
    setLocalColors(newColors);
    setColors(newColors);
  };

  const handleReset = () => {
    resetTheme();
    // Force page reload to ensure clean state
    window.location.reload();
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Breadcrumb */}
      <Link 
        href="/settings" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Settings
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Appearance</h1>
        <p className="text-muted-foreground">
          Customize the visual theme of your application. Changes are saved automatically and apply immediately.
        </p>
      </div>

      <div className="space-y-6">
        {/* Color Customization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Color Theme
            </CardTitle>
            <CardDescription>
              Choose your preferred color palette. Click each color to customize.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Background Color */}
              <div className="space-y-2">
                <Label htmlFor="color-background" className="text-sm font-medium">
                  Background
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="color-background"
                    type="color"
                    value={localColors.background}
                    onChange={(e) => handleColorChange('background', e.target.value)}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <div className="text-sm font-mono text-muted-foreground">
                    {localColors.background}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Main background color</p>
              </div>

              {/* Foreground Color */}
              <div className="space-y-2">
                <Label htmlFor="color-foreground" className="text-sm font-medium">
                  Foreground
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="color-foreground"
                    type="color"
                    value={localColors.foreground}
                    onChange={(e) => handleColorChange('foreground', e.target.value)}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <div className="text-sm font-mono text-muted-foreground">
                    {localColors.foreground}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Primary text color</p>
              </div>

              {/* Primary Color */}
              <div className="space-y-2">
                <Label htmlFor="color-primary" className="text-sm font-medium">
                  Primary
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="color-primary"
                    type="color"
                    value={localColors.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <div className="text-sm font-mono text-muted-foreground">
                    {localColors.primary}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Accent and action color</p>
              </div>

              {/* Accent Color */}
              <div className="space-y-2">
                <Label htmlFor="color-accent" className="text-sm font-medium">
                  Accent
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    id="color-accent"
                    type="color"
                    value={localColors.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <div className="text-sm font-mono text-muted-foreground">
                    {localColors.accent}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Secondary highlight color</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Font Customization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Typography
            </CardTitle>
            <CardDescription>
              Select the default font family for the interface.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="font-family" className="text-sm font-medium">
                Font Family
              </Label>
              <Select value={font} onValueChange={(value) => setFont(value as FontFamily)}>
                <SelectTrigger id="font-family" className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FONT_LABELS) as FontFamily[]).map((fontKey) => (
                    <SelectItem key={fontKey} value={fontKey}>
                      {FONT_LABELS[fontKey]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Changes apply immediately across the entire application
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Reset to Defaults */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="h-4 w-4" />
              Reset Theme
            </CardTitle>
            <CardDescription>
              Restore the default Facily color scheme and typography.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={handleReset}
              className="border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
