"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store/useStore";
import { CatalogueManagementTab } from "@/components/menus/CatalogueManagementTab";

export default function AdminCataloguePage() {
  const products = useStore((state) => state.products);
  const branches = useStore((state) => state.branches);
  const tables = useStore((state) => state.tables);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || "");

  return (
    <div className="space-y-6">
      <CatalogueManagementTab
        products={products}
        branches={branches}
        tables={tables}
        selectedBranchId={selectedBranchId || branches[0]?.id || ""}
        onSelectBranch={(id) => setSelectedBranchId(id)}
      />
    </div>
  );
}

