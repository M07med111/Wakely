import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, UserPlus, FilePlus2, CalendarPlus, Upload, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const actions = [
  { to: "/clients", label: "موكل", icon: UserPlus },
  { to: "/cases", label: "قضية", icon: FilePlus2 },
  { to: "/sessions", label: "جلسة", icon: CalendarPlus },
  { to: "/clients", label: "ملف", icon: Upload },
];

export function MultiFab() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed left-4 z-40 flex flex-col items-end gap-3" style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}>
        <AnimatePresence>
          {open && actions.map((a, i) => (
            <motion.div
              key={a.label}
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: i * 0.04 } }}
              exit={{ opacity: 0, y: 10, scale: 0.8 }}
            >
              <Link
                to={a.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 bg-card border border-border rounded-full pr-4 pl-3 py-2 shadow-xl"
              >
                <span className="text-sm font-semibold">{a.label}</span>
                <span className="w-9 h-9 rounded-full btn-gold grid place-items-center"><a.icon className="w-4 h-4" /></span>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="إجراء سريع"
          className="w-14 h-14 rounded-full btn-gold grid place-items-center shadow-2xl"
        >
          <motion.span animate={{ rotate: open ? 45 : 0 }}>
            {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
          </motion.span>
        </button>
      </div>
    </div>
  );
}
