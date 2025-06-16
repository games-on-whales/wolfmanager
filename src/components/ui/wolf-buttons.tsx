import { Button, ButtonProps } from "@/components/ui/button";
import { ArrowLeft, Plus, RefreshCw, Trash2, Edit, Eye } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import React from "react";

// Action Button - Primary actions like "Add User", "Refresh"
interface ActionButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  children: React.ReactNode;
  className?: string;
}

export function ActionButton({ children, className, ...props }: ActionButtonProps) {
  return (
    <Button 
      variant="outline" 
      size="sm" 
      className={cn("", className)} 
      {...props}
    >
      {children}
    </Button>
  );
}

// Icon Button - For icons in tables and toolbars
interface IconButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  children: React.ReactNode;
  className?: string;
}

export function IconButton({ children, className, ...props }: IconButtonProps) {
  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={cn("h-8 w-8", className)} 
      {...props}
    >
      {children}
    </Button>
  );
}

// Back Button - Standardized back navigation
interface BackButtonProps {
  href: string;
  className?: string;
}

export function BackButton({ href, className }: BackButtonProps) {
  return (
    <Link href={href}>
      <Button variant="ghost" size="icon" className={cn("", className)}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
    </Link>
  );
}

// Add Button - Standardized "Add" action
interface AddButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  text?: string;
  className?: string;
}

export function AddButton({ text = "Add", className, ...props }: AddButtonProps) {
  return (
    <ActionButton className={cn("", className)} {...props}>
      <Plus className="h-4 w-4 mr-2" />
      {text}
    </ActionButton>
  );
}

// Refresh Button - Standardized refresh action
interface RefreshButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  className?: string;
}

export function RefreshButton({ className, ...props }: RefreshButtonProps) {
  return (
    <ActionButton className={cn("", className)} {...props}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Refresh
    </ActionButton>
  );
}

// Delete Button - Destructive action with proper styling
interface DeleteButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  className?: string;
}

export function DeleteButton({ className, ...props }: DeleteButtonProps) {
  return (
    <IconButton 
      className={cn("text-red-400 hover:text-red-300 hover:bg-red-400/10", className)} 
      {...props}
    >
      <Trash2 className="h-4 w-4" />
    </IconButton>
  );
}

// Edit Button - Edit action with proper styling
interface EditButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  className?: string;
}

export function EditButton({ className, ...props }: EditButtonProps) {
  return (
    <IconButton className={cn("", className)} {...props}>
      <Edit className="h-4 w-4" />
    </IconButton>
  );
}

// View Button - View action with proper styling
interface ViewButtonProps extends Omit<ButtonProps, 'variant' | 'size'> {
  className?: string;
}

export function ViewButton({ className, ...props }: ViewButtonProps) {
  return (
    <IconButton className={cn("", className)} {...props}>
      <Eye className="h-4 w-4" />
    </IconButton>
  );
}