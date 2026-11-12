"use client";

import React from "react";
import { useStore } from "@/lib/store/useStore";
import { CatalogueManagementTab } from "@/components/menus/CatalogueManagementTab";

export default function BranchManagerCataloguePage() {
  const user = useStore((state) => state.user);
  const products = useStore((state) => state.products);
  const branches = useStore((state) => state.branches);
  const tables = useStore((state) => state.tables);

  const managerBranchId = user?.assignedBranchId || user?.branchId;
  const branchProducts = products.filter((p) => {
    if (!managerBranchId) return true;
    if (p.branchId && p.branchId === managerBranchId) return true;
    if (p.branchIds && p.branchIds.includes(managerBranchId)) return true;
    return false;
  });

  const branchOnly = branches.filter((b) => !managerBranchId || b.id === managerBranchId);
  const branchTables = tables.filter((t) => !managerBranchId || t.branchId === managerBranchId);

  return (
    <div className="space-y-6">
      <CatalogueManagementTab
        products={branchProducts}
        branches={branchOnly}
        tables={branchTables}
        selectedBranchId={managerBranchId || branches[0]?.id || ""}
        onSelectBranch={() => {}}
      />
    </div>
  );
}

