# Analytics Dashboard Components

This directory contains modular components for the analytics dashboard, following clean code principles with proper separation of concerns.

## Structure

```
analytics/
├── types.ts                    # TypeScript interfaces and types
├── sample-data.ts             # Sample dashboard data
├── dashboard-header.tsx       # Document title and date header
├── executive-flash.tsx        # Executive summary card
├── kpi-card.tsx              # Individual KPI metric card
├── kpi-grid.tsx              # Grid layout for KPI cards
├── generic-bar-chart.tsx     # Generic bar chart for data visualization
├── insights-section.tsx       # Opportunities, risks, and actions
└── footer-actions.tsx         # Action buttons footer
```

## Components

### `DashboardHeader`
Simple header component displaying document title and generation date.

### `ExecutiveFlash`
Card component for executive summary with icon and description.

### `KPICard`
Reusable card for individual KPI metrics with tooltips, trends, and values.

### `KPIGrid`
Responsive grid layout that renders multiple KPI cards.

### `GenericBarChart`
Generic bar chart visualization component that can handle any type of data. Automatically adapts to the data structure and labels provided.

### `InsightsSection`
Comprehensive insights display with headline, opportunities, risks, and actions.

### `FooterActions`
Footer component with action buttons for reports and scheduling.