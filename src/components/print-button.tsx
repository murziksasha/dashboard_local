"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Друк / PDF" }: { label?: string }) {
  return (
    <Button type="button" size="sm" variant="secondary" className="no-print" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
