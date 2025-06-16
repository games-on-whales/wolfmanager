import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WolfContentCard } from "@/components/layout/wolf-content-card";
import { cn } from "@/lib/utils";
import React from "react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface WolfDataTableProps<T> {
  title?: string;
  description?: string;
  data: T[];
  columns: Column<T>[];
  actions?: React.ReactNode;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  tableClassName?: string;
  onRowClick?: (item: T) => void;
}

export function WolfDataTable<T extends Record<string, any>>({
  title,
  description,
  data,
  columns,
  actions,
  isLoading = false,
  emptyMessage = "No data available",
  className,
  tableClassName,
  onRowClick
}: WolfDataTableProps<T>) {
  if (isLoading) {
    return (
      <WolfContentCard 
        title={title} 
        description={description} 
        actions={actions}
        className={className}
      >
        <div className="flex items-center justify-center py-8">
          <div className="text-gray-400">Loading...</div>
        </div>
      </WolfContentCard>
    );
  }

  return (
    <WolfContentCard 
      title={title} 
      description={description} 
      actions={actions}
      className={className}
    >
      <Table className={cn("border-separate border-spacing-0", tableClassName)}>
        <TableHeader>
          <TableRow className="border-[rgba(255,255,255,0.1)]">
            {columns.map((column, index) => (
              <TableHead 
                key={index}
                className={cn(
                  "text-[#fffb96] py-3 px-4",
                  column.headerClassName
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length} 
                className="h-24 text-center text-gray-400 py-3 px-4"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((item, rowIndex) => (
              <TableRow 
                key={rowIndex}
                className={cn(
                  "border-b border-neutral-700 hover:bg-neutral-800",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column, colIndex) => (
                  <TableCell 
                    key={colIndex}
                    className={cn("text-white py-3 px-4", column.className)}
                  >
                    {column.render 
                      ? column.render(item)
                      : String(item[column.key] || '')
                    }
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </WolfContentCard>
  );
}

// Table Actions Container - For action buttons in table cells
interface TableActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function TableActions({ children, className }: TableActionsProps) {
  return (
    <div className={cn("flex justify-end gap-1", className)}>
      {children}
    </div>
  );
}

// Status Badge Component for tables
interface StatusBadgeProps {
  status: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  className?: string;
}

export function StatusBadge({ status, variant = 'default', className }: StatusBadgeProps) {
  const variantClasses = {
    success: 'text-[#05ffa1] bg-[#05ffa1]/10 border-[#05ffa1]/20',
    warning: 'text-[#fffb96] bg-[#fffb96]/10 border-[#fffb96]/20',
    error: 'text-red-400 bg-red-400/10 border-red-400/20',
    info: 'text-[#00E5CC] bg-[#00E5CC]/10 border-[#00E5CC]/20',
    default: 'text-gray-400 bg-gray-400/10 border-gray-400/20'
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border",
      variantClasses[variant],
      className
    )}>
      {status}
    </span>
  );
}