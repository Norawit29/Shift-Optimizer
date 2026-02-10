import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WizardStepProps {
  title: string;
  description?: string;
  children: ReactNode;
  isActive: boolean;
  className?: string;
}

export function WizardStep({ title, description, children, isActive, className }: WizardStepProps) {
  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("w-full max-w-4xl mx-auto space-y-6", className)}
    >
      <div className="space-y-2 mb-8 text-center md:text-left">
        <h2 className="text-3xl font-bold font-display tracking-tight text-primary">{title}</h2>
        {description && (
          <p className="text-lg text-muted-foreground">{description}</p>
        )}
      </div>
      
      <div className="bg-white/50 dark:bg-black/20 backdrop-blur-sm rounded-2xl p-1">
        {children}
      </div>
    </motion.div>
  );
}
