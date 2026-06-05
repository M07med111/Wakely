// Responsive premium details modal shell.
// Desktop: centered glassmorphism dialog. Mobile: full-height bottom sheet with swipe-to-close.
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function DetailsModalShell({
  open,
  onClose,
  title,
  subtitle,
  actions,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  // Close on ESC
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-md p-0 md:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            drag={isMobile ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120) onClose();
            }}
            initial={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 10 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isMobile ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="glass-card w-full md:max-w-4xl md:rounded-2xl rounded-t-3xl rounded-b-none md:rounded-b-2xl h-[92vh] md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden border-[var(--gold)]/20 shadow-2xl"
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-muted-foreground/40" />
            </div>

            {/* Sticky header */}
            <div className="flex items-start justify-between gap-3 p-4 md:p-6 border-b border-border shrink-0 bg-background/40 backdrop-blur">
              <div className="min-w-0 flex-1">
                <div className="text-lg md:text-xl font-bold truncate">{title}</div>
                {subtitle && (
                  <div className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {actions}
                <button
                  onClick={onClose}
                  aria-label="إغلاق"
                  className="p-1.5 rounded-md hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
