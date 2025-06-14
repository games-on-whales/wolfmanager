import { WolfPageLayout } from "@/components/layout/wolf-page-layout";
import { WolfDataTable } from "@/components/ui/wolf-data-table";
import { AddButton, RefreshButton } from "@/components/ui/wolf-buttons";
import React from "react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface ManagementPageTemplateProps<T> {
  title: string;
  description?: string;
  backHref?: string;
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  addButtonText?: string;
  onAdd?: () => void;
  onRefresh?: () => void;
  onRowClick?: (item: T) => void;
  additionalActions?: React.ReactNode;
  children?: React.ReactNode;
}

export function ManagementPageTemplate<T extends Record<string, any>>({
  title,
  description,
  backHref,
  data,
  columns,
  isLoading = false,
  emptyMessage,
  addButtonText = "Add Item",
  onAdd,
  onRefresh,
  onRowClick,
  additionalActions,
  children
}: ManagementPageTemplateProps<T>) {
  const actions = (
    <>
      {onRefresh && <RefreshButton onClick={onRefresh} />}
      {onAdd && <AddButton text={addButtonText} onClick={onAdd} />}
      {additionalActions}
    </>
  );

  return (
    <WolfPageLayout
      title={title}
      description={description}
      backHref={backHref}
      actions={actions}
    >
      <WolfDataTable
        data={data}
        columns={columns}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
      />
      {children}
    </WolfPageLayout>
  );
}