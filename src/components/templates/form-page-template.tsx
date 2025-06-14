import { WolfPageLayout } from "@/components/layout/wolf-page-layout";
import { WolfContentCard } from "@/components/layout/wolf-content-card";
import { ActionButton } from "@/components/ui/wolf-buttons";
import { Button } from "@/components/ui/button";
import React from "react";

interface FormPageTemplateProps {
  title: string;
  description?: string;
  backHref?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitText?: string;
  cancelText?: string;
  isLoading?: boolean;
  actions?: React.ReactNode;
  className?: string;
}

export function FormPageTemplate({
  title,
  description,
  backHref,
  children,
  onSubmit,
  onCancel,
  submitText = "Save",
  cancelText = "Cancel",
  isLoading = false,
  actions,
  className
}: FormPageTemplateProps) {
  return (
    <WolfPageLayout
      title={title}
      description={description}
      backHref={backHref}
      actions={actions}
      className={className}
    >
      <WolfContentCard>
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit?.();
        }}>
          <div className="space-y-6">
            {children}
            
            <div className="flex justify-end gap-3 pt-6 border-t border-neutral-700">
              {onCancel && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  {cancelText}
                </Button>
              )}
              {onSubmit && (
                <ActionButton 
                  type="submit" 
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : submitText}
                </ActionButton>
              )}
            </div>
          </div>
        </form>
      </WolfContentCard>
    </WolfPageLayout>
  );
}

// Form Section Component for organizing form fields
interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <div className={className}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-gray-400">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}