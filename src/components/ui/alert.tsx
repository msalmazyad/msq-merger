import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:start-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:ps-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        info: "border-blue-200 bg-blue-50 text-blue-900 [&>svg]:text-blue-600 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100",
        success: "border-green-200 bg-green-50 text-green-900 [&>svg]:text-green-600 dark:border-green-900 dark:bg-green-950 dark:text-green-100",
        warning: "border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
        destructive: "border-destructive/50 text-destructive bg-red-50 dark:bg-red-950 [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  ),
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-1 font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";
